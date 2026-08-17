import {describe, it, expect, vi, beforeEach} from 'vitest';

/**
 * `getAuthHeaders` is the credential path for every REST-helper call (the support
 * ticket commands). It is stubbed wherever `rest.ts` is tested, so without these
 * tests it could be changed to send no credential at all — or the wrong
 * principal's — with the whole suite still green.
 */

const config: {apiKey?: string; oauth?: unknown; tenantOrgId?: string} = {};

vi.mock('../../src/lib/config.js', () => ({
  loadConfig: () => config,
  saveConfig: () => {},
  getConfigPath: () => '/mock/.config/bitmovin/config.json',
}));

beforeEach(() => {
  delete config.apiKey;
  delete config.oauth;
  delete process.env.BITMOVIN_API_KEY;
  vi.resetModules();
});

describe('getAuthHeaders', () => {
  it('sends the config API key when nothing overrides it', async () => {
    config.apiKey = 'config-key';
    const {getAuthHeaders} = await import('../../src/lib/client.js');

    await expect(getAuthHeaders()).resolves.toMatchObject({'X-Api-Key': 'config-key'});
  });

  it('prefers the --api-key override over env and config', async () => {
    config.apiKey = 'config-key';
    process.env.BITMOVIN_API_KEY = 'env-key';
    const {getAuthHeaders} = await import('../../src/lib/client.js');

    await expect(getAuthHeaders('flag-key')).resolves.toMatchObject({'X-Api-Key': 'flag-key'});
  });

  it('prefers the env key over the config file', async () => {
    config.apiKey = 'config-key';
    process.env.BITMOVIN_API_KEY = 'env-key';
    const {getAuthHeaders} = await import('../../src/lib/client.js');

    await expect(getAuthHeaders()).resolves.toMatchObject({'X-Api-Key': 'env-key'});
  });

  it('always carries a credential — never an unauthenticated request', async () => {
    config.apiKey = 'config-key';
    const {getAuthHeaders} = await import('../../src/lib/client.js');
    const headers = await getAuthHeaders();

    expect(Boolean(headers['X-Api-Key'] ?? headers.Authorization)).toBe(true);
  });

  it('fails with an actionable message when there are no credentials', async () => {
    const {getAuthHeaders} = await import('../../src/lib/client.js');

    await expect(getAuthHeaders()).rejects.toThrow(/api key|login|credential/i);
  });
});
