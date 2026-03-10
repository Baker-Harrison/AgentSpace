import { useEffect, useMemo, useState } from 'react';
import { LAYOUT_PRESETS, type AgentProfile, type CommandBlock, type WorkspacePaneBlueprintInput } from '@agentspaces/shared';
import { useElectronBridge } from './hooks/useElectronBridge';
import { useAgentSpacesStore } from './store/useAgentSpacesStore';
import { WorkspaceTabs } from './components/WorkspaceTabs';
import { TerminalPane } from './components/TerminalPane';
import { NewWorkspaceDialog } from './components/NewWorkspaceDialog';
import { AgentSpacesLogo } from './components/AgentSpacesLogo';

function getLayoutDimensions(layoutId: string) {
  return LAYOUT_PRESETS.find((layout) => layout.id === layoutId) ?? LAYOUT_PRESETS[0];
}

function buildPaneBlueprints(
  counts: { shell: number; codex: number; claude: number },
  projectRootPath: string
): WorkspacePaneBlueprintInput[] {
  const workspaceName = projectRootPath.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? projectRootPath;
  const result: WorkspacePaneBlueprintInput[] = [];
  const profiles: Array<{ agentProfile: AgentProfile; count: number; launchCommand: string | null }> = [
    { agentProfile: 'codex', count: counts.codex, launchCommand: 'codex' },
    { agentProfile: 'claude', count: counts.claude, launchCommand: 'claude' },
    { agentProfile: 'shell', count: counts.shell, launchCommand: null }
  ];

  profiles.forEach(({ agentProfile, count, launchCommand }) => {
    for (let index = 0; index < count; index += 1) {
      const number = index + 1;
      const suffix = agentProfile === 'shell' ? `terminal ${number}` : `${agentProfile} ${number}`;
      result.push({
        agentProfile,
        launchCommand,
        title: `${workspaceName} ${suffix}`
      });
    }
  });

  return result;
}

function clampPaneCounts(
  counts: { shell: number; codex: number; claude: number },
  maxPanes: number
): { shell: number; codex: number; claude: number } {
  const next = { ...counts };
  while (next.shell + next.codex + next.claude > maxPanes) {
    if (next.shell > 0) {
      next.shell -= 1;
      continue;
    }
    if (next.claude > 0) {
      next.claude -= 1;
      continue;
    }
    if (next.codex > 0) {
      next.codex -= 1;
    }
  }
  return next;
}

export default function App() {
  useElectronBridge();
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [newWorkspaceFolder, setNewWorkspaceFolder] = useState('');
  const [newWorkspaceLayoutId, setNewWorkspaceLayoutId] = useState('layout_2x2');
  const [newWorkspaceCounts, setNewWorkspaceCounts] = useState({ shell: 0, codex: 0, claude: 0 });
  const [workspaceVisualReady, setWorkspaceVisualReady] = useState(false);
  const [paneFocusArmed, setPaneFocusArmed] = useState(false);

  const isReady = useAgentSpacesStore((state) => state.isReady);
  const bootError = useAgentSpacesStore((state) => state.bootError);
  const workspaces = useAgentSpacesStore((state) => state.workspaces);
  const panes = useAgentSpacesStore((state) => state.panes);
  const commandBlocks = useAgentSpacesStore((state) => state.commandBlocks);
  const activeWorkspaceId = useAgentSpacesStore((state) => state.activeWorkspaceId);
  const setActiveWorkspace = useAgentSpacesStore((state) => state.setActiveWorkspace);
  const toggleBlockCollapsed = useAgentSpacesStore((state) => state.toggleBlockCollapsed);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const layoutDimensions = activeWorkspace ? getLayoutDimensions(activeWorkspace.layoutId) : LAYOUT_PRESETS[0];
  const newWorkspaceLayout = getLayoutDimensions(newWorkspaceLayoutId);

  const visiblePanes = useMemo(() => {
    if (!activeWorkspace) {
      return [];
    }

    const workspacePanes = activeWorkspace.paneIds
      .slice(0, getLayoutDimensions(activeWorkspace.layoutId).maxPanes)
      .map((paneId) => panes[paneId])
      .filter(Boolean);
    const maximized = workspacePanes.find((pane) => pane.isMaximized);
    return maximized ? [maximized] : workspacePanes;
  }, [activeWorkspace, panes]);

  const activeBlocksByPane = useMemo(() => {
    return visiblePanes.reduce<Record<string, CommandBlock[]>>((accumulator, pane) => {
      accumulator[pane.id] = pane.commandBlockIds.map((blockId) => commandBlocks[blockId]).filter(Boolean);
      return accumulator;
    }, {});
  }, [commandBlocks, visiblePanes]);

  const workspaceVisualKey = `${activeWorkspace?.id ?? 'none'}:${visiblePanes.map((pane) => pane.id).join(',')}:${visiblePanes.length}`;

  useEffect(() => {
    setNewWorkspaceCounts((current) => clampPaneCounts(current, newWorkspaceLayout.maxPanes));
  }, [newWorkspaceLayout.maxPanes]);

  useEffect(() => {
    setWorkspaceVisualReady(false);
    setPaneFocusArmed(false);

    if (!activeWorkspace || visiblePanes.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setWorkspaceVisualReady(true);
      setPaneFocusArmed(true);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [workspaceVisualKey, activeWorkspace, visiblePanes.length]);

  const openCreateWorkspaceDialog = () => {
    setWorkspaceDialogOpen(true);
  };

  const handleBrowseWorkspaceFolder = async () => {
    const folder = await window.agentSpaces.openFolder();
    if (folder) {
      setNewWorkspaceFolder(folder);
    }
  };

  const handleCreateWorkspace = async () => {
    const paneBlueprints = buildPaneBlueprints(newWorkspaceCounts, newWorkspaceFolder);
    if (!newWorkspaceFolder || paneBlueprints.length === 0) {
      return;
    }

    await window.agentSpaces.createWorkspace({
      projectRootPath: newWorkspaceFolder,
      layoutId: newWorkspaceLayoutId,
      paneBlueprints
    });
    setWorkspaceDialogOpen(false);
  };

  const handleLayoutChange = async (layoutId: string) => {
    if (!activeWorkspace) {
      return;
    }

    setLayoutMenuOpen(false);
    await window.agentSpaces.setWorkspaceLayout({ workspaceId: activeWorkspace.id, layoutId });
  };

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openCreateWorkspaceDialog();
      }

        if (event.altKey && /^[1-9]$/.test(event.key) && activeWorkspace) {
          const paneId = activeWorkspace.paneIds[Number(event.key) - 1];
          if (paneId) {
            setPaneFocusArmed(true);
            setWorkspaceVisualReady(true);
            void window.agentSpaces.activatePane(paneId);
          }
        }

      if (event.key === 'Escape') {
        setLayoutMenuOpen(false);
        setWorkspaceDialogOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [activeWorkspace]);

  if (!isReady) {
    if (bootError) {
      return (
        <div className="app-shell">
          <div className="startup-error-card">
            <div className="startup-error-label">Startup error</div>
            <p className="startup-error-copy">{bootError}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="app-shell">
        <div className="loading-state">Loading AgentSpaces…</div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <div className="topbar__brand">
            <AgentSpacesLogo className="brand-logo" />
            <div className="topbar__brand-copy">
              <div className="topbar__eyebrow">AgentSpaces</div>
              <div className="topbar__title">Terminal workspace</div>
            </div>
          </div>
          <div className="topbar__controls">
            <button className="chrome-button" onClick={openCreateWorkspaceDialog} type="button">
              New workspace
            </button>
            {activeWorkspace ? (
              <div className="layout-picker">
                <button
                  aria-expanded={layoutMenuOpen}
                  aria-haspopup="menu"
                  className="chrome-button chrome-button--layout"
                  onClick={() => setLayoutMenuOpen((value) => !value)}
                  type="button"
                >
                  {layoutDimensions.name}
                  <span className="layout-picker__chevron">⌄</span>
                </button>
                {layoutMenuOpen ? (
                  <div className="layout-picker__menu" role="menu">
                    {LAYOUT_PRESETS.map((layout) => (
                      <button
                        key={layout.id}
                        className={`layout-picker__option${layout.id === activeWorkspace.layoutId ? ' layout-picker__option--active' : ''}`}
                        onClick={() => void handleLayoutChange(layout.id)}
                        role="menuitemradio"
                        type="button"
                      >
                        <span>{layout.name}</span>
                        <span className="layout-picker__hint">{layout.maxPanes} panes</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>

        <div className="tabbar">
          <WorkspaceTabs
            activeWorkspaceId={activeWorkspaceId}
            onClose={(workspaceId) => void window.agentSpaces.closeWorkspace(workspaceId)}
            onCreate={openCreateWorkspaceDialog}
            onSelect={(workspaceId) => {
              setActiveWorkspace(workspaceId);
              void window.agentSpaces.activateWorkspace(workspaceId);
            }}
            workspaces={workspaces}
          />
        </div>

        <NewWorkspaceDialog
          counts={newWorkspaceCounts}
          folderPath={newWorkspaceFolder}
          isOpen={workspaceDialogOpen}
          layoutId={newWorkspaceLayoutId}
          layoutPresets={LAYOUT_PRESETS}
          onBrowseFolder={() => void handleBrowseWorkspaceFolder()}
          onClose={() => setWorkspaceDialogOpen(false)}
          onCountChange={(profile, delta) => {
            setNewWorkspaceCounts((current) => {
              const next = {
                ...current,
                [profile]: Math.max(0, current[profile] + delta)
              };
              const total = next.shell + next.codex + next.claude;
              if (total > newWorkspaceLayout.maxPanes) {
                return current;
              }
              return next;
            });
          }}
          onCreate={() => void handleCreateWorkspace()}
          onLayoutChange={(layoutId) => setNewWorkspaceLayoutId(layoutId)}
        />

        {activeWorkspace ? (
          <section
            className="workspace-grid"
            style={{
              gridTemplateColumns: visiblePanes.length === 1 && visiblePanes[0]?.isMaximized ? '1fr' : `repeat(${layoutDimensions.columns}, minmax(0, 1fr))`,
              gridTemplateRows: visiblePanes.length === 1 && visiblePanes[0]?.isMaximized ? '1fr' : `repeat(${layoutDimensions.rows}, minmax(0, 1fr))`
            }}
          >
            {visiblePanes.map((pane) => (
              <div
                key={pane.id}
                className="pane-cell"
                style={
                  pane.isMaximized
                    ? { gridColumn: '1 / -1', gridRow: '1 / -1' }
                    : {
                        gridColumn: `${pane.layoutPosition.column + 1} / span ${pane.layoutPosition.colSpan}`,
                        gridRow: `${pane.layoutPosition.row + 1} / span ${pane.layoutPosition.rowSpan}`
                      }
                }
              >
                <TerminalPane
                  blocks={activeBlocksByPane[pane.id] ?? []}
                  isActive={activeWorkspace.activePaneId === pane.id}
                  allowAutoFocus={paneFocusArmed}
                  onActivate={(paneId) => {
                    setPaneFocusArmed(true);
                    setWorkspaceVisualReady(true);
                    void window.agentSpaces.activatePane(paneId);
                  }}
                  onToggleBlock={(blockId) => toggleBlockCollapsed(blockId)}
                  pane={pane}
                  showActiveState={workspaceVisualReady}
                />
              </div>
            ))}
          </section>
        ) : (
          <section className="start-screen">
            <div className="start-screen__hero">
              <div className="start-screen__hero-brand">
                <AgentSpacesLogo className="start-screen__logo" />
                <div className="start-screen__eyebrow">AgentSpaces</div>
              </div>
              <h1 className="start-screen__title">Launch a terminal workspace built for parallel coding agents.</h1>
              <p className="start-screen__copy">
                Start with a folder, choose the grid, and decide how many Codex, Claude, or shell panes should boot automatically.
              </p>
              <div className="start-screen__actions">
                <button className="chrome-button chrome-button--primary" onClick={openCreateWorkspaceDialog} type="button">
                  Create workspace
                </button>
                <div className="start-screen__shortcut">Cmd/Ctrl+Shift+N</div>
              </div>
            </div>

            <div className="start-screen__panel-grid">
              <div className="start-screen__panel">
                <div className="start-screen__panel-title">Layout presets</div>
                <div className="start-screen__chips">
                  {LAYOUT_PRESETS.slice(0, 6).map((layout) => (
                    <span className="start-screen__chip" key={layout.id}>
                      {layout.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="start-screen__panel">
                <div className="start-screen__panel-title">CLI mix</div>
                <ul className="start-screen__list">
                  <li>Codex panes can boot directly into `codex`</li>
                  <li>Claude panes can boot directly into `claude`</li>
                  <li>Shell panes stay clean for local commands</li>
                </ul>
              </div>

              <div className="start-screen__panel">
                <div className="start-screen__panel-title">Built for terminal flow</div>
                <ul className="start-screen__list">
                  <li>Stable PTY-backed panes</li>
                  <li>Paste and file-drop support</li>
                  <li>Responsive resizing for smaller terminals</li>
                </ul>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
