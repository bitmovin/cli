import {describe, it, expect, vi} from 'vitest';

const mockCodecConfigs = [
  {id: 'codec-1', name: '1080p H264', type: 'H264', createdAt: '2026-01-01'},
  {id: 'codec-2', name: '4K HEVC', type: 'H265', createdAt: '2026-01-02'},
  {id: 'codec-3', name: 'Stereo AAC', type: 'AAC', createdAt: '2026-01-03'},
];

const h264CreateMock = vi.fn().mockResolvedValue({id: 'codec-new-h264', name: '720p'});
const h265CreateMock = vi.fn().mockResolvedValue({id: 'codec-new-h265', name: '4K'});
const aacCreateMock = vi.fn().mockResolvedValue({id: 'codec-new-aac', name: 'Stereo'});
const h264DeleteMock = vi.fn().mockResolvedValue({});
const aacDeleteMock = vi.fn().mockResolvedValue({});

vi.mock('../../src/lib/client.js', () => ({
  getClient: () => ({
    encoding: {
      configurations: {
        list: async () => ({items: mockCodecConfigs}),
        get: async (id: string) => mockCodecConfigs.find((c) => c.id === id),
        type: {
          get: async (id: string) => {
            const codec = mockCodecConfigs.find((c) => c.id === id);
            return {type: codec?.type};
          },
        },
        video: {
          h264: {
            list: async () => ({items: [mockCodecConfigs[0]]}),
            get: async (id: string) => mockCodecConfigs.find((c) => c.id === id),
            create: h264CreateMock,
            delete: h264DeleteMock,
          },
          h265: {
            list: async () => ({items: [mockCodecConfigs[1]]}),
            get: async (id: string) => mockCodecConfigs.find((c) => c.id === id),
            create: h265CreateMock,
            delete: vi.fn(),
          },
          av1: {list: async () => ({items: []}), get: async () => null, delete: vi.fn()},
          vp9: {list: async () => ({items: []}), get: async () => null, delete: vi.fn()},
        },
        audio: {
          aac: {
            list: async () => ({items: [mockCodecConfigs[2]]}),
            get: async (id: string) => mockCodecConfigs.find((c) => c.id === id),
            create: aacCreateMock,
            delete: aacDeleteMock,
          },
          opus: {list: async () => ({items: []}), get: async () => null, delete: vi.fn()},
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

describe('encoding codecs list', () => {
  it('lists all codecs as JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/codecs/list.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(3);
  });

  it('filters by --codec h264', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/codecs/list.js');
    await Cmd.run(['--codec', 'h264', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('1080p H264');
  });

  it('filters by --type video', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/codecs/list.js');
    await Cmd.run(['--type', 'video', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.length).toBeGreaterThanOrEqual(1);
    // Only video types (H264, H265) should appear
    for (const item of data) {
      expect(['H264', 'H265', 'AV1', 'VP9', 'VP8', 'H262', 'MJPEG']).toContain(item.type);
    }
  });

  it('filters by --type audio', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/codecs/list.js');
    await Cmd.run(['--type', 'audio', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    for (const item of data) {
      expect(['AAC', 'OPUS', 'VORBIS', 'AC3', 'EAC3', 'MP2', 'MP3', 'DTS', 'DTS_PASSTHROUGH', 'DTS_X', 'DTSE']).toContain(item.type);
    }
  });
});

describe('encoding codecs get', () => {
  it('auto-detects codec type and returns JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/codecs/get.js');
    await Cmd.run(['codec-1', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('codec-1');
    expect(data.name).toBe('1080p H264');
  });

  it('uses explicit --codec flag', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/codecs/get.js');
    await Cmd.run(['codec-3', '--codec', 'aac', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('codec-3');
  });
});

describe('encoding codecs delete', () => {
  it('deletes with auto-detected type', async () => {
    const capErr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/codecs/delete.js');
    await Cmd.run(['codec-1']);
    cap.restore();
    capErr.mockRestore();
    expect(h264DeleteMock).toHaveBeenCalledWith('codec-1');
  });

  it('deletes with explicit --codec', async () => {
    const capErr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/codecs/delete.js');
    await Cmd.run(['codec-3', '--codec', 'aac']);
    cap.restore();
    capErr.mockRestore();
    expect(aacDeleteMock).toHaveBeenCalledWith('codec-3');
  });
});

describe('encoding codecs create', () => {
  it('creates an H.264 config', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/codecs/create/h264.js');
    await Cmd.run(['--name', '720p', '--bitrate', '2400000', '--height', '720', '--json']);
    cap.restore();
    expect(h264CreateMock).toHaveBeenCalled();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('codec-new-h264');
  });

  it('creates an H.265 config', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/codecs/create/h265.js');
    await Cmd.run(['--name', '4K', '--bitrate', '8000000', '--json']);
    cap.restore();
    expect(h265CreateMock).toHaveBeenCalled();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('codec-new-h265');
  });

  it('creates an AAC config', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/codecs/create/aac.js');
    await Cmd.run(['--name', 'Stereo', '--bitrate', '128000', '--json']);
    cap.restore();
    expect(aacCreateMock).toHaveBeenCalled();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('codec-new-aac');
  });
});
