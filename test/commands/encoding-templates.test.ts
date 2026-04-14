import {describe, it, expect, vi} from 'vitest';

const mockTemplates = [
  {id: 'tmpl-1', name: 'Standard VOD', type: 'VOD', createdAt: '2026-01-01T00:00:00.000Z'},
  {id: 'tmpl-2', name: 'Live Stream', type: 'LIVE', createdAt: '2026-01-02T00:00:00.000Z'},
];

const createMock = vi.fn().mockResolvedValue({id: 'tmpl-new', name: 'New Template'});
const deleteMock = vi.fn().mockResolvedValue({});
const startMock = vi.fn().mockResolvedValue({encodingId: 'enc-started-1'});

vi.mock('../../src/lib/client.js', () => ({
  getClient: () => ({
    encoding: {
      templates: {
        list: async () => ({items: mockTemplates}),
        get: async (id: string) => mockTemplates.find((t) => t.id === id),
        create: createMock,
        delete: deleteMock,
        start: startMock,
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

describe('encoding templates list', () => {
  it('outputs JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/templates/list.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Standard VOD');
    expect(data[1].type).toBe('LIVE');
  });

  it('outputs table data in non-TTY', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/templates/list.js');
    await Cmd.run([]);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('tmpl-1');
    expect(out).toContain('Standard VOD');
  });
});

describe('encoding templates get', () => {
  it('outputs JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/templates/get.js');
    await Cmd.run(['tmpl-1', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('tmpl-1');
    expect(data.name).toBe('Standard VOD');
  });
});

describe('encoding templates delete', () => {
  it('deletes a template by ID', async () => {
    const capErr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/templates/delete.js');
    await Cmd.run(['tmpl-1']);
    cap.restore();
    capErr.mockRestore();
    expect(deleteMock).toHaveBeenCalledWith('tmpl-1');
  });
});

describe('encoding templates start', () => {
  it('starts from a stored template ID', async () => {
    const capErr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/templates/start.js');
    await Cmd.run(['--id', 'tmpl-1']);
    cap.restore();
    capErr.mockRestore();
    expect(startMock).toHaveBeenCalled();
    const arg = startMock.mock.calls[0][0];
    expect(arg).toEqual({id: 'tmpl-1'});
  });
});
