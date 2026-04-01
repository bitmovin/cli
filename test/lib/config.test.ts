import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {loadConfig, saveConfig} from '../../src/lib/config.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
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
  });

  it('creates config directory and writes file', () => {
    saveConfig({apiKey: 'test-key'});
    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining('bitmovin'), {recursive: true});
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      expect.stringContaining('"apiKey": "test-key"'),
    );
  });

  it('preserves all config fields', () => {
    saveConfig({apiKey: 'key', tenantOrgId: 'org', defaultRegion: 'EU'});
    const written = vi.mocked(writeFileSync).mock.calls[0]![1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.apiKey).toBe('key');
    expect(parsed.tenantOrgId).toBe('org');
    expect(parsed.defaultRegion).toBe('EU');
  });
});
