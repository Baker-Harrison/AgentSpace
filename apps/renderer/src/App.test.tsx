import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./components/TerminalPane', () => ({
  TerminalPane: ({ pane, isActive }: { pane: { title: string }; isActive: boolean }) => (
    <div data-active={isActive ? 'true' : 'false'}>{pane.title}</div>
  )
}));

import App from './App';

beforeEach(() => {
  window.agentSpaces = {
    bootstrap: vi.fn().mockResolvedValue({
      state: {
        activeWorkspaceId: 'ws_1',
        workspaces: [
          {
            id: 'ws_1',
            name: 'project',
            projectRootPath: 'C:/project',
            layoutId: 'layout_2x2',
            paneIds: ['pane_1'],
            activePaneId: 'pane_1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isRestored: false
          }
        ],
        panes: {
          pane_1: {
            id: 'pane_1',
            workspaceId: 'ws_1',
            title: 'C:/project',
            shellPath: 'powershell.exe',
            shellKey: 'powershell',
            cwd: 'C:/project',
            env: {},
            ptyId: 'pty_1',
            layoutPosition: { row: 0, column: 0, rowSpan: 1, colSpan: 1 },
            commandBlockIds: [],
            status: 'active',
            isMaximized: false,
            restoredSessionId: null
          }
        },
        commandBlocks: {}
      },
      layoutPresets: [{ id: 'layout_2x2', name: '2x2', rows: 2, columns: 2, maxPanes: 4 }],
      shellOptions: [{ key: 'powershell', label: 'PowerShell', path: 'powershell.exe' }]
    }),
    openFolder: vi.fn(),
    createWorkspace: vi.fn(),
    activateWorkspace: vi.fn(),
    closeWorkspace: vi.fn(),
    setWorkspaceLayout: vi.fn(),
    activatePane: vi.fn(),
    renamePane: vi.fn(),
    setPaneShell: vi.fn(),
    setPaneCwd: vi.fn(),
    stagePaneAsset: vi.fn(),
    closePane: vi.fn(),
    togglePaneMaximize: vi.fn(),
    ptyInput: vi.fn(),
    ptyResize: vi.fn(),
    restartPty: vi.fn(),
    onPtyData: vi.fn().mockReturnValue(() => undefined),
    onPtyExit: vi.fn().mockReturnValue(() => undefined),
    onCommandBlockStart: vi.fn().mockReturnValue(() => undefined),
    onCommandBlockUpdate: vi.fn().mockReturnValue(() => undefined),
    onCommandBlockEnd: vi.fn().mockReturnValue(() => undefined),
    onWorkspaceState: vi.fn().mockReturnValue(() => undefined)
  };
});

describe('App', () => {
  it('renders the shell once bootstrap resolves', async () => {
    render(<App />);
    expect(await screen.findByText('Terminal workspace')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'New workspace' })).toBeTruthy();
    expect(await screen.findByText('project')).toBeTruthy();
  });

  it('passes active pane state to the pane surface', async () => {
    render(<App />);
    expect((await screen.findByText('C:/project')).getAttribute('data-active')).toBe('true');
  });
});
