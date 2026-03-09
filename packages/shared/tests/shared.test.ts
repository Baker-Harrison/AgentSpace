import { describe, expect, it } from 'vitest';
import { CommandBlockParser, buildGridPositions, createWorkspace, remapPanePositions } from '../src';

describe('layout helpers', () => {
  it('builds positions for presets', () => {
    expect(buildGridPositions('layout_2x2')).toHaveLength(4);
    expect(buildGridPositions('layout_2x2')[3]).toEqual({
      row: 1,
      column: 1,
      rowSpan: 1,
      colSpan: 1
    });
  });

  it('remaps pane positions', () => {
    const positions = remapPanePositions(['pane_a', 'pane_b'], 'layout_1x2');
    expect(positions.pane_a.column).toBe(0);
    expect(positions.pane_b.column).toBe(1);
  });
});

describe('workspace factory', () => {
  it('creates panes for the selected layout', () => {
    const result = createWorkspace('C:/work/project', 'layout_2x2');
    expect(result.workspace.name).toBe('project');
    expect(result.workspace.paneIds).toHaveLength(4);
    expect(Object.keys(result.panes)).toHaveLength(4);
  });
});

describe('command parser', () => {
  it('parses osc markers', () => {
    const parser = new CommandBlockParser();
    const events = parser.parse('\u001b]133;A;pnpm test\u0007hello\u001b]133;D;0\u0007');
    expect(events[0]).toMatchObject({ type: 'start', command: 'pnpm test', source: 'osc' });
    expect(events[1]).toMatchObject({ type: 'output', chunk: 'hello' });
    expect(events[2]).toMatchObject({ type: 'end', exitCode: 0, source: 'osc' });
  });

  it('falls back to input tracking', () => {
    const parser = new CommandBlockParser();
    expect(parser.noteInput('npm run dev\r')).toEqual([{ type: 'start', command: 'npm run dev', source: 'heuristic' }]);
  });
});
