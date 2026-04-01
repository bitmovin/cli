import {describe, it, expect, vi} from 'vitest';

const mockEncodings = [
  {id: 'enc-1', name: 'VOD Encode 1', cloudRegion: 'AUTO', status: 'FINISHED', createdAt: '2026-01-01T00:00:00.000Z'},
  {id: 'enc-2', name: 'VOD Encode 2', cloudRegion: 'AWS_EU_WEST_1', status: 'ERROR', createdAt: '2026-01-02T00:00:00.000Z'},
];

vi.mock('../../src/lib/client.js', () => ({
  getClient: () => ({
    encoding: {
      encodings: {
        list: async () => ({items: mockEncodings}),
        get: async (id: string) => mockEncodings.find((e) => e.id === id),
      },
    },
  }),
}));

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

describe('--fields flag', () => {
  it('filters JSON output to specified fields on list', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/list.js');
    await Cmd.run(['--fields', 'id,name']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(2);
    expect(Object.keys(data[0])).toEqual(['id', 'name']);
    expect(data[0].id).toBe('enc-1');
    expect(data[0].name).toBe('VOD Encode 1');
    expect(data[0].status).toBeUndefined();
  });

  it('filters JSON output to specified fields on get', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/get.js');
    await Cmd.run(['enc-1', '--fields', 'id,status']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(Object.keys(data)).toEqual(['id', 'status']);
    expect(data.id).toBe('enc-1');
    expect(data.status).toBe('FINISHED');
    expect(data.name).toBeUndefined();
  });

  it('implies --json mode', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/list.js');
    await Cmd.run(['--fields', 'id']);
    cap.restore();
    // Should parse as JSON (implies --json)
    const data = JSON.parse(cap.output());
    expect(Array.isArray(data)).toBe(true);
  });
});
