import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

const mockEncodings = [
  {id: 'enc-1', name: 'VOD Encode 1', cloudRegion: 'AUTO', status: 'FINISHED', createdAt: '2026-01-01T00:00:00.000Z'},
  {id: 'enc-2', name: 'VOD Encode 2', cloudRegion: 'AWS_EU_WEST_1', status: 'ERROR', createdAt: '2026-01-02T00:00:00.000Z'},
  {id: 'enc-3', name: 'Live Encode', cloudRegion: 'AUTO', status: 'RUNNING', createdAt: '2026-01-03T00:00:00.000Z'},
];

type StreamFixture = {inputStreams?: {inputId?: string}[]};
type StreamKeyFixture = {value: string; assignedIngestPointId?: string; status?: string};
type SrtFixture = {mode: string; host?: string; port: number; path: string};

const streamsByEncoding: Record<string, StreamFixture[]> = {
  'enc-3': [{inputStreams: [{inputId: 'rtmp-input'}]}],
  'enc-redundant': [{inputStreams: [{inputId: 'redundant-rtmp-input'}]}],
  'enc-srt': [{inputStreams: [{inputId: 'srt-input-1'}]}],
  'enc-srt-mixed': [
    {inputStreams: [{inputId: 'srt-input-1'}]},
    {inputStreams: [{inputId: 'srt-input-broken'}]},
    {inputStreams: [{inputId: 'srt-input-2'}]},
  ],
};
const streamKeysByEncoding: Record<string, StreamKeyFixture[]> = {
  'enc-3': [{value: 'demo-key', status: 'ASSIGNED'}],
  'enc-redundant': [
    {value: 'primary-key', assignedIngestPointId: 'ip-primary', status: 'ASSIGNED'},
    {value: 'backup-key', assignedIngestPointId: 'ip-backup', status: 'ASSIGNED'},
  ],
};
const inputTypeById: Record<string, string> = {
  'rtmp-input': 'RTMP',
  'redundant-rtmp-input': 'REDUNDANT_RTMP',
  'srt-input-1': 'SRT',
  'srt-input-2': 'SRT',
  'srt-input-broken': 'SRT',
};
const srtInputsById: Record<string, SrtFixture> = {
  'srt-input-1': {mode: 'LISTENER', port: 2088, path: '/live'},
  'srt-input-2': {mode: 'CALLER', host: 'srt.example.com', port: 9000, path: '/backup'},
};

const mockApi = {
  encoding: {
    encodings: {
      list: async () => ({items: mockEncodings}),
      get: async (id: string) => mockEncodings.find((e) => e.id === id),
      status: async () => ({status: 'FINISHED', progress: 100, eta: 0}),
      start: async () => ({}),
      stop: async () => ({}),
      delete: async () => ({}),
      streams: {
        list: async (id: string) => {
          if (id === 'enc-srt-fail') {
            const err = new Error('upstream timeout') as Error & {httpStatusCode?: number; developerMessage?: string};
            err.httpStatusCode = 503;
            err.developerMessage = 'upstream timeout';
            throw err;
          }
          return {items: streamsByEncoding[id] ?? []};
        },
      },
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

          if (id === 'enc-srt' || id === 'enc-srt-mixed') {
            return {encoderIp: '192.0.2.20', application: 'live'};
          }

          if (id === 'enc-redundant') {
            return {encoderIp: '192.0.2.30', application: 'live'};
          }

          if (id === 'enc-streamkeys-fail' || id === 'enc-srt-fail') {
            return {encoderIp: '192.0.2.40', application: 'live'};
          }

          return {
            encoderIp: id === 'enc-3' ? '192.0.2.10' : undefined,
            streamKey: 'demo-key',
            application: 'live',
          };
        },
      },
    },
    live: {
      streamKeys: {
        list: async (params: {assignedEncodingId?: string} = {}) => {
          if (params.assignedEncodingId === 'enc-streamkeys-fail') {
            const err = new Error('forbidden') as Error & {httpStatusCode?: number; developerMessage?: string};
            err.httpStatusCode = 403;
            err.developerMessage = 'forbidden';
            throw err;
          }
          return {
            items: params.assignedEncodingId ? streamKeysByEncoding[params.assignedEncodingId] ?? [] : [],
          };
        },
      },
    },
    inputs: {
      type: {
        get: async (inputId: string) => ({type: inputTypeById[inputId]}),
      },
      srt: {
        get: async (inputId: string) => {
          if (inputId === 'srt-input-broken') {
            const err = new Error('not found') as Error & {httpStatusCode?: number; developerMessage?: string};
            err.httpStatusCode = 404;
            err.developerMessage = 'not found';
            throw err;
          }
          return srtInputsById[inputId];
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

function captureStderr(): {output: () => string; restore: () => void} {
  let captured = '';
  const writeMock = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  });
  // oclif's `this.warn()` routes through `console.error`, not `process.stderr.write`.
  const errorMock = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    captured += args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ') + '\n';
  });
  return {
    output: () => captured,
    restore: () => {
      writeMock.mockRestore();
      errorMock.mockRestore();
    },
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
  it('prints encoder IP, stream keys, and application', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-3', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.encoderIp).toBe('192.0.2.10');
    expect(data.application).toBe('live');
    expect(data.streamKeys).toHaveLength(1);
    expect(data.streamKeys[0].value).toBe('demo-key');
    // Backwards-compat alias for scripts that read the previous singular field.
    expect(data.streamKey).toBe('demo-key');
  });

  it('exposes the first stream key as a backwards-compat alias for redundant RTMP', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-redundant', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.streamKey).toBe('primary-key');
  });

  it('shows "(not yet running)" when encoderIp is unset', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-1']);
    cap.restore();
    expect(cap.output()).toContain('(not yet running)');
  });

  it('renders a friendly summary in non-JSON mode', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-3']);
    cap.restore();
    const out = cap.output();
    expect(out).toMatch(/Encoder IP:\s+192\.0\.2\.10/);
    expect(out).toMatch(/Application:\s+live/);
    expect(out).toMatch(/Stream Key:\s+demo-key/);
  });

  it('renders a Stream Keys list for redundant RTMP', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-redundant']);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('Stream Keys:');
    expect(out).toContain('- primary-key (ingest ip-primary, ASSIGNED)');
    expect(out).toContain('- backup-key (ingest ip-backup, ASSIGNED)');
  });

  it('renders an SRT Inputs section for SRT encodings', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-srt']);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('SRT Inputs:');
    expect(out).toContain('LISTENER :2088/live (input srt-input-1)');
  });

  it('supports --fields filtering', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-3', '--fields', 'encoderIp']);
    cap.restore();
    expect(JSON.parse(cap.output())).toEqual({encoderIp: '192.0.2.10'});
  });

  it('lists every stream key for redundant RTMP encodings', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-redundant', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.streamKeys).toHaveLength(2);
    expect(data.streamKeys.map((k: {value: string}) => k.value)).toEqual(['primary-key', 'backup-key']);
    expect(data.streamKeys.map((k: {ingestPointId?: string}) => k.ingestPointId)).toEqual(['ip-primary', 'ip-backup']);
  });

  it('surfaces SRT mode/host/port/path from the encoding\'s streams', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-srt', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.srtInputs).toHaveLength(1);
    expect(data.srtInputs[0]).toMatchObject({mode: 'LISTENER', port: 2088, path: '/live'});
  });

  it('handles queued live encodings whose details are not available yet', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-queued']);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('Encoder IP:');
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
    expect(data.encoderIp).toBeNull();
    expect(data.application).toBeNull();
  });

  it('emits null encoderIp/application in --json when the encoder has not started', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-1', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.encoderIp).toBeNull();
    expect(data.application).toBe('live');
  });

  it('handles unavailable live details with alternate API wording', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-unavailable']);
    cap.restore();
    expect(cap.output()).toContain('(not yet running)');
  });

  it('still surfaces the encoder IP when stream keys fetch fails', async () => {
    const stdout = captureStdout();
    const stderr = captureStderr();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-streamkeys-fail', '--json']);
    stdout.restore();
    stderr.restore();
    const data = JSON.parse(stdout.output());
    expect(data.encoderIp).toBe('192.0.2.40');
    expect(data.streamKeys).toEqual([]);
    expect(stderr.output()).toMatch(/stream keys/i);
    expect(stderr.output()).toMatch(/403/);
  });

  it('returns valid SRT inputs when only one of several fails', async () => {
    const stdout = captureStdout();
    const stderr = captureStderr();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-srt-mixed', '--json']);
    stdout.restore();
    stderr.restore();
    const data = JSON.parse(stdout.output());
    const inputIds = data.srtInputs.map((i: {inputId: string}) => i.inputId);
    expect(inputIds).toEqual(expect.arrayContaining(['srt-input-1', 'srt-input-2']));
    expect(inputIds).not.toContain('srt-input-broken');
    expect(stderr.output()).toMatch(/srt-input-broken/);
    expect(stderr.output()).toMatch(/404/);
  });

  it('still surfaces the encoder IP when SRT input walk fails', async () => {
    const stdout = captureStdout();
    const stderr = captureStderr();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/live.js');
    await Cmd.run(['enc-srt-fail', '--json']);
    stdout.restore();
    stderr.restore();
    const data = JSON.parse(stdout.output());
    expect(data.encoderIp).toBe('192.0.2.40');
    expect(data.srtInputs).toEqual([]);
    expect(stderr.output()).toMatch(/SRT input/i);
    expect(stderr.output()).toMatch(/503/);
  });
});
