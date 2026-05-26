import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {createHash} from 'node:crypto';

describe('generatePkcePair', () => {
  it('produces a verifier and SHA-256 challenge', async () => {
    const {generatePkcePair} = await import('../../src/lib/oauth.js');
    const {verifier, challenge} = generatePkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);

    const expected = createHash('sha256').update(verifier).digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    expect(challenge).toBe(expected);
  });

  it('returns a different pair every call', async () => {
    const {generatePkcePair} = await import('../../src/lib/oauth.js');
    const a = generatePkcePair();
    const b = generatePkcePair();
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe('resolveEndpoints', () => {
  const env = {...process.env};
  afterEach(() => {
    process.env = {...env};
  });

  it('uses /oauth2/auth and /oauth2/token paths by default when env vars are unset', async () => {
    delete process.env.BITMOVIN_OAUTH_ISSUER;
    delete process.env.BITMOVIN_OAUTH_AUTHORIZE_URL;
    delete process.env.BITMOVIN_OAUTH_TOKEN_URL;
    delete process.env.BITMOVIN_OAUTH_CLIENT_ID;
    const {resolveEndpoints} = await import('../../src/lib/oauth.js');
    const ep = resolveEndpoints();
    expect(ep.authorizeUrl).toMatch(/\/oauth2\/auth$/);
    expect(ep.tokenUrl).toMatch(/\/oauth2\/token$/);
    expect(ep.clientId).toBe('f0c655e4-564f-486a-ad39-e07bc29d2032');
  });

  it('honors BITMOVIN_OAUTH_ISSUER override', async () => {
    process.env.BITMOVIN_OAUTH_ISSUER = 'https://idp.example.com';
    delete process.env.BITMOVIN_OAUTH_AUTHORIZE_URL;
    delete process.env.BITMOVIN_OAUTH_TOKEN_URL;
    const {resolveEndpoints} = await import('../../src/lib/oauth.js');
    const ep = resolveEndpoints();
    expect(ep.authorizeUrl).toBe('https://idp.example.com/oauth2/auth');
    expect(ep.tokenUrl).toBe('https://idp.example.com/oauth2/token');
  });

  it('lets individual endpoint URLs be overridden', async () => {
    process.env.BITMOVIN_OAUTH_AUTHORIZE_URL = 'https://idp.example.com/custom/authorize';
    process.env.BITMOVIN_OAUTH_TOKEN_URL = 'https://idp.example.com/custom/token';
    process.env.BITMOVIN_OAUTH_CLIENT_ID = 'my-client';
    const {resolveEndpoints} = await import('../../src/lib/oauth.js');
    const ep = resolveEndpoints();
    expect(ep.authorizeUrl).toBe('https://idp.example.com/custom/authorize');
    expect(ep.tokenUrl).toBe('https://idp.example.com/custom/token');
    expect(ep.clientId).toBe('my-client');
  });

  it('uses a fixed loopback redirect port by default', async () => {
    delete process.env.BITMOVIN_OAUTH_REDIRECT_PORT;
    const {resolveEndpoints} = await import('../../src/lib/oauth.js');
    const ep = resolveEndpoints();
    expect(ep.redirectPort).toBeGreaterThan(1024);
    expect(ep.redirectPort).toBeLessThan(65536);
  });

  it('honors BITMOVIN_OAUTH_REDIRECT_PORT override', async () => {
    process.env.BITMOVIN_OAUTH_REDIRECT_PORT = '12345';
    const {resolveEndpoints} = await import('../../src/lib/oauth.js');
    expect(resolveEndpoints().redirectPort).toBe(12345);
  });

  it('rejects invalid BITMOVIN_OAUTH_REDIRECT_PORT', async () => {
    process.env.BITMOVIN_OAUTH_REDIRECT_PORT = '99999';
    const {resolveEndpoints} = await import('../../src/lib/oauth.js');
    expect(() => resolveEndpoints()).toThrow(/TCP port/);
  });
});

describe('isExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats sessions without expiresAt as not expired', async () => {
    const {isExpired} = await import('../../src/lib/oauth.js');
    expect(isExpired({accessToken: 'x'})).toBe(false);
  });

  it('returns true when expiresAt is in the past', async () => {
    const {isExpired} = await import('../../src/lib/oauth.js');
    expect(isExpired({accessToken: 'x', expiresAt: Date.now() - 1_000})).toBe(true);
  });

  it('returns true within the skew window', async () => {
    const {isExpired} = await import('../../src/lib/oauth.js');
    // default skew is 30s
    expect(isExpired({accessToken: 'x', expiresAt: Date.now() + 10_000})).toBe(true);
  });

  it('returns false when expiry is comfortably in the future', async () => {
    const {isExpired} = await import('../../src/lib/oauth.js');
    expect(isExpired({accessToken: 'x', expiresAt: Date.now() + 5 * 60 * 1000})).toBe(false);
  });
});
