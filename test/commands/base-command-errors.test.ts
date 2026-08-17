import {describe, it, expect, vi, afterEach} from 'vitest';

// Mock the config module
vi.mock('../../src/lib/config.js', () => ({
  loadConfig: () => ({apiKey: 'test-key'}),
  saveConfig: () => {},
  getConfigPath: () => '/mock/.config/bitmovin/config.json',
}));

// Create a mock API that throws specific errors
function createErrorApi(httpStatusCode: number, opts?: {developerMessage?: string; requestId?: string}) {
  const err: any = new Error(`HTTP ${httpStatusCode}`);
  err.httpStatusCode = httpStatusCode;
  if (opts?.developerMessage) err.developerMessage = opts.developerMessage;
  if (opts?.requestId) err.requestId = opts.requestId;

  return {
    encoding: {
      encodings: {
        get: async () => { throw err; },
        delete: async () => { throw err; },
        list: async () => { throw err; },
      },
    },
  };
}

let mockApiInstance: any;

vi.mock('../../src/lib/client.js', () => ({
  getClient: () => mockApiInstance,
}));

function captureStderr(): {output: () => string; restore: () => void} {
  let captured = '';
  const mock = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  });
  return {
    output: () => captured,
    restore: () => mock.mockRestore(),
  };
}

function captureStdout(): {output: () => string; restore: () => void} {
  let captured = '';
  const mock = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  });
  return {
    output: () => captured,
    restore: () => mock.mockRestore(),
  };
}

/** oclif this.exit(1) throws an Error with code EEXIT */
function isOclifExit(err: unknown): boolean {
  return err instanceof Error && (err as any).oclif?.exit !== undefined;
}

describe('BaseCommand error handling', () => {
  it('handles 401 authentication error', async () => {
    mockApiInstance = createErrorApi(401);
    const capErr = captureStderr();
    const capOut = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/get.js');
    try {
      await Cmd.run(['some-id']);
    } catch (err) {
      if (!isOclifExit(err)) throw err;
    }
    capErr.restore();
    capOut.restore();
    const errOut = capErr.output();
    expect(errOut).toContain('Authentication failed');
    expect(errOut).toContain('API key');
  });

  it('handles 403 access denied error', async () => {
    mockApiInstance = createErrorApi(403);
    const capErr = captureStderr();
    const capOut = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/get.js');
    try {
      await Cmd.run(['some-id']);
    } catch (err) {
      if (!isOclifExit(err)) throw err;
    }
    capErr.restore();
    capOut.restore();
    const errOut = capErr.output();
    expect(errOut).toContain('Access denied');
  });

  it('handles 404 not found error', async () => {
    mockApiInstance = createErrorApi(404, {developerMessage: 'Encoding not found'});
    const capErr = captureStderr();
    const capOut = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/get.js');
    try {
      await Cmd.run(['some-id']);
    } catch (err) {
      if (!isOclifExit(err)) throw err;
    }
    capErr.restore();
    capOut.restore();
    const errOut = capErr.output();
    expect(errOut).toContain('Resource not found');
    expect(errOut).toContain('Encoding not found');
  });

  it('reports a real transport failure in terms the user can act on', async () => {
    // undici's wrapper for DNS/TLS/connection failures.
    const err = new TypeError('fetch failed');
    (err as {cause?: unknown}).cause = Object.assign(new Error('getaddrinfo ENOTFOUND api.bitmovin.com'), {code: 'ENOTFOUND'});
    mockApiInstance = {encoding: {encodings: {get: async () => { throw err; }}}};
    const capErr = captureStderr();
    const capOut = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/get.js');
    try {
      await Cmd.run(['some-id']);
    } catch (thrown) {
      if (!isOclifExit(thrown)) throw thrown;
    }
    capErr.restore();
    capOut.restore();
    expect(capErr.output()).toContain('Could not reach the Bitmovin API');
  });

  it('does not swallow a programming TypeError that merely mentions the network', async () => {
    // The classifier runs in catch for every command, so a free-text match on
    // "network"/"socket" turned a real bug into "check your VPN" and dropped its
    // stack — pointing a maintainer at their connection instead of their code.
    const err = new TypeError("Cannot read properties of undefined (reading 'socket') in the network layer");
    mockApiInstance = {encoding: {encodings: {get: async () => { throw err; }}}};
    const capErr = captureStderr();
    const capOut = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/get.js');
    const run = Cmd.run(['some-id']);
    await expect(run).rejects.toThrow(/Cannot read properties of undefined/);
    capErr.restore();
    capOut.restore();
    expect(capErr.output()).not.toContain('Could not reach the Bitmovin API');
  });

  it('sanitizes the API-supplied error text before printing it', async () => {
    // developerMessage falls back to the API's own message (which reflects submitted
    // content) or to a snippet of a non-envelope response body, so it is the one
    // error path carrying text the caller may not control. Raw, an escape sequence in
    // it would repaint the lines printed above.
    mockApiInstance = createErrorApi(404, {developerMessage: 'Not found\u001B[2K  forged line'});
    const capErr = captureStderr();
    const capOut = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/get.js');
    try {
      await Cmd.run(['some-id']);
    } catch (err) {
      if (!isOclifExit(err)) throw err;
    }
    capErr.restore();
    capOut.restore();
    expect(capErr.output()).not.toContain('\u001B[2K');
    expect(capErr.output()).toContain('Not found');
  });

  it('outputs structured JSON error in --json mode for 404', async () => {
    mockApiInstance = createErrorApi(404, {developerMessage: 'Not found', requestId: 'req-123'});
    const capOut = captureStdout();
    const capErr = captureStderr();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/get.js');
    try {
      await Cmd.run(['some-id', '--json']);
    } catch (err) {
      if (!isOclifExit(err)) throw err;
    }
    capOut.restore();
    capErr.restore();
    const data = JSON.parse(capOut.output());
    expect(data.error).toBe(true);
    expect(data.httpStatusCode).toBe(404);
    expect(data.message).toBe('Not found');
    expect(data.requestId).toBe('req-123');
  });
});
