import { describe, expect, it } from 'vitest';
import { getRendererEntry } from '../src/env';
import { getShellOptions } from '../src/shells';

describe('electron env', () => {
  it('returns a renderer entry path or url', () => {
    expect(getRendererEntry()).toContain('index.html');
  });
});

describe('shell discovery', () => {
  it('returns at least one shell option', () => {
    expect(getShellOptions().length).toBeGreaterThan(0);
  });
});
