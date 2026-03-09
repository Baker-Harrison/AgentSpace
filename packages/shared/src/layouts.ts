import type { LayoutPreset, PanePosition } from './types';

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: 'layout_1x1', name: '1x1', rows: 1, columns: 1, maxPanes: 1 },
  { id: 'layout_1x2', name: '1x2', rows: 1, columns: 2, maxPanes: 2 },
  { id: 'layout_2x2', name: '2x2', rows: 2, columns: 2, maxPanes: 4 },
  { id: 'layout_2x3', name: '2x3', rows: 2, columns: 3, maxPanes: 6 },
  { id: 'layout_3x3', name: '3x3', rows: 3, columns: 3, maxPanes: 9 },
  { id: 'layout_4x4', name: '4x4', rows: 4, columns: 4, maxPanes: 16 }
];

export function getLayoutPreset(layoutId: string): LayoutPreset {
  const preset = LAYOUT_PRESETS.find((entry) => entry.id === layoutId);
  if (!preset) {
    throw new Error(`Unknown layout preset: ${layoutId}`);
  }
  return preset;
}

export function buildGridPositions(layoutId: string): PanePosition[] {
  const layout = getLayoutPreset(layoutId);
  const positions: PanePosition[] = [];

  for (let row = 0; row < layout.rows; row += 1) {
    for (let column = 0; column < layout.columns; column += 1) {
      positions.push({ row, column, rowSpan: 1, colSpan: 1 });
    }
  }

  return positions;
}
