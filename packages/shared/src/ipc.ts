import type { AgentProfile, CommandBlock, LayoutPreset, PersistedState, TerminalPane, Workspace } from './types';

export type ShellOption = {
  key: string;
  label: string;
  path: string;
};

export type BootstrapPayload = {
  state: PersistedState;
  layoutPresets: LayoutPreset[];
  shellOptions: ShellOption[];
};

export type WorkspaceCreateInput = {
  projectRootPath: string;
  layoutId: string;
  paneBlueprints?: WorkspacePaneBlueprintInput[];
};

export type WorkspacePaneBlueprintInput = {
  agentProfile: AgentProfile;
  title: string;
  launchCommand: string | null;
};

export type PaneRenameInput = {
  paneId: string;
  title: string;
};

export type PaneShellInput = {
  paneId: string;
  shellKey: string;
};

export type PaneCwdInput = {
  paneId: string;
  cwd: string;
};

export type PaneStageAssetInput = {
  paneId: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
};

export type PaneStageAssetResult = {
  path: string;
  mimeType: string;
  size: number;
};

export type WorkspaceLayoutInput = {
  workspaceId: string;
  layoutId: string;
};

export type PtyDataEvent = {
  ptyId: string;
  paneId: string;
  data: string;
};

export type PtyExitEvent = {
  ptyId: string;
  paneId: string;
  code: number;
};

export type CommandBlockEvent = {
  paneId: string;
  block: CommandBlock;
};

export type WorkspaceStateEvent = {
  workspaces: Workspace[];
  panes: Record<string, TerminalPane>;
};

export const ipcChannels = {
  bootstrap: 'app:bootstrap',
  workspaceOpenFolder: 'workspace:openFolder',
  workspaceCreate: 'workspace:create',
  workspaceActivate: 'workspace:activate',
  workspaceClose: 'workspace:close',
  workspaceSetLayout: 'workspace:setLayout',
  paneActivate: 'pane:activate',
  paneRename: 'pane:rename',
  paneSetShell: 'pane:setShell',
  paneSetCwd: 'pane:setCwd',
  paneStageAsset: 'pane:stageAsset',
  paneClose: 'pane:close',
  paneToggleMaximize: 'pane:toggleMaximize',
  ptyInput: 'pty:input',
  ptyResize: 'pty:resize',
  ptyRestart: 'pty:restart',
  ptyData: 'pty:data',
  ptyExit: 'pty:exit',
  commandBlockStart: 'commandBlock:start',
  commandBlockUpdate: 'commandBlock:update',
  commandBlockEnd: 'commandBlock:end',
  workspaceState: 'workspace:state'
} as const;
