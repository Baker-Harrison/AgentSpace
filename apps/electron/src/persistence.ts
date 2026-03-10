import fs from 'node:fs';
import path from 'node:path';
import ElectronStoreModule from 'electron-store';
import { createEmptyState, persistedStateSchema, type PersistedState } from '@agentspaces/shared';

type StoreShape = {
  state: PersistedState;
};

const ElectronStore = (ElectronStoreModule as { default?: typeof ElectronStoreModule }).default ?? ElectronStoreModule;

export class PersistenceService {
  private readonly store = new ElectronStore<StoreShape>({
    name: 'agentspaces',
    defaults: {
      state: createEmptyState()
    }
  });

  load(): PersistedState {
    const raw = this.store.get('state');
    const parsed = persistedStateSchema.safeParse(raw);
    return parsed.success ? sanitizeState(parsed.data) : createEmptyState();
  }

  save(state: PersistedState): void {
    this.store.set('state', state);
  }
}

function sanitizeState(state: PersistedState): PersistedState {
  const workspaces = state.workspaces.filter((workspace) => isUsableDirectory(workspace.projectRootPath));
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const panes = Object.fromEntries(
    Object.entries(state.panes).filter(([, pane]) => workspaceIds.has(pane.workspaceId) && isUsableDirectory(pane.cwd))
  );
  const paneIds = new Set(Object.keys(panes));
  const normalizedWorkspaces = workspaces
    .map((workspace) => {
      const nextPaneIds = workspace.paneIds.filter((paneId) => paneIds.has(paneId));
      if (nextPaneIds.length === 0) {
        return null;
      }

      return {
        ...workspace,
        paneIds: nextPaneIds,
        activePaneId: nextPaneIds.includes(workspace.activePaneId ?? '') ? workspace.activePaneId : nextPaneIds[0]
      };
    })
    .filter((workspace): workspace is PersistedState['workspaces'][number] => workspace !== null);

  const normalizedWorkspaceIds = new Set(normalizedWorkspaces.map((workspace) => workspace.id));
  const commandBlocks = Object.fromEntries(
    Object.entries(state.commandBlocks).filter(([, block]) => {
      const pane = panes[block.paneId];
      return Boolean(pane && normalizedWorkspaceIds.has(pane.workspaceId));
    })
  );

  return {
    workspaces: normalizedWorkspaces,
    panes: Object.fromEntries(Object.entries(panes).filter(([, pane]) => normalizedWorkspaceIds.has(pane.workspaceId))),
    commandBlocks,
    activeWorkspaceId:
      normalizedWorkspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.id ?? normalizedWorkspaces[0]?.id ?? null
  };
}

function isUsableDirectory(candidate: string): boolean {
  if (!candidate || !path.isAbsolute(candidate)) {
    return false;
  }

  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}
