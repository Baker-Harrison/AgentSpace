import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog } from 'electron';
import { spawn, type IPty } from 'node-pty';
import {
  CommandBlockParser,
  LAYOUT_PRESETS,
  createCommandBlock,
  createEmptyState,
  createId,
  createWorkspace,
  ipcChannels,
  remapPanePositions,
  type BootstrapPayload,
  type CommandBlock,
  type PaneCwdInput,
  type PaneRenameInput,
  type PaneShellInput,
  type PaneStageAssetInput,
  type PaneStageAssetResult,
  type PersistedState,
  type ShellOption,
  type TerminalPane,
  type Workspace,
  type WorkspaceCreateInput,
  type WorkspaceLayoutInput
} from '@agentspaces/shared';
import { PersistenceService } from './persistence';
import { getShellOptions, resolveShell } from './shells';

type PaneRuntime = {
  pty: IPty;
  parser: CommandBlockParser;
  activeBlockId: string | null;
  flushTimer: NodeJS.Timeout | null;
  launchTimer: NodeJS.Timeout | null;
  alternateScreen: boolean;
};

export class WorkspaceManager {
  private state: PersistedState = createEmptyState();
  private readonly panes = new Map<string, PaneRuntime>();
  private readonly shellOptions: ShellOption[] = getShellOptions();

  constructor(
    private readonly window: BrowserWindow,
    private readonly persistence: PersistenceService,
    initialFolderPath?: string
  ) {
    this.state = persistence.load();
    if (this.state.workspaces.length === 0 && initialFolderPath) {
      this.createWorkspace({ projectRootPath: initialFolderPath, layoutId: 'layout_2x2' });
    } else {
      this.restoreWorkspaces();
    }
  }

  bootstrap(): BootstrapPayload {
    return {
      state: this.state,
      layoutPresets: LAYOUT_PRESETS,
      shellOptions: this.shellOptions
    };
  }

  async openFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog(this.window, {
      properties: ['openDirectory']
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0] ?? null;
  }

  createWorkspace(input: WorkspaceCreateInput): Workspace {
    const created = createWorkspace(input.projectRootPath, input.layoutId, input.paneBlueprints);
    const workspace = created.workspace;

    this.state.workspaces = [...this.state.workspaces, workspace];
    this.state.panes = { ...this.state.panes, ...created.panes };
    this.state.activeWorkspaceId = workspace.id;
    this.spawnWorkspacePanes(workspace.id);
    this.saveAndBroadcast();
    return workspace;
  }

  activateWorkspace(workspaceId: string): void {
    this.state.activeWorkspaceId = workspaceId;
    this.saveAndBroadcast();
  }

  closeWorkspace(workspaceId: string): void {
    const workspace = this.findWorkspace(workspaceId);
    if (!workspace) {
      return;
    }

    [...workspace.paneIds].forEach((paneId) => this.closePane(paneId));
    this.state.workspaces = this.state.workspaces.filter((entry) => entry.id !== workspaceId);
    if (this.state.activeWorkspaceId === workspaceId) {
      this.state.activeWorkspaceId = this.state.workspaces[0]?.id ?? null;
    }
    this.saveAndBroadcast();
  }

  setWorkspaceLayout(input: WorkspaceLayoutInput): void {
    const workspace = this.findWorkspace(input.workspaceId);
    if (!workspace) {
      return;
    }

    const preset = LAYOUT_PRESETS.find((entry) => entry.id === input.layoutId);
    if (!preset) {
      return;
    }

    while (workspace.paneIds.length < preset.maxPanes) {
      const pane = this.createPane(workspace);
      workspace.paneIds.push(pane.id);
      this.state.panes[pane.id] = pane;
      this.spawnPane(pane.id);
    }

    const positions = remapPanePositions(workspace.paneIds, input.layoutId);
    workspace.layoutId = input.layoutId;
    workspace.updatedAt = new Date().toISOString();
    const visiblePaneIds = workspace.paneIds.slice(0, preset.maxPanes);
    if (!workspace.activePaneId || !visiblePaneIds.includes(workspace.activePaneId)) {
      workspace.activePaneId = visiblePaneIds[0] ?? workspace.activePaneId;
    }

    workspace.paneIds.forEach((paneId) => {
      const pane = this.state.panes[paneId];
      if (pane && positions[paneId]) {
        pane.layoutPosition = positions[paneId];
      }
    });

    this.saveAndBroadcast();
  }

  renamePane(input: PaneRenameInput): void {
    const pane = this.state.panes[input.paneId];
    if (!pane) {
      return;
    }

    pane.title = input.title.trim() || pane.title;
    this.touchWorkspace(pane.workspaceId);
    this.saveAndBroadcast();
  }

  activatePane(paneId: string): void {
    const pane = this.state.panes[paneId];
    if (!pane) {
      return;
    }

    const workspace = this.findWorkspace(pane.workspaceId);
    if (!workspace) {
      return;
    }

    if (workspace.activePaneId === paneId) {
      return;
    }

    workspace.activePaneId = paneId;
    this.touchWorkspace(workspace.id);
    this.saveAndBroadcast();
  }

  setPaneShell(input: PaneShellInput): void {
    const pane = this.state.panes[input.paneId];
    if (!pane) {
      return;
    }

    pane.shellKey = input.shellKey;
    this.restartPane(input.paneId);
  }

  setPaneCwd(input: PaneCwdInput): void {
    const pane = this.state.panes[input.paneId];
    if (!pane) {
      return;
    }

    pane.cwd = path.resolve(input.cwd);
    this.restartPane(input.paneId);
  }

  async stagePaneAsset(input: PaneStageAssetInput): Promise<PaneStageAssetResult> {
    const pane = this.state.panes[input.paneId];
    if (!pane) {
      throw new Error(`Pane ${input.paneId} was not found.`);
    }

    const assetsDirectory = path.join(pane.cwd, '.agentspaces', 'attachments');
    await mkdir(assetsDirectory, { recursive: true });

    const fileName = this.buildAssetFileName(input.fileName, input.mimeType);
    const filePath = path.join(assetsDirectory, fileName);
    const buffer = Buffer.from(input.base64Data, 'base64');
    await writeFile(filePath, buffer);

    return {
      path: filePath,
      mimeType: input.mimeType,
      size: buffer.byteLength
    };
  }

  closePane(paneId: string): void {
    const pane = this.state.panes[paneId];
    if (!pane) {
      return;
    }

    this.disposePaneRuntime(paneId);
    const workspace = this.findWorkspace(pane.workspaceId);
    if (workspace) {
      workspace.paneIds = workspace.paneIds.filter((entry) => entry !== paneId);
      workspace.activePaneId = workspace.paneIds[0] ?? null;
    }

    pane.commandBlockIds.forEach((blockId) => {
      delete this.state.commandBlocks[blockId];
    });

    delete this.state.panes[paneId];
    this.touchWorkspace(pane.workspaceId);
    this.saveAndBroadcast();
  }

  togglePaneMaximize(paneId: string): void {
    const pane = this.state.panes[paneId];
    if (!pane) {
      return;
    }

    const workspace = this.findWorkspace(pane.workspaceId);
    if (!workspace) {
      return;
    }

    const next = !pane.isMaximized;
    workspace.paneIds.forEach((id) => {
      const currentPane = this.state.panes[id];
      if (currentPane) {
        currentPane.isMaximized = false;
      }
    });
    pane.isMaximized = next;
    workspace.activePaneId = paneId;
    this.touchWorkspace(workspace.id);
    this.saveAndBroadcast();
  }

  handlePtyInput(paneId: string, data: string): void {
    const runtime = this.panes.get(paneId);
    runtime?.pty.write(data);
    if (!runtime || runtime.alternateScreen) {
      return;
    }

    runtime?.parser.noteInput(data).forEach((event) => {
      if (event.type === 'start') {
        this.startBlock(paneId, event.command, event.source);
      }
    });
  }

  handlePtyResize(paneId: string, columns: number, rows: number): void {
    this.panes.get(paneId)?.pty.resize(Math.max(2, columns), Math.max(2, rows));
  }

  restartPane(paneId: string): void {
    this.disposePaneRuntime(paneId);
    this.spawnPane(paneId);
    this.saveAndBroadcast();
  }

  private restoreWorkspaces(): void {
    this.state.workspaces = this.state.workspaces.map((workspace) => ({
      ...workspace,
      isRestored: true
    }));
    this.state.activeWorkspaceId = this.state.activeWorkspaceId ?? this.state.workspaces[0]?.id ?? null;
    this.state.workspaces.forEach((workspace) => this.spawnWorkspacePanes(workspace.id));
    this.saveAndBroadcast();
  }

  private spawnWorkspacePanes(workspaceId: string): void {
    const workspace = this.findWorkspace(workspaceId);
    workspace?.paneIds.forEach((paneId) => this.spawnPane(paneId));
  }

  private createPane(workspace: Workspace): TerminalPane {
    const index = workspace.paneIds.length;
    return {
      id: createId('pane'),
      workspaceId: workspace.id,
      title: `${workspace.name} ${index + 1}`,
      agentProfile: 'shell',
      launchCommand: null,
      shellPath: '',
      shellKey: '',
      cwd: workspace.projectRootPath,
      env: {},
      ptyId: null,
      layoutPosition: { row: 0, column: 0, rowSpan: 1, colSpan: 1 },
      commandBlockIds: [],
      status: 'starting',
      isMaximized: false,
      restoredSessionId: null
    };
  }

  private spawnPane(paneId: string): void {
    const pane = this.state.panes[paneId];
    if (!pane) {
      return;
    }

    const shell = resolveShell(pane.shellKey);
    pane.shellKey = shell.key;
    pane.shellPath = shell.path;
    pane.ptyId = createId('pty');
    pane.status = 'active';

    const pty = spawn(shell.path, this.getShellArgs(shell.key), {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: pane.cwd,
      env: {
        ...process.env,
        ...pane.env,
        TERM_PROGRAM: 'AgentSpaces',
        AGENTSPACES_PANE_ID: paneId
      }
    });
    const parser = new CommandBlockParser();
    const launchTimer =
      pane.launchCommand && pane.launchCommand.trim()
        ? setTimeout(() => {
            const runtime = this.panes.get(paneId);
            if (runtime?.pty === pty) {
              pty.write(`${pane.launchCommand}\r`);
            }
          }, 140)
        : null;
    this.panes.set(paneId, { pty, parser, activeBlockId: null, flushTimer: null, launchTimer, alternateScreen: false });

    pty.onData((data) => this.handlePtyOutput(paneId, pane.ptyId!, data));
    pty.onExit(({ exitCode }) => {
      pane.status = 'exited';
      this.finalizeActiveBlock(paneId, exitCode, 'interrupted');
      this.window.webContents.send(ipcChannels.ptyExit, {
        ptyId: pane.ptyId,
        paneId,
        code: exitCode
      });
      this.saveAndBroadcast();
    });
  }

  private handlePtyOutput(paneId: string, ptyId: string, chunk: string): void {
    this.window.webContents.send(ipcChannels.ptyData, { ptyId, paneId, data: chunk });

    const runtime = this.panes.get(paneId);
    if (!runtime) {
      return;
    }

    const enteredAlternateScreen = this.containsAlternateScreenEnter(chunk);
    const exitedAlternateScreen = this.containsAlternateScreenExit(chunk);

    if (enteredAlternateScreen) {
      runtime.alternateScreen = true;
    }

    if (runtime.alternateScreen) {
      if (exitedAlternateScreen) {
        runtime.alternateScreen = false;
      }

      return;
    }

    const events = runtime.parser.parse(chunk);
    events.forEach((event) => {
      if (event.type === 'start') {
        this.startBlock(paneId, event.command, event.source);
      }
      if (event.type === 'output') {
        this.appendBlockOutput(paneId, event.chunk);
      }
      if (event.type === 'end') {
        this.finalizeActiveBlock(paneId, event.exitCode, event.exitCode === 0 ? 'succeeded' : 'failed');
      }
    });

    if (this.isPromptLike(chunk)) {
      runtime.parser.notePrompt().forEach((event) => {
        if (event.type === 'end') {
          this.finalizeActiveBlock(paneId, event.exitCode, 'succeeded');
        }
      });
    }
  }

  private isPromptLike(chunk: string): boolean {
    return /(\r?\n|^)[^\r\n]{0,80}([#$>%] )$/.test(chunk);
  }

  private containsAlternateScreenEnter(chunk: string): boolean {
    return /\u001b\[\?(1049|1047|47)h/.test(chunk);
  }

  private containsAlternateScreenExit(chunk: string): boolean {
    return /\u001b\[\?(1049|1047|47)l/.test(chunk);
  }

  private startBlock(paneId: string, command: string, source: 'osc' | 'heuristic'): void {
    const pane = this.state.panes[paneId];
    const runtime = this.panes.get(paneId);
    if (!pane || !runtime) {
      return;
    }

    if (runtime.activeBlockId) {
      this.finalizeActiveBlock(paneId, null, 'interrupted');
    }

    const block = createCommandBlock(paneId, command, source);
    pane.commandBlockIds = [...pane.commandBlockIds, block.id];
    this.state.commandBlocks[block.id] = block;
    runtime.activeBlockId = block.id;
    this.window.webContents.send(ipcChannels.commandBlockStart, { paneId, block });
    this.saveAndBroadcast();
  }

  private appendBlockOutput(paneId: string, chunk: string): void {
    const runtime = this.panes.get(paneId);
    if (!runtime?.activeBlockId) {
      return;
    }

    const block = this.state.commandBlocks[runtime.activeBlockId];
    if (!block) {
      return;
    }

    block.output += chunk;
    if (!runtime.flushTimer) {
      runtime.flushTimer = setTimeout(() => {
        runtime.flushTimer = null;
        const currentBlockId = runtime.activeBlockId;
        if (!currentBlockId) {
          return;
        }

        const currentBlock = this.state.commandBlocks[currentBlockId];
        if (!currentBlock) {
          return;
        }

        this.window.webContents.send(ipcChannels.commandBlockUpdate, { paneId, block: currentBlock });
      }, 100);
    }
  }

  private finalizeActiveBlock(paneId: string, exitCode: number | null, status: CommandBlock['status']): void {
    const runtime = this.panes.get(paneId);
    if (!runtime?.activeBlockId) {
      return;
    }

    const block = this.state.commandBlocks[runtime.activeBlockId];
    if (!block) {
      runtime.activeBlockId = null;
      return;
    }

    block.exitCode = exitCode;
    block.finishedAt = new Date().toISOString();
    block.status = status;
    if (runtime.flushTimer) {
      clearTimeout(runtime.flushTimer);
      runtime.flushTimer = null;
    }
    this.window.webContents.send(ipcChannels.commandBlockEnd, { paneId, block });
    runtime.activeBlockId = null;
    this.saveAndBroadcast();
  }

  private disposePaneRuntime(paneId: string): void {
    const runtime = this.panes.get(paneId);
    if (!runtime) {
      return;
    }

    if (runtime.flushTimer) {
      clearTimeout(runtime.flushTimer);
    }
    if (runtime.launchTimer) {
      clearTimeout(runtime.launchTimer);
    }
    runtime.pty.kill();
    this.panes.delete(paneId);
  }

  private getShellArgs(shellKey: string): string[] {
    if (process.platform === 'win32') {
      if (shellKey === 'powershell' || shellKey === 'pwsh') {
        return ['-NoLogo'];
      }
      return [];
    }

    return ['-l'];
  }

  private touchWorkspace(workspaceId: string): void {
    const workspace = this.findWorkspace(workspaceId);
    if (workspace) {
      workspace.updatedAt = new Date().toISOString();
    }
  }

  private saveAndBroadcast(): void {
    this.persistence.save(this.state);
    this.window.webContents.send(ipcChannels.workspaceState, {
      workspaces: this.state.workspaces,
      panes: this.state.panes
    });
  }

  private findWorkspace(workspaceId: string): Workspace | undefined {
    return this.state.workspaces.find((workspace) => workspace.id === workspaceId);
  }

  private buildAssetFileName(fileName: string, mimeType: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const parsed = path.parse(fileName || 'attachment');
    const safeName = (parsed.name || 'attachment').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').slice(0, 48) || 'attachment';
    const extension = parsed.ext || this.extensionFromMimeType(mimeType);
    return `${timestamp}-${safeName}${extension}`;
  }

  private extensionFromMimeType(mimeType: string): string {
    const normalized = mimeType.toLowerCase();
    if (normalized === 'image/png') {
      return '.png';
    }
    if (normalized === 'image/jpeg') {
      return '.jpg';
    }
    if (normalized === 'image/webp') {
      return '.webp';
    }
    if (normalized === 'image/gif') {
      return '.gif';
    }
    if (normalized === 'text/plain') {
      return '.txt';
    }
    return '';
  }
}
