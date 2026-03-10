import { contextBridge, ipcRenderer } from 'electron';
import type {
  BootstrapPayload,
  CommandBlockEvent,
  PaneCwdInput,
  PaneRenameInput,
  PaneShellInput,
  PaneStageAssetInput,
  PaneStageAssetResult,
  PtyDataEvent,
  PtyExitEvent,
  WorkspaceCreateInput,
  WorkspaceLayoutInput,
  WorkspaceStateEvent
} from '@agentspaces/shared';
import { ipcChannels } from '@agentspaces/shared/ipc';

type Unsubscribe = () => void;

const api = {
  bootstrap: () => ipcRenderer.invoke(ipcChannels.bootstrap) as Promise<BootstrapPayload>,
  openFolder: () => ipcRenderer.invoke(ipcChannels.workspaceOpenFolder) as Promise<string | null>,
  createWorkspace: (input: WorkspaceCreateInput) => ipcRenderer.invoke(ipcChannels.workspaceCreate, input),
  activateWorkspace: (workspaceId: string) => ipcRenderer.invoke(ipcChannels.workspaceActivate, workspaceId),
  closeWorkspace: (workspaceId: string) => ipcRenderer.invoke(ipcChannels.workspaceClose, workspaceId),
  setWorkspaceLayout: (input: WorkspaceLayoutInput) => ipcRenderer.invoke(ipcChannels.workspaceSetLayout, input),
  activatePane: (paneId: string) => ipcRenderer.invoke(ipcChannels.paneActivate, paneId),
  renamePane: (input: PaneRenameInput) => ipcRenderer.invoke(ipcChannels.paneRename, input),
  setPaneShell: (input: PaneShellInput) => ipcRenderer.invoke(ipcChannels.paneSetShell, input),
  setPaneCwd: (input: PaneCwdInput) => ipcRenderer.invoke(ipcChannels.paneSetCwd, input),
  stagePaneAsset: (input: PaneStageAssetInput) => ipcRenderer.invoke(ipcChannels.paneStageAsset, input) as Promise<PaneStageAssetResult>,
  closePane: (paneId: string) => ipcRenderer.invoke(ipcChannels.paneClose, paneId),
  togglePaneMaximize: (paneId: string) => ipcRenderer.invoke(ipcChannels.paneToggleMaximize, paneId),
  ptyInput: (paneId: string, data: string) => ipcRenderer.send(ipcChannels.ptyInput, paneId, data),
  ptyResize: (paneId: string, columns: number, rows: number) => ipcRenderer.send(ipcChannels.ptyResize, paneId, columns, rows),
  restartPty: (paneId: string) => ipcRenderer.invoke(ipcChannels.ptyRestart, paneId),
  onPtyData: (listener: (event: PtyDataEvent) => void): Unsubscribe => {
    const handler = (_event: Electron.IpcRendererEvent, payload: PtyDataEvent) => listener(payload);
    ipcRenderer.on(ipcChannels.ptyData, handler);
    return () => ipcRenderer.removeListener(ipcChannels.ptyData, handler);
  },
  onPtyExit: (listener: (event: PtyExitEvent) => void): Unsubscribe => {
    const handler = (_event: Electron.IpcRendererEvent, payload: PtyExitEvent) => listener(payload);
    ipcRenderer.on(ipcChannels.ptyExit, handler);
    return () => ipcRenderer.removeListener(ipcChannels.ptyExit, handler);
  },
  onCommandBlockStart: (listener: (event: CommandBlockEvent) => void): Unsubscribe => {
    const handler = (_event: Electron.IpcRendererEvent, payload: CommandBlockEvent) => listener(payload);
    ipcRenderer.on(ipcChannels.commandBlockStart, handler);
    return () => ipcRenderer.removeListener(ipcChannels.commandBlockStart, handler);
  },
  onCommandBlockUpdate: (listener: (event: CommandBlockEvent) => void): Unsubscribe => {
    const handler = (_event: Electron.IpcRendererEvent, payload: CommandBlockEvent) => listener(payload);
    ipcRenderer.on(ipcChannels.commandBlockUpdate, handler);
    return () => ipcRenderer.removeListener(ipcChannels.commandBlockUpdate, handler);
  },
  onCommandBlockEnd: (listener: (event: CommandBlockEvent) => void): Unsubscribe => {
    const handler = (_event: Electron.IpcRendererEvent, payload: CommandBlockEvent) => listener(payload);
    ipcRenderer.on(ipcChannels.commandBlockEnd, handler);
    return () => ipcRenderer.removeListener(ipcChannels.commandBlockEnd, handler);
  },
  onWorkspaceState: (listener: (event: WorkspaceStateEvent) => void): Unsubscribe => {
    const handler = (_event: Electron.IpcRendererEvent, payload: WorkspaceStateEvent) => listener(payload);
    ipcRenderer.on(ipcChannels.workspaceState, handler);
    return () => ipcRenderer.removeListener(ipcChannels.workspaceState, handler);
  }
};

contextBridge.exposeInMainWorld('agentSpaces', api);
