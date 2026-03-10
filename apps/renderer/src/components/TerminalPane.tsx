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
  showActiveState: boolean;
  allowAutoFocus: boolean;
  onActivate: (paneId: string) => void;
  onToggleBlock: (blockId: string) => void;
};

type TerminalMetrics = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

function compactPath(pathValue: string): string {
  const normalized = pathValue.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 3) {
    return pathValue;
  }

  return `.../${parts.slice(-3).join('/')}`;
}

function getTerminalMetrics(width: number, height: number): TerminalMetrics {
  if (width < 340 || height < 230) {
    return {
      fontSize: 11,
      lineHeight: 1.14,
      letterSpacing: 0
    };
  }

  if (width < 460 || height < 300) {
    return {
      fontSize: 12,
      lineHeight: 1.18,
      letterSpacing: 0.1
    };
  }

  return {
    fontSize: 14,
    lineHeight: 1.28,
    letterSpacing: 0.2
  };
}

function TerminalPaneComponent({
  pane,
  blocks,
  isActive,
  showActiveState,
  allowAutoFocus,
  onActivate,
  onToggleBlock
}: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const resizeTimeoutRef = useRef<number | null>(null);
  const bootstrapTimeoutRef = useRef<number | null>(null);
  const lastGeometryRef = useRef<{ cols: number; rows: number } | null>(null);
  const lastMetricsRef = useRef<TerminalMetrics | null>(null);
  const lastSurfaceSizeRef = useRef<{ width: number; height: number } | null>(null);
  const bracketedPasteEnabledRef = useRef(false);
  const interactionTimerRef = useRef<number | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);
  const [search, setSearch] = useState('');
  const [dropActive, setDropActive] = useState(false);
  const [interactionMessage, setInteractionMessage] = useState<string | null>(null);

  const filteredBlocks = useMemo(
    () => blocks.filter((block) => block.command.toLowerCase().includes(search.toLowerCase()) || block.output.toLowerCase().includes(search.toLowerCase())),
    [blocks, search]
  );

  const handleActivate = useEffectEvent(() => {
    onActivate(pane.id);
  });

  const setTransientMessage = useEffectEvent((message: string | null) => {
    if (interactionTimerRef.current !== null) {
      window.clearTimeout(interactionTimerRef.current);
      interactionTimerRef.current = null;
    }

    setInteractionMessage(message);
    if (message) {
      interactionTimerRef.current = window.setTimeout(() => {
        interactionTimerRef.current = null;
        setInteractionMessage(null);
      }, 2200);
    }
  });

  const sendTerminalInput = useEffectEvent((data: string, asPaste = false) => {
    if (!data) {
      return;
    }

    handleActivate();
    if (asPaste && bracketedPasteEnabledRef.current) {
      window.agentSpaces.ptyInput(pane.id, `\u001b[200~${data}\u001b[201~`);
      return;
    }

    window.agentSpaces.ptyInput(pane.id, data);
  });

  const insertPaths = useEffectEvent((paths: string[]) => {
    if (paths.length === 0) {
      return;
    }

    const payload = paths.map((entry) => `"${entry.replace(/"/g, '\\"')}"`).join(' ');
    sendTerminalInput(payload, true);
    setTransientMessage(paths.length === 1 ? 'Attached asset path' : `Attached ${paths.length} asset paths`);
  });

  const persistFilesToPane = useEffectEvent(async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const persistedPaths: string[] = [];
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }

      const result = await window.agentSpaces.stagePaneAsset({
        paneId: pane.id,
        fileName: file.name || `attachment-${Date.now()}`,
        mimeType: file.type || 'application/octet-stream',
        base64Data: btoa(binary)
      });
      persistedPaths.push(result.path);
    }

    insertPaths(persistedPaths);
  });

  const handleTransfer = useEffectEvent(async (transfer: DataTransfer | null) => {
    if (!transfer) {
      return;
    }

    const files = Array.from(transfer.files ?? []);
    if (files.length > 0) {
      await persistFilesToPane(files);
      return;
    }

    const text = transfer.getData('text/plain');
    if (text) {
      sendTerminalInput(text, true);
      setTransientMessage('Pasted text');
    }
  });

  useEffect(() => {
    if (!terminalRef.current || !surfaceRef.current || xtermRef.current) {
      return;
    }

    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      fastScrollModifier: 'alt',
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
    const fitTerminal = (force = false) => {
      const surfaceWidth = surfaceRef.current?.clientWidth ?? 0;
      const surfaceHeight = surfaceRef.current?.clientHeight ?? 0;
      if (surfaceWidth <= 0 || surfaceHeight <= 0) {
        return;
      }

      const previousSurfaceSize = lastSurfaceSizeRef.current;
      if (
        !force &&
        previousSurfaceSize &&
        previousSurfaceSize.width === surfaceWidth &&
        previousSurfaceSize.height === surfaceHeight
      ) {
        return;
      }
      lastSurfaceSizeRef.current = { width: surfaceWidth, height: surfaceHeight };

      const nextMetrics = getTerminalMetrics(surfaceWidth, surfaceHeight);
      const lastMetrics = lastMetricsRef.current;
      if (
        !lastMetrics ||
        lastMetrics.fontSize !== nextMetrics.fontSize ||
        lastMetrics.lineHeight !== nextMetrics.lineHeight ||
        lastMetrics.letterSpacing !== nextMetrics.letterSpacing
      ) {
        terminal.options.fontSize = nextMetrics.fontSize;
        terminal.options.lineHeight = nextMetrics.lineHeight;
        terminal.options.letterSpacing = nextMetrics.letterSpacing;
        lastMetricsRef.current = nextMetrics;
      }

      fitAddon.fit();
      const nextGeometry = { cols: terminal.cols, rows: terminal.rows };
      if (nextGeometry.cols <= 0 || nextGeometry.rows <= 0) {
        return;
      }
      const lastGeometry = lastGeometryRef.current;
      if (!lastGeometry || lastGeometry.cols !== nextGeometry.cols || lastGeometry.rows !== nextGeometry.rows) {
        lastGeometryRef.current = nextGeometry;
        window.agentSpaces.ptyResize(pane.id, nextGeometry.cols, nextGeometry.rows);
      }

      setTerminalReady(true);
    };

    const scheduleFit = (immediate = false) => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
      }

      const queueFit = () => {
        resizeFrameRef.current = requestAnimationFrame(() => {
          resizeFrameRef.current = null;
          fitTerminal(immediate);
        });
      };

      if (immediate) {
        queueFit();
        return;
      }

      resizeTimeoutRef.current = window.setTimeout(() => {
        resizeTimeoutRef.current = null;
        queueFit();
        bootstrapTimeoutRef.current = window.setTimeout(() => {
          bootstrapTimeoutRef.current = null;
          fitTerminal();
        }, 120);
      }, 90);
    };

    scheduleFit(true);
    bootstrapTimeoutRef.current = window.setTimeout(() => {
      bootstrapTimeoutRef.current = null;
      resizeTimeoutRef.current = window.setTimeout(() => {
          resizeTimeoutRef.current = null;
          fitTerminal();
      }, 140);
    }, 120);

    xtermRef.current = terminal;
    if (isActive && allowAutoFocus) {
      terminal.focus();
    }

    const resizeObserver = new ResizeObserver(() => {
      scheduleFit();
    });

    const handleWindowResize = () => {
      scheduleFit();
    };

    resizeObserver.observe(surfaceRef.current);
    window.addEventListener('resize', handleWindowResize);

    const inputDisposable = terminal.onData((data) => {
      sendTerminalInput(data);
    });

    const outputOff = window.agentSpaces.onPtyData((event) => {
      if (event.paneId === pane.id) {
        if (/\u001b\[\?2004h/.test(event.data)) {
          bracketedPasteEnabledRef.current = true;
        }
        if (/\u001b\[\?2004l/.test(event.data)) {
          bracketedPasteEnabledRef.current = false;
        }
        terminal.write(event.data);
      }
    });

    const exitOff = window.agentSpaces.onPtyExit((event) => {
      if (event.paneId === pane.id) {
        terminal.writeln(`\r\n[process exited with code ${event.code}]`);
      }
    });

    const surface = surfaceRef.current;
    const handlePaste = (event: ClipboardEvent) => {
      event.preventDefault();
      void handleTransfer(event.clipboardData);
    };
    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      setDropActive(true);
      handleActivate();
    };
    const handleDragLeave = (event: DragEvent) => {
      if (event.relatedTarget instanceof Node && surface?.contains(event.relatedTarget)) {
        return;
      }

      setDropActive(false);
    };
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      setDropActive(false);
      void handleTransfer(event.dataTransfer);
    };

    surface?.addEventListener('paste', handlePaste);
    surface?.addEventListener('dragover', handleDragOver);
    surface?.addEventListener('dragleave', handleDragLeave);
    surface?.addEventListener('drop', handleDrop);

    return () => {
      exitOff();
      outputOff();
      inputDisposable.dispose();
      surface?.removeEventListener('paste', handlePaste);
      surface?.removeEventListener('dragover', handleDragOver);
      surface?.removeEventListener('dragleave', handleDragLeave);
      surface?.removeEventListener('drop', handleDrop);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      if (bootstrapTimeoutRef.current !== null) {
        window.clearTimeout(bootstrapTimeoutRef.current);
        bootstrapTimeoutRef.current = null;
      }
      if (interactionTimerRef.current !== null) {
        window.clearTimeout(interactionTimerRef.current);
        interactionTimerRef.current = null;
      }
      bracketedPasteEnabledRef.current = false;
      fitAddonRef.current = null;
      lastGeometryRef.current = null;
      lastMetricsRef.current = null;
      lastSurfaceSizeRef.current = null;
      xtermRef.current = null;
      terminal.dispose();
    };
  }, [pane.id]);

  useEffect(() => {
    if (isActive && allowAutoFocus) {
      xtermRef.current?.focus();
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        fitAddonRef.current?.fit();
        const terminal = xtermRef.current;
        if (!terminal) {
          return;
        }

        const nextGeometry = { cols: terminal.cols, rows: terminal.rows };
        const lastGeometry = lastGeometryRef.current;
        if (!lastGeometry || lastGeometry.cols !== nextGeometry.cols || lastGeometry.rows !== nextGeometry.rows) {
          lastGeometryRef.current = nextGeometry;
          window.agentSpaces.ptyResize(pane.id, nextGeometry.cols, nextGeometry.rows);
        }
        setTerminalReady(true);
      });
    }
  }, [isActive, pane.id]);

  return (
    <section
      className={clsx('terminal-pane', isActive && showActiveState && 'terminal-pane--active')}
      onMouseDown={() => handleActivate()}
    >
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
        <div
          className={clsx(
            'terminal-pane__surface',
            terminalReady && 'terminal-pane__surface--ready',
            dropActive && 'terminal-pane__surface--drop-active'
          )}
          ref={surfaceRef}
        >
          <div className="terminal-pane__terminal" ref={terminalRef} />
          {dropActive ? <div className="terminal-pane__drop-indicator">Drop files or paste images to attach them</div> : null}
          {interactionMessage ? <div className="terminal-pane__interaction-toast">{interactionMessage}</div> : null}
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

  if (previous.showActiveState !== next.showActiveState || previous.allowAutoFocus !== next.allowAutoFocus) {
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
