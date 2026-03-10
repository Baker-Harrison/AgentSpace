/// <reference types="vite/client" />

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

declare global {
  interface Window {
    agentSpaces: {
      bootstrap: () => Promise<BootstrapPayload>;
      openFolder: () => Promise<string | null>;
      createWorkspace: (input: WorkspaceCreateInput) => Promise<void>;
      activateWorkspace: (workspaceId: string) => Promise<void>;
      closeWorkspace: (workspaceId: string) => Promise<void>;
      setWorkspaceLayout: (input: WorkspaceLayoutInput) => Promise<void>;
      activatePane: (paneId: string) => Promise<void>;
      renamePane: (input: PaneRenameInput) => Promise<void>;
      setPaneShell: (input: PaneShellInput) => Promise<void>;
      setPaneCwd: (input: PaneCwdInput) => Promise<void>;
      stagePaneAsset: (input: PaneStageAssetInput) => Promise<PaneStageAssetResult>;
      closePane: (paneId: string) => Promise<void>;
      togglePaneMaximize: (paneId: string) => Promise<void>;
      ptyInput: (paneId: string, data: string) => void;
      ptyResize: (paneId: string, columns: number, rows: number) => void;
      restartPty: (paneId: string) => Promise<void>;
      onPtyData: (listener: (event: PtyDataEvent) => void) => () => void;
      onPtyExit: (listener: (event: PtyExitEvent) => void) => () => void;
      onCommandBlockStart: (listener: (event: CommandBlockEvent) => void) => () => void;
      onCommandBlockUpdate: (listener: (event: CommandBlockEvent) => void) => () => void;
      onCommandBlockEnd: (listener: (event: CommandBlockEvent) => void) => () => void;
      onWorkspaceState: (listener: (event: WorkspaceStateEvent) => void) => () => void;
    };
  }
}

export {};
