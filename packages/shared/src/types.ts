import { z } from 'zod';

export const layoutPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  rows: z.number().int().min(1),
  columns: z.number().int().min(1),
  maxPanes: z.number().int().min(1).max(16)
});

export type LayoutPreset = z.infer<typeof layoutPresetSchema>;

export const panePositionSchema = z.object({
  row: z.number().int().min(0),
  column: z.number().int().min(0),
  rowSpan: z.number().int().min(1),
  colSpan: z.number().int().min(1)
});

export type PanePosition = z.infer<typeof panePositionSchema>;

export const commandBlockStatusSchema = z.enum(['running', 'succeeded', 'failed', 'interrupted']);
export type CommandBlockStatus = z.infer<typeof commandBlockStatusSchema>;

export const terminalPaneStatusSchema = z.enum(['starting', 'active', 'inactive', 'exited']);
export type TerminalPaneStatus = z.infer<typeof terminalPaneStatusSchema>;

export const agentProfileSchema = z.enum(['shell', 'codex', 'claude']);
export type AgentProfile = z.infer<typeof agentProfileSchema>;

export const commandBlockSchema = z.object({
  id: z.string(),
  paneId: z.string(),
  command: z.string(),
  exitCode: z.number().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  output: z.string(),
  collapsed: z.boolean(),
  status: commandBlockStatusSchema,
  source: z.enum(['osc', 'heuristic']),
  prompt: z.string().nullable()
});

export type CommandBlock = z.infer<typeof commandBlockSchema>;

export const terminalPaneSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  agentProfile: agentProfileSchema,
  launchCommand: z.string().nullable().default(null),
  shellPath: z.string(),
  shellKey: z.string(),
  cwd: z.string(),
  env: z.record(z.string(), z.string()).default({}),
  ptyId: z.string().nullable(),
  layoutPosition: panePositionSchema,
  commandBlockIds: z.array(z.string()),
  status: terminalPaneStatusSchema,
  isMaximized: z.boolean(),
  restoredSessionId: z.string().nullable().default(null)
});

export type TerminalPane = z.infer<typeof terminalPaneSchema>;

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  projectRootPath: z.string(),
  layoutId: z.string(),
  paneIds: z.array(z.string()),
  activePaneId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isRestored: z.boolean()
});

export type Workspace = z.infer<typeof workspaceSchema>;

export const persistedStateSchema = z.object({
  workspaces: z.array(workspaceSchema),
  panes: z.record(z.string(), terminalPaneSchema),
  commandBlocks: z.record(z.string(), commandBlockSchema),
  activeWorkspaceId: z.string().nullable()
});

export type PersistedState = z.infer<typeof persistedStateSchema>;
