import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {resolveAuth} from '../../src/lib/api-key.js';

describe('resolveAuth', () => {
  const originalEnv = process.env.BITMOVIN_API_KEY;

  beforeEach(() => {
    delete process.env.BITMOVIN_API_KEY;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BITMOVIN_API_KEY;
    } else {
      process.env.BITMOVIN_API_KEY = originalEnv;
    }
  });

  it('flag wins over env, OAuth, and config-file', () => {
    process.env.BITMOVIN_API_KEY = 'env-key';
    const out = resolveAuth({apiKey: 'config-key', oauth: {accessToken: 'tok'}}, 'flag-key');
    expect(out).toEqual({kind: 'api-key', value: 'flag-key', source: 'flag'});
  });

  it('env wins over OAuth and config-file', () => {
    process.env.BITMOVIN_API_KEY = 'env-key';
    const out = resolveAuth({apiKey: 'config-key', oauth: {accessToken: 'tok'}});
    expect(out).toEqual({kind: 'api-key', value: 'env-key', source: 'env'});
  });

  it('OAuth wins over config-file API key when no flag/env', () => {
    const out = resolveAuth({apiKey: 'config-key', oauth: {accessToken: 'tok'}});
    expect(out.kind).toBe('oauth');
    if (out.kind === 'oauth') {
      expect(out.session.accessToken).toBe('tok');
    }
  });

  it('falls back to config-file API key when neither flag, env, nor OAuth set', () => {
    const out = resolveAuth({apiKey: 'config-key'});
    expect(out).toEqual({kind: 'api-key', value: 'config-key', source: 'config-file'});
  });

  it('empty flag short-circuits to none rather than falling back to env or OAuth', () => {
    process.env.BITMOVIN_API_KEY = 'env-key';
    const out = resolveAuth({oauth: {accessToken: 'tok'}}, '');
    expect(out).toEqual({kind: 'none', source: 'none'});
  });

  it('empty env short-circuits to none rather than falling back to OAuth or config-file', () => {
    process.env.BITMOVIN_API_KEY = '';
    const out = resolveAuth({apiKey: 'config-key', oauth: {accessToken: 'tok'}});
    expect(out).toEqual({kind: 'none', source: 'none'});
  });

  it('returns none when nothing is configured', () => {
    const out = resolveAuth({});
    expect(out).toEqual({kind: 'none', source: 'none'});
  });
});
