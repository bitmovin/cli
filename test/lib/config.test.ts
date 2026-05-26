import {describe, it, expect, vi, beforeEach} from 'vitest';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import {loadConfig, saveConfig} from '../../src/lib/config.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  openSync: vi.fn(),
  writeSync: vi.fn(),
  closeSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty config when file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(loadConfig()).toEqual({});
  });

  it('parses config from file', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('{"apiKey":"abc123","tenantOrgId":"org1"}');
    const config = loadConfig();
    expect(config.apiKey).toBe('abc123');
    expect(config.tenantOrgId).toBe('org1');
  });
});

describe('saveConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(openSync).mockReturnValue(7);
  });

  it('creates config directory and writes file atomically with 0600 perms', () => {
    saveConfig({apiKey: 'test-key'});
    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining('bitmovin'), {recursive: true});
    // open(tmp, 'w', 0o600) — restrictive mode set atomically at create time
    expect(openSync).toHaveBeenCalledWith(
      expect.stringMatching(/config\.json\.tmp\.\d+$/),
      'w',
      0o600,
    );
    const writtenPayload = vi.mocked(writeSync).mock.calls[0]![1] as string;
    expect(writtenPayload).toContain('"apiKey": "test-key"');
    expect(closeSync).toHaveBeenCalledWith(7);
    expect(renameSync).toHaveBeenCalledWith(
      expect.stringMatching(/config\.json\.tmp\.\d+$/),
      expect.stringMatching(/config\.json$/),
    );
  });

  it('preserves all config fields', () => {
    saveConfig({apiKey: 'key', tenantOrgId: 'org', defaultRegion: 'EU'});
    const written = vi.mocked(writeSync).mock.calls[0]![1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.apiKey).toBe('key');
    expect(parsed.tenantOrgId).toBe('org');
    expect(parsed.defaultRegion).toBe('EU');
  });

  it('cleans up the tmp file when rename fails', () => {
    vi.mocked(renameSync).mockImplementationOnce(() => {
      throw new Error('rename failed');
    });
    expect(() => saveConfig({apiKey: 'k'})).toThrow('rename failed');
    expect(unlinkSync).toHaveBeenCalledWith(expect.stringMatching(/config\.json\.tmp\.\d+$/));
  });
});
