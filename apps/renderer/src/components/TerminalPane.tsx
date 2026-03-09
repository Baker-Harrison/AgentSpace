import { memo, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import clsx from 'clsx';
import type { CommandBlock, TerminalPane as TerminalPaneModel } from '@agentspaces/shared';
import { CommandBlockList } from './CommandBlockList';

type TerminalPaneProps = {
  pane: TerminalPaneModel;
  blocks: CommandBlock[];
  isActive: boolean;
  onActivate: (paneId: string) => void;
  onToggleBlock: (blockId: string) => void;
};

function compactPath(pathValue: string): string {
  const normalized = pathValue.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 3) {
    return pathValue;
  }

  return `.../${parts.slice(-3).join('/')}`;
}

function TerminalPaneComponent({
  pane,
  blocks,
  isActive,
  onActivate,
  onToggleBlock
}: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const lastGeometryRef = useRef<{ cols: number; rows: number } | null>(null);
  const [showBlocks, setShowBlocks] = useState(false);
  const [search, setSearch] = useState('');

  const filteredBlocks = useMemo(
    () => blocks.filter((block) => block.command.toLowerCase().includes(search.toLowerCase()) || block.output.toLowerCase().includes(search.toLowerCase())),
    [blocks, search]
  );

  const handleActivate = useEffectEvent(() => {
    onActivate(pane.id);
  });

  useEffect(() => {
    if (!terminalRef.current || !surfaceRef.current || xtermRef.current) {
      return;
    }

    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: 'Cascadia Code, JetBrains Mono, monospace',
      fontSize: 14,
      lineHeight: 1.28,
      letterSpacing: 0.2,
      theme: {
        background: '#0a0f18',
        foreground: '#edf4ff',
        cursor: '#63d2ff',
        selectionBackground: '#1a3146'
      }
    });
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    const fitTerminal = () => {
      fitAddon.fit();
      const nextGeometry = { cols: terminal.cols, rows: terminal.rows };
      const lastGeometry = lastGeometryRef.current;
      if (!lastGeometry || lastGeometry.cols !== nextGeometry.cols || lastGeometry.rows !== nextGeometry.rows) {
        lastGeometryRef.current = nextGeometry;
        window.agentSpaces.ptyResize(pane.id, nextGeometry.cols, nextGeometry.rows);
      }
    };

    fitTerminal();
    xtermRef.current = terminal;
    if (isActive) {
      terminal.focus();
    }

    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        fitTerminal();
      });
    });

    resizeObserver.observe(surfaceRef.current);

    const inputDisposable = terminal.onData((data) => {
      handleActivate();
      window.agentSpaces.ptyInput(pane.id, data);
    });

    const outputOff = window.agentSpaces.onPtyData((event) => {
      if (event.paneId === pane.id) {
        terminal.write(event.data);
      }
    });

    const exitOff = window.agentSpaces.onPtyExit((event) => {
      if (event.paneId === pane.id) {
        terminal.writeln(`\r\n[process exited with code ${event.code}]`);
      }
    });

    return () => {
      exitOff();
      outputOff();
      inputDisposable.dispose();
      resizeObserver.disconnect();
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      fitAddonRef.current = null;
      lastGeometryRef.current = null;
      xtermRef.current = null;
      terminal.dispose();
    };
  }, [pane.id]);

  useEffect(() => {
    if (isActive) {
      xtermRef.current?.focus();
    }
  }, [isActive]);

  return (
    <section className={clsx('terminal-pane', isActive && 'terminal-pane--active')} onMouseDown={() => handleActivate()}>
      <header className="terminal-pane__header">
        <div className="terminal-pane__summary">
          <div className="terminal-pane__title" title={pane.title}>
            {pane.title}
          </div>
          <div className="terminal-pane__meta" title={pane.cwd}>
            {compactPath(pane.cwd)} <span className="terminal-pane__meta-separator">•</span> {pane.shellKey || 'shell'}
          </div>
        </div>
      </header>

      <div className="terminal-pane__body">
        <div className="terminal-pane__surface" ref={surfaceRef}>
          <div className="terminal-pane__terminal" ref={terminalRef} />
        </div>

        {showBlocks ? (
          <aside className="command-sheet">
            <div className="command-sheet__toolbar">
              <input
                className="command-sheet__search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter command blocks"
                value={search}
              />
              <button className="command-sheet__button" onClick={() => setShowBlocks(false)} type="button">
                Hide
              </button>
            </div>
            <div className="command-sheet__content">
              <CommandBlockList blocks={filteredBlocks} onToggle={onToggleBlock} />
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function arePanePropsEqual(previous: TerminalPaneProps, next: TerminalPaneProps): boolean {
  const previousPane = previous.pane;
  const nextPane = next.pane;

  if (previous.isActive !== next.isActive) {
    return false;
  }

  if (
    previousPane.id !== nextPane.id ||
    previousPane.title !== nextPane.title ||
    previousPane.cwd !== nextPane.cwd ||
    previousPane.shellKey !== nextPane.shellKey ||
    previousPane.status !== nextPane.status ||
    previousPane.isMaximized !== nextPane.isMaximized ||
    previousPane.layoutPosition.row !== nextPane.layoutPosition.row ||
    previousPane.layoutPosition.column !== nextPane.layoutPosition.column ||
    previousPane.layoutPosition.rowSpan !== nextPane.layoutPosition.rowSpan ||
    previousPane.layoutPosition.colSpan !== nextPane.layoutPosition.colSpan
  ) {
    return false;
  }

  if (previous.blocks.length !== next.blocks.length) {
    return false;
  }

  for (let index = 0; index < previous.blocks.length; index += 1) {
    const previousBlock = previous.blocks[index];
    const nextBlock = next.blocks[index];
    if (
      previousBlock.id !== nextBlock.id ||
      previousBlock.status !== nextBlock.status ||
      previousBlock.collapsed !== nextBlock.collapsed ||
      previousBlock.output !== nextBlock.output
    ) {
      return false;
    }
  }

  return true;
}

export const TerminalPane = memo(TerminalPaneComponent, arePanePropsEqual);
