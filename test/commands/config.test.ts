import {describe, it, expect, vi, beforeEach} from 'vitest';

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
  beforeEach(() => configMock._reset());

  it('shows config file path', async () => {
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run([]);
    cap.restore();
    expect(cap.output()).toContain('Config file:');
  });

  it('masks api key from config file', async () => {
    delete process.env.BITMOVIN_API_KEY;
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
    try {
      const cap = captureOutput();
      const {default: Cmd} = await import('../../src/commands/config/show.js');
      await Cmd.run([]);
      cap.restore();
      const out = cap.output();
      expect(out).toContain('eeee...feed');
      expect(out).toContain('BITMOVIN_API_KEY env var');
      expect(out).not.toContain('1234...9abc');
    } finally {
      delete process.env.BITMOVIN_API_KEY;
    }
  });

  it('reports (not set) when neither env nor config has a key', async () => {
    delete process.env.BITMOVIN_API_KEY;
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run([]);
    cap.restore();
    expect(cap.output()).toContain('API Key:        (not set)');
  });

  it('exposes apiKeySource in --json mode', async () => {
    delete process.env.BITMOVIN_API_KEY;
    configMock.saveConfig({apiKey: 'abcdefgh-1111-2222-3333-444455556666'});
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.apiKeySource).toBe('config-file');
    expect(data.apiKey).toBe('abcd...6666');
  });
});
