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
    const {default: Cmd} = await import('../../src/commands/encoding/job/list.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(3);
    expect(data[0].id).toBe('enc-1');
    expect(data[1].status).toBe('ERROR');
  });

  it('outputs table data in non-TTY', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/job/list.js');
    await Cmd.run([]);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('id');
    expect(out).toContain('enc-1');
    expect(out).toContain('VOD Encode 1');
  });

  it('supports --jq filtering', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/job/list.js');
    await Cmd.run(['--jq', '.[].id']);
    cap.restore();
    expect(cap.output().trim()).toBe('"enc-1"\n"enc-2"\n"enc-3"');
  });

  it('supports --jq select', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/job/list.js');
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
    const {default: Cmd} = await import('../../src/commands/encoding/job/get.js');
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
    const {default: Cmd} = await import('../../src/commands/encoding/job/status.js');
    await Cmd.run(['enc-1', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.status).toBe('FINISHED');
    expect(data.progress).toBe(100);
  });

  it('outputs human-readable', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/job/status.js');
    await Cmd.run(['enc-1']);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('Status:');
    expect(out).toContain('FINISHED');
    expect(out).toContain('100%');
  });
});
