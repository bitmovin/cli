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
