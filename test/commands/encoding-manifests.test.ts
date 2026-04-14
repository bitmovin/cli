import {describe, it, expect, vi} from 'vitest';

const mockManifests = [
  {id: 'man-1', name: 'DASH Manifest', type: 'DASH', status: 'FINISHED', createdAt: '2026-01-01'},
  {id: 'man-2', name: 'HLS Manifest', type: 'HLS', status: 'FINISHED', createdAt: '2026-01-02'},
];

vi.mock('../../src/lib/client.js', () => ({
  getClient: () => ({
    encoding: {
      manifests: {
        list: async () => ({items: mockManifests}),
        dash: {
          list: async () => ({items: mockManifests.filter((m) => m.type === 'DASH')}),
          get: async (id: string) => mockManifests.find((m) => m.id === id),
          delete: vi.fn(),
        },
        hls: {
          list: async () => ({items: mockManifests.filter((m) => m.type === 'HLS')}),
          get: async (id: string) => mockManifests.find((m) => m.id === id),
          delete: vi.fn(),
        },
        smooth: {
          list: async () => ({items: []}),
        },
      },
    },
  }),
}));

function captureStdout(): {output: () => string; restore: () => void} {
  let captured = '';
  const mock = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  });
  return {
    output: () => captured,
    restore: () => mock.mockRestore(),
  };
}

describe('encoding manifests list', () => {
  it('lists all manifests as JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/manifests/list.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(2);
  });

  it('filters by --type dash', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/manifests/list.js');
    await Cmd.run(['--type', 'dash', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe('DASH');
  });

  it('filters by --type hls', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/manifests/list.js');
    await Cmd.run(['--type', 'hls', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe('HLS');
  });

  it('returns empty for smooth', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/manifests/list.js');
    await Cmd.run(['--type', 'smooth', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(0);
  });
});
