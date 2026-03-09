import { useEffect, useMemo, useState } from 'react';
import { LAYOUT_PRESETS, type CommandBlock } from '@agentspaces/shared';
import { useElectronBridge } from './hooks/useElectronBridge';
import { useAgentSpacesStore } from './store/useAgentSpacesStore';
import { WorkspaceTabs } from './components/WorkspaceTabs';
import { TerminalPane } from './components/TerminalPane';

function getLayoutDimensions(layoutId: string) {
  return LAYOUT_PRESETS.find((layout) => layout.id === layoutId) ?? LAYOUT_PRESETS[0];
}

export default function App() {
  useElectronBridge();
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);

  const {
    isReady,
    bootError,
    workspaces,
    panes,
    commandBlocks,
    activeWorkspaceId,
    setActiveWorkspace,
    toggleBlockCollapsed
  } = useAgentSpacesStore();

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

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

  const layoutDimensions = activeWorkspace ? getLayoutDimensions(activeWorkspace.layoutId) : LAYOUT_PRESETS[0];

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        void handleCreateWorkspace();
      }

      if (event.altKey && /^[1-9]$/.test(event.key) && activeWorkspace) {
        const paneId = activeWorkspace.paneIds[Number(event.key) - 1];
        if (paneId) {
          void window.agentSpaces.activatePane(paneId);
        }
      }

      if (event.key === 'Escape') {
        setLayoutMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [activeWorkspace]);

  const handleCreateWorkspace = async () => {
    const folder = await window.agentSpaces.openFolder();
    if (folder) {
      await window.agentSpaces.createWorkspace({ projectRootPath: folder, layoutId: 'layout_2x2' });
    }
  };

  const handleLayoutChange = async (layoutId: string) => {
    if (!activeWorkspace) {
      return;
    }

    setLayoutMenuOpen(false);
    await window.agentSpaces.setWorkspaceLayout({ workspaceId: activeWorkspace.id, layoutId });
  };

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
            <div className="topbar__eyebrow">AgentSpaces</div>
            <div className="topbar__title">Terminal workspace</div>
          </div>
          <div className="topbar__controls">
            <button className="chrome-button" onClick={() => void handleCreateWorkspace()} type="button">
              Open folder
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
            onCreate={() => void handleCreateWorkspace()}
            onSelect={(workspaceId) => {
              setActiveWorkspace(workspaceId);
              void window.agentSpaces.activateWorkspace(workspaceId);
            }}
            workspaces={workspaces}
          />
        </div>

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
                  onActivate={(paneId) => void window.agentSpaces.activatePane(paneId)}
                  onToggleBlock={(blockId) => toggleBlockCollapsed(blockId)}
                  pane={pane}
                />
              </div>
            ))}
          </section>
        ) : (
          <div className="empty-state">
            <div className="empty-state__title">No workspace open</div>
            <p className="empty-state__copy">Open a project folder to start a terminal grid.</p>
          </div>
        )}
      </div>
    </main>
  );
}
