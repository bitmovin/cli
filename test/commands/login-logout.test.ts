import {describe, it, expect, vi, beforeEach} from 'vitest';

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

const mockSession = {
  accessToken: 'access-123',
  refreshToken: 'refresh-456',
  expiresAt: Date.now() + 3600_000,
  user: {email: 'tester@example.com'},
};

vi.mock('../../src/lib/oauth.js', () => ({
  runLoginFlow: vi.fn(async (opts: any) => {
    opts?.onAuthorizeUrl?.('https://idp.example.com/oauth/authorize?...');
    return mockSession;
  }),
}));

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

describe('login', () => {
  beforeEach(() => configMock._reset());

  it('runs the OAuth flow and stores the session', async () => {
    const cap = captureOutput();
    const {default: Login} = await import('../../src/commands/login.js');
    await Login.run([]);
    cap.restore();
    expect(cap.output()).toContain('https://idp.example.com/oauth/authorize');
    expect(cap.output()).toContain('Logged in');
    expect(cap.output()).toContain('tester@example.com');
    expect(configMock._getStore().oauth).toMatchObject({
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
    });
  });

  it('replaces an existing session and warns about it', async () => {
    configMock.saveConfig({oauth: {accessToken: 'old', user: {email: 'prev@example.com'}}});
    const cap = captureOutput();
    const {default: Login} = await import('../../src/commands/login.js');
    await Login.run([]);
    cap.restore();
    expect(cap.output()).toContain('Replacing existing session');
    expect(cap.output()).toContain('prev@example.com');
    expect(configMock._getStore().oauth.accessToken).toBe('access-123');
  });
});

describe('logout', () => {
  beforeEach(() => configMock._reset());

  it('clears an active session', async () => {
    configMock.saveConfig({
      apiKey: 'keep-me',
      oauth: {accessToken: 'old', user: {email: 'bye@example.com'}},
    });
    const cap = captureOutput();
    const {default: Logout} = await import('../../src/commands/logout.js');
    await Logout.run([]);
    cap.restore();
    expect(cap.output()).toContain('Logged out');
    expect(cap.output()).toContain('bye@example.com');
    expect(configMock._getStore().oauth).toBeUndefined();
    // API key must be preserved
    expect(configMock._getStore().apiKey).toBe('keep-me');
  });

  it('is a no-op when no session is stored', async () => {
    const cap = captureOutput();
    const {default: Logout} = await import('../../src/commands/logout.js');
    await Logout.run([]);
    cap.restore();
    expect(cap.output()).toContain('No active OAuth session');
  });
});
