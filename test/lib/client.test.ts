import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

// Mock the config module
vi.mock('../../src/lib/config.js', () => ({
  loadConfig: () => ({apiKey: 'config-file-key'}),
  saveConfig: () => {},
  getConfigPath: () => '/mock/.config/bitmovin/config.json',
}));

// Mock the Bitmovin API SDK — capture the constructor args
let lastConstructorArgs: any;
vi.mock('@bitmovin/api-sdk', () => {
  class MockBitmovinApi {
    constructor(config: any) {
      lastConstructorArgs = config;
    }
  }
  return {default: MockBitmovinApi};
});

describe('getClient with BITMOVIN_API_KEY env var', () => {
  const originalEnv = process.env.BITMOVIN_API_KEY;

  beforeEach(() => {
    lastConstructorArgs = undefined;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BITMOVIN_API_KEY;
    } else {
      process.env.BITMOVIN_API_KEY = originalEnv;
    }
  });

  it('uses env var when no override is provided', async () => {
    process.env.BITMOVIN_API_KEY = 'env-var-key';
    // Re-import to get fresh module
    const {getClient} = await import('../../src/lib/client.js');
    await getClient();
    expect(lastConstructorArgs.apiKey).toBe('env-var-key');
  });

  it('prefers override over env var', async () => {
    process.env.BITMOVIN_API_KEY = 'env-var-key';
    const {getClient} = await import('../../src/lib/client.js');
    await getClient('override-key');
    expect(lastConstructorArgs.apiKey).toBe('override-key');
  });

  it('falls back to config file when env var is not set', async () => {
    delete process.env.BITMOVIN_API_KEY;
    const {getClient} = await import('../../src/lib/client.js');
    await getClient();
    expect(lastConstructorArgs.apiKey).toBe('config-file-key');
  });

  it('preserves empty override precedence instead of falling back', async () => {
    process.env.BITMOVIN_API_KEY = 'env-var-key';
    const {getClient} = await import('../../src/lib/client.js');
    await expect(getClient('')).rejects.toThrow('No credentials configured');
    expect(lastConstructorArgs).toBeUndefined();
  });

  it('preserves empty env var precedence instead of falling back to config', async () => {
    process.env.BITMOVIN_API_KEY = '';
    const {getClient} = await import('../../src/lib/client.js');
    await expect(getClient()).rejects.toThrow('No credentials configured');
    expect(lastConstructorArgs).toBeUndefined();
  });

  it('overrides the SDK X-Api-Client headers with CLI identification', async () => {
    process.env.BITMOVIN_API_KEY = 'env-var-key';
    const {getClient} = await import('../../src/lib/client.js');
    await getClient();
    const pkg = await import('../../package.json');
    expect(lastConstructorArgs.headers['X-Api-Client']).toBe('bitmovin-cli');
    expect(lastConstructorArgs.headers['X-Api-Client-Version']).toBe(pkg.default.version);
  });
});

describe('getClient tenant organization', () => {
  beforeEach(() => {
    lastConstructorArgs = undefined;
    process.env.BITMOVIN_API_KEY = 'env-var-key';
  });

  afterEach(() => {
    delete process.env.BITMOVIN_API_KEY;
  });

  it('passes an explicit organization to the SDK', async () => {
    // This is what stops `--organization` from being declared on an SDK-backed
    // command and then silently ignored: previously getClient only ever used the
    // configured organization, so the flag could not be honoured at all.
    const {getClient} = await import('../../src/lib/client.js');
    await getClient(undefined, 'sub-org-9');

    expect(lastConstructorArgs.tenantOrgId).toBe('sub-org-9');
  });

  it('omits the organization entirely when neither flag nor config supplies one', async () => {
    const {getClient} = await import('../../src/lib/client.js');
    await getClient();

    expect(lastConstructorArgs.tenantOrgId).toBeUndefined();
  });
});
