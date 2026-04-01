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

  it('masks api key', async () => {
    configMock.saveConfig({apiKey: '12345678-abcd-1234-abcd-123456789abc'});
    const cap = captureOutput();
    const {default: Cmd} = await import('../../src/commands/config/show.js');
    await Cmd.run([]);
    cap.restore();
    expect(cap.output()).toContain('12345678...');
    expect(cap.output()).not.toContain('12345678-abcd-1234-abcd-123456789abc');
  });
});
