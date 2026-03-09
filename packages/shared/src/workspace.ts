import { buildGridPositions, getLayoutPreset } from './layouts';
import { createId } from './id';
import type { PersistedState, TerminalPane, Workspace } from './types';

export function createEmptyState(): PersistedState {
  return {
    workspaces: [],
    panes: {},
    commandBlocks: {},
    activeWorkspaceId: null
  };
}

export function deriveWorkspaceName(projectRootPath: string): string {
  const parts = projectRootPath.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.at(-1) ?? projectRootPath;
}

export function createWorkspace(projectRootPath: string, layoutId: string): { workspace: Workspace; panes: Record<string, TerminalPane> } {
  const now = new Date().toISOString();
  const workspaceId = createId('ws');
  const layout = getLayoutPreset(layoutId);
  const paneIds: string[] = [];
  const panes: Record<string, TerminalPane> = {};

  buildGridPositions(layoutId).slice(0, layout.maxPanes).forEach((position, index) => {
    const paneId = createId('pane');
    paneIds.push(paneId);
    panes[paneId] = {
      id: paneId,
      workspaceId,
      title: index === 0 ? projectRootPath : `${deriveWorkspaceName(projectRootPath)} ${index + 1}`,
      shellPath: '',
      shellKey: '',
      cwd: projectRootPath,
      env: {},
      ptyId: null,
      layoutPosition: position,
      commandBlockIds: [],
      status: 'starting',
      isMaximized: false,
      restoredSessionId: null
    };
  });

  return {
    workspace: {
      id: workspaceId,
      name: deriveWorkspaceName(projectRootPath),
      projectRootPath,
      layoutId,
      paneIds,
      activePaneId: paneIds[0] ?? null,
      createdAt: now,
      updatedAt: now,
      isRestored: false
    },
    panes
  };
}

export function remapPanePositions(paneIds: string[], layoutId: string): Record<string, TerminalPane['layoutPosition']> {
  const positions = buildGridPositions(layoutId);
  return paneIds.reduce<Record<string, TerminalPane['layoutPosition']>>((accumulator, paneId, index) => {
    const position = positions[index];
    if (position) {
      accumulator[paneId] = position;
    }
    return accumulator;
  }, {});
}
