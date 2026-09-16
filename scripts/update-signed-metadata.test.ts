import { describe, expect, it } from 'vitest';
// @ts-expect-error - build tooling, plain JS with no types
import { updateLatestYml } from './update-signed-metadata.mjs';

const doc = {
  version: '0.1.5',
  files: [{ url: 'ai-usage-setup-0.1.5.exe', sha512: 'before', size: 100 }],
  path: 'ai-usage-setup-0.1.5.exe',
  sha512: 'before',
  releaseDate: '2026-09-16T03:20:46.531Z',
};

describe('updateLatestYml', () => {
  it('replaces the hash and size of every listed file', () => {
    const next = updateLatestYml(doc, new Map([['ai-usage-setup-0.1.5.exe', { sha512: 'after', size: 123 }]]));
    expect(next.files).toEqual([{ url: 'ai-usage-setup-0.1.5.exe', sha512: 'after', size: 123 }]);
  });

  it('keeps the legacy top-level sha512 in step with the file latest.yml points at', () => {
    const next = updateLatestYml(doc, new Map([['ai-usage-setup-0.1.5.exe', { sha512: 'after', size: 123 }]]));
    expect(next.sha512).toBe('after');
  });

  it('leaves everything else, and the input, untouched', () => {
    const next = updateLatestYml(doc, new Map([['ai-usage-setup-0.1.5.exe', { sha512: 'after', size: 123 }]]));
    expect(next.version).toBe('0.1.5');
    expect(next.releaseDate).toBe('2026-09-16T03:20:46.531Z');
    expect(doc.sha512).toBe('before');
  });

  it('refuses to write a half-updated file when one is missing', () => {
    expect(() => updateLatestYml(doc, new Map())).toThrow(/was not measured/);
  });
});
