import path from 'node:path';

export function getRendererEntry(): string {
  return process.env.ELECTRON_RENDERER_URL ?? `file://${path.join(__dirname, '../renderer/index.html')}`;
}
