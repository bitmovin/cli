import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

vi.mock('../../src/lib/config.js', () => {
  const oauth = {
    accessToken: 'access-token-xyz',
    refreshToken: 'rt',
    expiresAt: Date.now() + 60 * 60_000,
    user: {sub: 'user-1'},
  };
  return {
    loadConfig: () => ({oauth}),
    saveConfig: () => {},
    getConfigPath: () => '/mock/.config/bitmovin/config.json',
  };
});

// Capture the constructor config so we can introspect headers + fetch override.
let lastConstructorConfig: any;
vi.mock('@bitmovin/api-sdk', () => {
  class MockBitmovinApi {
    constructor(config: any) {
      lastConstructorConfig = config;
    }
  }
  return {default: MockBitmovinApi};
});

describe('OAuth client → SDK wiring sends Bearer, not X-Api-Key', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    lastConstructorConfig = undefined;
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({data: {result: {}}}), {status: 200}),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('configures the SDK with Authorization: Bearer using the stored access token', async () => {
    const {getClient} = await import('../../src/lib/client.js');
    await getClient();
    expect(lastConstructorConfig.headers.Authorization).toBe('Bearer access-token-xyz');
  });

  it('sends CLI identification headers alongside the Bearer token', async () => {
    const {getClient} = await import('../../src/lib/client.js');
    await getClient();
    expect(lastConstructorConfig.headers['X-Api-Client']).toBe('bitmovin-cli');
    expect(lastConstructorConfig.headers['X-Api-Client-Version']).toBeTruthy();
  });

  it('strips X-Api-Key from outgoing requests when the SDK reinserts it', async () => {
    const {getClient} = await import('../../src/lib/client.js');
    await getClient();

    // Simulate what the SDK's RestClient does: it merges its own headers
    // (including X-Api-Key) onto the request before handing off to our fetch.
    const wrappedFetch = lastConstructorConfig.fetch;
    await wrappedFetch('https://api.example.com/v1/account/information', {
      method: 'GET',
      headers: {
        'X-Api-Key': '',
        Authorization: 'Bearer access-token-xyz',
        'Content-Type': 'application/json',
      },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.has('X-Api-Key')).toBe(false);
    expect(headers.get('Authorization')).toBe('Bearer access-token-xyz');
  });
});
