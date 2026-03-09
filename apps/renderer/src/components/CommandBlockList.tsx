import clsx from 'clsx';
import type { CommandBlock } from '@agentspaces/shared';
import { formatDuration, formatTime } from '../lib/time';

type CommandBlockListProps = {
  blocks: CommandBlock[];
  onToggle: (blockId: string) => void;
};

function statusTone(status: CommandBlock['status']): string {
  switch (status) {
    case 'succeeded':
      return 'text-emerald-300';
    case 'failed':
      return 'text-rose-300';
    case 'interrupted':
      return 'text-amber-300';
    default:
      return 'text-cyan-300';
  }
}

export function CommandBlockList({ blocks, onToggle }: CommandBlockListProps) {
  if (blocks.length === 0) {
    return <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No command blocks yet for this pane.</div>;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <article key={block.id} className="rounded-2xl border border-white/10 bg-slate-950/80 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
          <button
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
            onClick={() => onToggle(block.id)}
            type="button"
          >
            <div>
              <div className="font-mono text-sm text-white">{block.command || '(empty command)'}</div>
              <div className="mt-1 text-xs text-slate-400">
                {formatTime(block.startedAt)} · {formatDuration(block.startedAt, block.finishedAt)} · {block.source}
              </div>
            </div>
            <div className={clsx('text-xs uppercase tracking-[0.2em]', statusTone(block.status))}>{block.status}</div>
          </button>
          {!block.collapsed ? (
            <pre className="overflow-x-auto border-t border-white/6 px-4 py-3 whitespace-pre-wrap text-xs text-slate-200">{block.output || 'No captured output.'}</pre>
          ) : (
            <div className="border-t border-white/6 px-4 py-3 text-xs text-slate-400">
              exit {block.exitCode ?? 'n/a'} · {formatDuration(block.startedAt, block.finishedAt)}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
