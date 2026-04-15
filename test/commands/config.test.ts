import {describe, it, expect, vi, beforeEach} from 'vitest';

// Mock the config module
vi.mock('../../src/lib/config.js', () => {
  let store = {
    activeProfile: 'default',
    profiles: {default: {}} as Record<string, Record<string, string>>,
  };
  return {
    loadConfig: () => ({...store, profiles: {...store.profiles}}),
    saveConfig: (full: typeof store) => {
      store = {...full};
    },
    getProfile: (full: typeof store, profileName?: string) => {
      const name = profileName ?? full.activeProfile;
      return full.profiles[name] ?? {};
    },
    getConfigPath: () => '/mock/.config/bitmovin/config.json',
    _reset: () => {
      store = {activeProfile: 'default', profiles: {default: {}}};
    },
    _getStore: () => store,
  };
});

const configMock = await import('../../src/lib/config.js') as any;

function captureOutput(): {output: () => string; restore: () => void} {
  let captured = '';
  const writeMock = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  });
  const logMock = vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
    captured += args.join(' ') + '\n';
  });
  return {
    output: () => captured,
    restore: () => {
      writeMock.mockRestore();
      logMock.mockRestore();
    },
  };
}

describe('config set', () => {
  beforeEach(() => configMock._reset());

  it('sets api-key in the default profile', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/set.js');
    await Cmd.run(['api-key', 'my-test-key']);
    cap.restore();
    expect(cap.output()).toContain('Set api-key');
    expect(configMock._getStore().profiles.default.apiKey).toBe('my-test-key');
  });

  it('sets organization in the default profile', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/set.js');
    await Cmd.run(['organization', 'org-123']);
    cap.restore();
    expect(cap.output()).toContain('Set organization');
    expect(configMock._getStore().profiles.default.tenantOrgId).toBe('org-123');
  });

  it('sets default-region in the default profile', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/set.js');
    await Cmd.run(['default-region', 'AWS_EU_WEST_1']);
    cap.restore();
    expect(configMock._getStore().profiles.default.defaultRegion).toBe('AWS_EU_WEST_1');
  });

  it('sets api-key in a named profile', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/set.js');
    await Cmd.run(['api-key', 'prod-key', '--profile', 'production']);
    cap.restore();
    expect(cap.output()).toContain('profile: production');
    expect(configMock._getStore().profiles.production.apiKey).toBe('prod-key');
  });

  it('creates a new profile when it does not exist', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/set.js');
    await Cmd.run(['api-key', 'staging-key', '--profile', 'staging']);
    cap.restore();
    expect(configMock._getStore().profiles.staging.apiKey).toBe('staging-key');
  });
});

describe('config show', () => {
  beforeEach(() => configMock._reset());

  it('shows config file path', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run([]);
    cap.restore();
    expect(cap.output()).toContain('Config file:');
  });

  it('masks api key', async () => {
    configMock.saveConfig({
      activeProfile: 'default',
      profiles: {default: {apiKey: '12345678-abcd-1234-abcd-123456789abc'}},
    });
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run([]);
    cap.restore();
    expect(cap.output()).toContain('12345678...');
    expect(cap.output()).not.toContain('12345678-abcd-1234-abcd-123456789abc');
  });

  it('shows the active profile label', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run([]);
    cap.restore();
    expect(cap.output()).toContain('default (active)');
  });
});
