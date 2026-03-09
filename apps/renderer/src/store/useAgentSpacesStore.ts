import { create } from 'zustand';
import {
  LAYOUT_PRESETS,
  type BootstrapPayload,
  type CommandBlock,
  type LayoutPreset,
  type ShellOption,
  type TerminalPane,
  type Workspace
} from '@agentspaces/shared';

type AgentSpacesState = {
  isReady: boolean;
  bootError: string | null;
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  panes: Record<string, TerminalPane>;
  commandBlocks: Record<string, CommandBlock>;
  layoutPresets: LayoutPreset[];
  shellOptions: ShellOption[];
  initialize: (payload: BootstrapPayload) => void;
  setBootError: (message: string) => void;
  setWorkspaceState: (workspaces: Workspace[], panes: Record<string, TerminalPane>) => void;
  upsertBlock: (block: CommandBlock) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  toggleBlockCollapsed: (blockId: string) => void;
};

export const useAgentSpacesStore = create<AgentSpacesState>((set) => ({
  isReady: false,
  bootError: null,
  activeWorkspaceId: null,
  workspaces: [],
  panes: {},
  commandBlocks: {},
  layoutPresets: LAYOUT_PRESETS,
  shellOptions: [],
  initialize: (payload) =>
    set({
      isReady: true,
      bootError: null,
      activeWorkspaceId: payload.state.activeWorkspaceId,
      workspaces: payload.state.workspaces,
      panes: payload.state.panes,
      commandBlocks: payload.state.commandBlocks,
      layoutPresets: payload.layoutPresets,
      shellOptions: payload.shellOptions
    }),
  setBootError: (message) =>
    set({
      bootError: message
    }),
  setWorkspaceState: (workspaces, panes) =>
    set((state) => ({
      workspaces,
      panes,
      activeWorkspaceId: state.activeWorkspaceId ?? workspaces[0]?.id ?? null
    })),
  upsertBlock: (block) =>
    set((state) => ({
      commandBlocks: {
        ...state.commandBlocks,
        [block.id]: block
      }
    })),
  setActiveWorkspace: (workspaceId) =>
    set({
      activeWorkspaceId: workspaceId
    }),
  toggleBlockCollapsed: (blockId) =>
    set((state) => ({
      commandBlocks: state.commandBlocks[blockId]
        ? {
            ...state.commandBlocks,
            [blockId]: {
              ...state.commandBlocks[blockId],
              collapsed: !state.commandBlocks[blockId].collapsed
            }
          }
        : state.commandBlocks
    }))
}));
