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
    getClient();
    expect(lastConstructorArgs.apiKey).toBe('env-var-key');
  });

  it('prefers override over env var', async () => {
    process.env.BITMOVIN_API_KEY = 'env-var-key';
    const {getClient} = await import('../../src/lib/client.js');
    getClient('override-key');
    expect(lastConstructorArgs.apiKey).toBe('override-key');
  });

  it('falls back to config file when env var is not set', async () => {
    delete process.env.BITMOVIN_API_KEY;
    const {getClient} = await import('../../src/lib/client.js');
    getClient();
    expect(lastConstructorArgs.apiKey).toBe('config-file-key');
  });
});
