import {describe, it, expect, vi, beforeEach} from 'vitest';
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {loadConfig, saveConfig, getProfile, listProfiles, setActiveProfile, deleteProfile} from '../../src/lib/config.js';

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

  it('returns empty default profile when file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const full = loadConfig();
    expect(full.activeProfile).toBe('default');
    expect(full.profiles.default).toEqual({});
  });

  it('parses new-format config', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      activeProfile: 'default',
      profiles: {default: {apiKey: 'abc123', tenantOrgId: 'org1'}},
    }));
    const full = loadConfig();
    expect(full.activeProfile).toBe('default');
    expect(full.profiles.default.apiKey).toBe('abc123');
    expect(full.profiles.default.tenantOrgId).toBe('org1');
  });

  it('migrates legacy flat config into the default profile and rewrites the file', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('{"apiKey":"abc123","tenantOrgId":"org1"}');
    const full = loadConfig();
    expect(full.activeProfile).toBe('default');
    expect(full.profiles.default.apiKey).toBe('abc123');
    expect(full.profiles.default.tenantOrgId).toBe('org1');
    // File must be rewritten in the new format immediately
    expect(writeFileSync).toHaveBeenCalledOnce();
    const written = vi.mocked(writeFileSync).mock.calls[0]![1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.activeProfile).toBe('default');
    expect(parsed.profiles.default.apiKey).toBe('abc123');
  });

  it('parses multiple profiles', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      activeProfile: 'production',
      profiles: {
        default: {apiKey: 'key-default'},
        production: {apiKey: 'key-prod', tenantOrgId: 'org-prod'},
      },
    }));
    const full = loadConfig();
    expect(full.activeProfile).toBe('production');
    expect(full.profiles.production.apiKey).toBe('key-prod');
  });
});

describe('getProfile', () => {
  it('returns the active profile when no name given', () => {
    const full = {
      activeProfile: 'production',
      profiles: {
        default: {apiKey: 'key-default'},
        production: {apiKey: 'key-prod'},
      },
    };
    expect(getProfile(full).apiKey).toBe('key-prod');
  });

  it('returns the named profile', () => {
    const full = {
      activeProfile: 'default',
      profiles: {
        default: {apiKey: 'key-default'},
        staging: {apiKey: 'key-staging'},
      },
    };
    expect(getProfile(full, 'staging').apiKey).toBe('key-staging');
  });

  it('returns empty object for unknown profile', () => {
    const full = {activeProfile: 'default', profiles: {default: {apiKey: 'k'}}};
    expect(getProfile(full, 'nonexistent')).toEqual({});
  });
});

describe('saveConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates config directory and writes file', () => {
    saveConfig({activeProfile: 'default', profiles: {default: {apiKey: 'test-key'}}});
    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining('bitmovin'), {recursive: true});
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      expect.stringContaining('"apiKey": "test-key"'),
    );
  });

  it('preserves all profile fields', () => {
    saveConfig({
      activeProfile: 'default',
      profiles: {default: {apiKey: 'key', tenantOrgId: 'org', defaultRegion: 'EU'}},
    });
    const written = vi.mocked(writeFileSync).mock.calls[0]![1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.profiles.default.apiKey).toBe('key');
    expect(parsed.profiles.default.tenantOrgId).toBe('org');
    expect(parsed.profiles.default.defaultRegion).toBe('EU');
  });

  it('writes multiple profiles', () => {
    saveConfig({
      activeProfile: 'prod',
      profiles: {
        default: {apiKey: 'key-a'},
        prod: {apiKey: 'key-b', tenantOrgId: 'org-b'},
      },
    });
    const written = vi.mocked(writeFileSync).mock.calls[0]![1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.activeProfile).toBe('prod');
    expect(parsed.profiles.default.apiKey).toBe('key-a');
    expect(parsed.profiles.prod.apiKey).toBe('key-b');
  });
});

describe('listProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all profiles with correct active flag', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      activeProfile: 'default',
      profiles: {
        default: {apiKey: 'k1'},
        prod: {apiKey: 'k2'},
      },
    }));
    const profiles = listProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles.find(p => p.name === 'default')?.active).toBe(true);
    expect(profiles.find(p => p.name === 'prod')?.active).toBe(false);
  });
});

describe('setActiveProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches the active profile', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      activeProfile: 'default',
      profiles: {default: {}, prod: {apiKey: 'k'}},
    }));
    setActiveProfile('prod');
    const written = vi.mocked(writeFileSync).mock.calls[0]![1] as string;
    expect(JSON.parse(written).activeProfile).toBe('prod');
  });

  it('throws when profile does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      activeProfile: 'default',
      profiles: {default: {}},
    }));
    expect(() => setActiveProfile('nonexistent')).toThrow("Profile 'nonexistent' does not exist");
  });
});

describe('deleteProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when deleting the default profile', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      activeProfile: 'default',
      profiles: {default: {}},
    }));
    expect(() => deleteProfile('default')).toThrow("Cannot delete the 'default' profile");
  });

  it('deletes a non-default profile', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      activeProfile: 'default',
      profiles: {default: {}, staging: {apiKey: 'k'}},
    }));
    deleteProfile('staging');
    const written = vi.mocked(writeFileSync).mock.calls[0]![1] as string;
    expect(JSON.parse(written).profiles.staging).toBeUndefined();
  });

  it('resets activeProfile to default when the active profile is deleted', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      activeProfile: 'staging',
      profiles: {default: {}, staging: {apiKey: 'k'}},
    }));
    deleteProfile('staging');
    const written = vi.mocked(writeFileSync).mock.calls[0]![1] as string;
    expect(JSON.parse(written).activeProfile).toBe('default');
  });
});
