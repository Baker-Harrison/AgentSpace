import clsx from 'clsx';
import type { Workspace } from '@agentspaces/shared';

type WorkspaceTabsProps = {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onSelect: (workspaceId: string) => void;
  onClose: (workspaceId: string) => void;
  onCreate: () => void;
};

function workspaceLabel(workspace: Workspace): string {
  return workspace.name.length > 24 ? `${workspace.name.slice(0, 24)}...` : workspace.name;
}

export function WorkspaceTabs({ workspaces, activeWorkspaceId, onSelect, onClose, onCreate }: WorkspaceTabsProps) {
  return (
    <div className="workspace-tabs">
      {workspaces.map((workspace) => (
        <button
          key={workspace.id}
          className={clsx('workspace-tab', workspace.id === activeWorkspaceId && 'workspace-tab--active')}
          onClick={() => onSelect(workspace.id)}
          title={workspace.projectRootPath}
          type="button"
        >
          <span className="workspace-tab__label">{workspaceLabel(workspace)}</span>
          <span className="workspace-tab__meta">{workspace.isRestored ? 'restored' : 'live'}</span>
          <span
            aria-hidden="true"
            className="workspace-tab__close"
            onClick={(event) => {
              event.stopPropagation();
              onClose(workspace.id);
            }}
          >
            ×
          </span>
        </button>
      ))}
      <button className="workspace-tab workspace-tab--new" onClick={onCreate} type="button">
        + New workspace
      </button>
    </div>
  );
}
