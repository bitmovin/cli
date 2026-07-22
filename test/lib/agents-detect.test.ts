import {describe, expect, it} from 'vitest';
import {findOnPath} from '../../src/lib/agents/detect.js';

describe('findOnPath', () => {
  it('resolves a binary from PATH on posix', () => {
    const files = new Set(['/usr/local/bin/claude']);
    const result = findOnPath('claude', {
      platform: 'darwin',
      path: '/opt/homebrew/bin:/usr/local/bin',
      exists: file => files.has(file),
    });
    expect(result).toBe('/usr/local/bin/claude');
  });

  it('returns undefined when the binary is missing', () => {
    expect(findOnPath('claude', {platform: 'linux', path: '/usr/bin', exists: () => false})).toBeUndefined();
  });

  it('honors PATHEXT on win32', () => {
    const files = new Set(['C:\\tools\\claude.CMD']);
    const result = findOnPath('claude', {
      platform: 'win32',
      path: 'C:\\tools',
      pathext: '.EXE;.CMD',
      exists: file => files.has(file),
    });
    expect(result).toBe('C:\\tools\\claude.CMD');
  });

  it('respects first-match PATH ordering', () => {
    const files = new Set(['/a/bin/codex', '/b/bin/codex']);
    expect(findOnPath('codex', {platform: 'linux', path: '/a/bin:/b/bin', exists: file => files.has(file)})).toBe('/a/bin/codex');
  });
});
