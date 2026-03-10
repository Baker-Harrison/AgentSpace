import { useMemo } from 'react';
import type { LayoutPreset } from '@agentspaces/shared';

type PaneCounts = {
  shell: number;
  codex: number;
  claude: number;
};

type NewWorkspaceDialogProps = {
  isOpen: boolean;
  folderPath: string;
  layoutId: string;
  counts: PaneCounts;
  layoutPresets: LayoutPreset[];
  onBrowseFolder: () => void;
  onClose: () => void;
  onCreate: () => void;
  onLayoutChange: (layoutId: string) => void;
  onCountChange: (profile: keyof PaneCounts, delta: number) => void;
};

const PROFILE_COPY: Array<{ key: keyof PaneCounts; label: string; command: string }> = [
  { key: 'codex', label: 'Codex CLI', command: 'codex' },
  { key: 'claude', label: 'Claude CLI', command: 'claude' },
  { key: 'shell', label: 'Shell only', command: 'shell prompt' }
];

export function NewWorkspaceDialog({
  isOpen,
  folderPath,
  layoutId,
  counts,
  layoutPresets,
  onBrowseFolder,
  onClose,
  onCreate,
  onLayoutChange,
  onCountChange
}: NewWorkspaceDialogProps) {
  const selectedLayout = layoutPresets.find((layout) => layout.id === layoutId) ?? layoutPresets[0];
  const totalPanes = counts.shell + counts.codex + counts.claude;

  const canCreate = useMemo(() => folderPath.length > 0 && totalPanes > 0 && totalPanes <= selectedLayout.maxPanes, [folderPath, selectedLayout.maxPanes, totalPanes]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="workspace-dialog-backdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="workspace-dialog-title"
        className="workspace-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="workspace-dialog__header">
          <div>
            <div className="workspace-dialog__eyebrow">New workspace</div>
            <h2 className="workspace-dialog__title" id="workspace-dialog-title">
              Choose layout and CLI mix
            </h2>
          </div>
          <button className="workspace-dialog__close" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="workspace-dialog__section">
          <label className="workspace-dialog__label">Project folder</label>
          <div className="workspace-dialog__path-row">
            <div className="workspace-dialog__path" title={folderPath || 'No folder selected'}>
              {folderPath || 'Select a project folder'}
            </div>
            <button className="chrome-button" onClick={onBrowseFolder} type="button">
              Browse
            </button>
          </div>
        </div>

        <div className="workspace-dialog__section">
          <label className="workspace-dialog__label">Layout</label>
          <div className="workspace-dialog__layout-grid">
            {layoutPresets.map((layout) => (
              <button
                key={layout.id}
                className={`workspace-dialog__layout-option${layout.id === layoutId ? ' workspace-dialog__layout-option--active' : ''}`}
                onClick={() => onLayoutChange(layout.id)}
                type="button"
              >
                <span>{layout.name}</span>
                <span>{layout.maxPanes} panes</span>
              </button>
            ))}
          </div>
        </div>

        <div className="workspace-dialog__section">
          <div className="workspace-dialog__label-row">
            <label className="workspace-dialog__label">Terminal roles</label>
            <span className="workspace-dialog__capacity">
              {totalPanes}/{selectedLayout.maxPanes}
            </span>
          </div>

          <div className="workspace-dialog__roles">
            {PROFILE_COPY.map((profile) => (
              <div className="workspace-dialog__role-row" key={profile.key}>
                <div>
                  <div className="workspace-dialog__role-title">{profile.label}</div>
                  <div className="workspace-dialog__role-copy">{profile.command}</div>
                </div>
                <div className="workspace-dialog__stepper">
                  <button onClick={() => onCountChange(profile.key, -1)} type="button">
                    −
                  </button>
                  <span>{counts[profile.key]}</span>
                  <button onClick={() => onCountChange(profile.key, 1)} type="button">
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="workspace-dialog__footer">
          <div className="workspace-dialog__hint">Codex and Claude panes launch their CLI automatically inside the selected folder.</div>
          <div className="workspace-dialog__actions">
            <button className="chrome-button" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="chrome-button chrome-button--primary" disabled={!canCreate} onClick={onCreate} type="button">
              Create workspace
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
