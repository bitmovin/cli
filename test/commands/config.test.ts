import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

// Mock the config module
vi.mock('../../src/lib/config.js', () => {
  let store: Record<string, any> = {};
  return {
    loadConfig: () => ({...store}),
    saveConfig: (config: any) => {
      store = {...config};
    },
    getConfigPath: () => '/mock/.config/bitmovin/config.json',
    _reset: () => {
      store = {};
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

  it('refuses an empty value, which would be stored and then mean nothing', async () => {
    // A stored organization of "" resolved to "no organization" at request time while
    // still looking set in `config show`, and it made `create` send an empty
    // organizationId with no matching X-Tenant-Org-Id header.
    const {default: Cmd} = await import('../../src/commands/config/set.js');
    await expect(Cmd.run(['organization', ''])).rejects.toThrow(/cannot be set to an empty value/);
    expect(configMock._getStore().tenantOrgId).toBeUndefined();
  });

  it('sets api-key', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/set.js');
    await Cmd.run(['api-key', 'my-test-key']);
    cap.restore();
    expect(cap.output()).toContain('Set api-key');
    expect(configMock._getStore().apiKey).toBe('my-test-key');
  });

  it('sets organization', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/set.js');
    await Cmd.run(['organization', 'org-123']);
    cap.restore();
    expect(cap.output()).toContain('Set organization');
    expect(configMock._getStore().tenantOrgId).toBe('org-123');
  });

  it('sets default-region', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/set.js');
    await Cmd.run(['default-region', 'AWS_EU_WEST_1']);
    cap.restore();
    expect(cap.output()).toContain('Set default-region');
    expect(configMock._getStore().defaultRegion).toBe('AWS_EU_WEST_1');
  });
});

describe('config show', () => {
  const originalEnv = process.env.BITMOVIN_API_KEY;

  beforeEach(() => {
    configMock._reset();
    delete process.env.BITMOVIN_API_KEY;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BITMOVIN_API_KEY;
    } else {
      process.env.BITMOVIN_API_KEY = originalEnv;
    }
  });

  it('shows config file path', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run([]);
    cap.restore();
    expect(cap.output()).toContain('Config file:');
  });

  it('masks api key from config file', async () => {
    configMock.saveConfig({apiKey: '12345678-abcd-1234-abcd-123456789abc'});
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run([]);
    cap.restore();
    expect(cap.output()).toContain('1234...9abc');
    expect(cap.output()).toContain('config file');
    expect(cap.output()).not.toContain('12345678-abcd-1234-abcd-123456789abc');
  });

  it('reports BITMOVIN_API_KEY env var when set, taking precedence over config file', async () => {
    configMock.saveConfig({apiKey: '12345678-abcd-1234-abcd-123456789abc'});
    process.env.BITMOVIN_API_KEY = 'eeeeeeee-cafe-dead-beef-feedfacefeed';
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run([]);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('eeee...feed');
    expect(out).toContain('BITMOVIN_API_KEY env var');
    expect(out).not.toContain('1234...9abc');
    expect(out).not.toContain('config file');
  });

  it('reports --api-key flag when set, taking precedence over env and config file', async () => {
    configMock.saveConfig({apiKey: '12345678-abcd-1234-abcd-123456789abc'});
    process.env.BITMOVIN_API_KEY = 'eeeeeeee-cafe-dead-beef-feedfacefeed';
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run(['--api-key', 'ffffffff-cafe-dead-beef-feedfacefeed']);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('ffff...feed');
    expect(out).toContain('--api-key flag');
    expect(out).not.toContain('eeee...feed');
    expect(out).not.toContain('1234...9abc');
  });

  it('reports (not set) when neither env nor config has a key', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run([]);
    cap.restore();
    expect(cap.output()).toContain('API Key:        (not set)');
  });

  it('exposes config-file apiKeySource in --json mode', async () => {
    configMock.saveConfig({apiKey: 'abcdefgh-1111-2222-3333-444455556666'});
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.apiKeySource).toBe('config-file');
    expect(data.apiKey).toBe('abcd...6666');
  });

  it('exposes env apiKeySource in --json mode when BITMOVIN_API_KEY is set', async () => {
    configMock.saveConfig({apiKey: '12345678-abcd-1234-abcd-123456789abc'});
    process.env.BITMOVIN_API_KEY = 'eeeeeeee-cafe-dead-beef-feedfacefeed';
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.apiKeySource).toBe('env');
    expect(data.apiKey).toBe('eeee...feed');
  });

  it('exposes none apiKeySource in --json mode and null apiKey when unset', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.apiKeySource).toBe('none');
    expect(data.apiKey).toBeNull();
  });

  it('reports OAuth session in text mode when one is stored', async () => {
    configMock.saveConfig({
      oauth: {
        accessToken: 'tok',
        expiresAt: new Date('2099-01-01T00:00:00Z').getTime(),
        user: {email: 'me@example.com'},
      },
    });
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run([]);
    cap.restore();
    expect(cap.output()).toContain('OAuth:');
    expect(cap.output()).toContain('me@example.com');
    expect(cap.output()).toContain('2099-01-01T00:00:00.000Z');
  });

  it('flags an expired OAuth session in text mode', async () => {
    configMock.saveConfig({
      oauth: {
        accessToken: 'tok',
        expiresAt: 1, // 1970 — definitely expired
        user: {email: 'me@example.com'},
      },
    });
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run([]);
    cap.restore();
    expect(cap.output()).toContain('expired');
  });

  it('exposes OAuth metadata in --json mode', async () => {
    configMock.saveConfig({
      oauth: {
        accessToken: 'tok',
        refreshToken: 'refresh',
        expiresAt: new Date('2099-01-01T00:00:00Z').getTime(),
        scope: 'openid email',
        user: {email: 'me@example.com', sub: 'auth0|123'},
      },
    });
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.oauth).toMatchObject({
      user: {email: 'me@example.com', sub: 'auth0|123'},
      hasRefreshToken: true,
      expired: false,
      scope: 'openid email',
    });
    expect(data.oauth.expiresAt).toBe('2099-01-01T00:00:00.000Z');
  });

  it('reports oauth as null in --json mode when not logged in', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.oauth).toBeNull();
  });

  it('treats empty API key values as unset in config show output', async () => {
    configMock.saveConfig({apiKey: '12345678-abcd-1234-abcd-123456789abc'});
    process.env.BITMOVIN_API_KEY = '';
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.apiKeySource).toBe('none');
    expect(data.apiKey).toBeNull();
  });
});
