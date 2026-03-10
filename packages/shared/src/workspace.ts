import { buildGridPositions, getLayoutPreset } from './layouts';
import { createId } from './id';
import type { WorkspacePaneBlueprintInput } from './ipc';
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

function createDefaultPaneBlueprints(projectRootPath: string, layoutId: string): WorkspacePaneBlueprintInput[] {
  const layout = getLayoutPreset(layoutId);
  const workspaceName = deriveWorkspaceName(projectRootPath);
  return buildGridPositions(layoutId).slice(0, layout.maxPanes).map((_position, index) => ({
    agentProfile: 'shell',
    title: index === 0 ? projectRootPath : `${workspaceName} ${index + 1}`,
    launchCommand: null
  }));
}

export function createWorkspace(
  projectRootPath: string,
  layoutId: string,
  paneBlueprints?: WorkspacePaneBlueprintInput[]
): { workspace: Workspace; panes: Record<string, TerminalPane> } {
  const now = new Date().toISOString();
  const workspaceId = createId('ws');
  const layout = getLayoutPreset(layoutId);
  const paneIds: string[] = [];
  const panes: Record<string, TerminalPane> = {};
  const requestedBlueprints = (paneBlueprints?.length ? paneBlueprints : createDefaultPaneBlueprints(projectRootPath, layoutId)).slice(0, layout.maxPanes);

  buildGridPositions(layoutId).slice(0, requestedBlueprints.length).forEach((position, index) => {
    const blueprint = requestedBlueprints[index];
    const paneId = createId('pane');
    paneIds.push(paneId);
    panes[paneId] = {
      id: paneId,
      workspaceId,
      title: blueprint.title,
      agentProfile: blueprint.agentProfile,
      launchCommand: blueprint.launchCommand,
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
