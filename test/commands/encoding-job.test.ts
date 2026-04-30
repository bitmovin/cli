import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

const mockEncodings = [
  {id: 'enc-1', name: 'VOD Encode 1', cloudRegion: 'AUTO', status: 'FINISHED', createdAt: '2026-01-01T00:00:00.000Z'},
  {id: 'enc-2', name: 'VOD Encode 2', cloudRegion: 'AWS_EU_WEST_1', status: 'ERROR', createdAt: '2026-01-02T00:00:00.000Z'},
  {id: 'enc-3', name: 'Live Encode', cloudRegion: 'AUTO', status: 'RUNNING', createdAt: '2026-01-03T00:00:00.000Z'},
];

const mockApi = {
  encoding: {
    encodings: {
      list: async () => ({items: mockEncodings}),
      get: async (id: string) => mockEncodings.find((e) => e.id === id),
      status: async () => ({status: 'FINISHED', progress: 100, eta: 0}),
      start: async () => ({}),
      stop: async () => ({}),
      delete: async () => ({}),
      live: {
        get: async (id: string) => {
          if (id === 'enc-queued' || id === 'enc-unavailable') {
            const message = id === 'enc-unavailable'
              ? `Live details for encoding '${id}' are unavailable.`
              : `Details for live encoding with id '${id}' are not available at the moment.`;
            const err = new Error(message) as Error & {httpStatusCode: number; developerMessage: string; errorCode?: string};
            err.httpStatusCode = 400;
            err.developerMessage = err.message;
            if (id === 'enc-unavailable') err.errorCode = 'LIVE_ENCODING_DETAILS_UNAVAILABLE';
            throw err;
          }

          return {
            encoderIp: id === 'enc-3' ? '192.0.2.10' : undefined,
            streamKey: 'demo-key',
            application: 'live',
          };
        },
      },
    },
  },
};

// Mock the client module
vi.mock('../../src/lib/client.js', () => ({
  getClient: () => mockApi,
}));

// Capture process.stdout.write output
function captureStdout(): {output: () => string; restore: () => void} {
  let captured = '';
  const original = process.stdout.write.bind(process.stdout);
  const mock = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  });
  return {
    output: () => captured,
    restore: () => mock.mockRestore(),
  };
}

describe('encoding job list', () => {
  it('outputs JSON with --json', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/list.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(3);
    expect(data[0].id).toBe('enc-1');
    expect(data[1].status).toBe('ERROR');
  });

  it('outputs table data in non-TTY', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/list.js');
    await Cmd.run([]);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('id');
    expect(out).toContain('enc-1');
    expect(out).toContain('VOD Encode 1');
  });

  it('supports --jq filtering', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/list.js');
    await Cmd.run(['--jq', '.[].id']);
    cap.restore();
    expect(cap.output().trim()).toBe('"enc-1"\n"enc-2"\n"enc-3"');
  });

  it('supports --jq select', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/list.js');
    await Cmd.run(['--jq', '[.[] | select(.status == "RUNNING")]']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Live Encode');
  });
});

describe('encoding job get', () => {
  it('outputs JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/get.js');
    await Cmd.run(['enc-1', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('enc-1');
    expect(data.name).toBe('VOD Encode 1');
  });
});

describe('encoding job status', () => {
  it('outputs JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/status.js');
    await Cmd.run(['enc-1', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.status).toBe('FINISHED');
    expect(data.progress).toBe(100);
  });

  it('outputs human-readable', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/status.js');
    await Cmd.run(['enc-1']);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('Status:');
    expect(out).toContain('FINISHED');
    expect(out).toContain('100%');
  });
});

describe('encoding job live', () => {
  it('prints encoder IP, stream key, and application', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-3']);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('encoderIp');
    expect(out).toContain('192.0.2.10');
    expect(out).toContain('streamKey');
    expect(out).toContain('demo-key');
    expect(out).toContain('application');
    expect(out).toContain('live');
  });

  it('shows "(not yet running)" when encoderIp is unset', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-1']);
    cap.restore();
    expect(cap.output()).toContain('(not yet running)');
  });

  it('outputs JSON with --json', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-3', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.encoderIp).toBe('192.0.2.10');
    expect(data.streamKey).toBe('demo-key');
    expect(data.application).toBe('live');
  });

  it('supports --fields filtering', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-3', '--fields', 'encoderIp']);
    cap.restore();
    expect(JSON.parse(cap.output())).toEqual({encoderIp: '192.0.2.10'});
  });

  it('handles queued live encodings whose details are not available yet', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-queued']);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('encoderIp');
    expect(out).toContain('(not yet running)');
  });

  it('outputs unavailable live details as JSON with --json', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-queued', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.available).toBe(false);
    expect(data.message).toContain('not available yet');
  });

  it('handles unavailable live details with alternate API wording', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-unavailable']);
    cap.restore();
    expect(cap.output()).toContain('(not yet running)');
  });
});
