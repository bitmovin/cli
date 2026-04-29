import {describe, it, expect, vi} from 'vitest';
import {writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

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
  resolveAuth: (override?: string) => ({
    apiKey: override ?? process.env.BITMOVIN_API_KEY ?? 'mock-api-key',
    tenantOrgId: undefined,
  }),
  API_BASE_URL: 'https://api.bitmovin.com/v1',
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

describe('encoding templates create', () => {
  function setupCreate(): {dir: string; fetchMock: ReturnType<typeof vi.fn>} {
    const dir = mkdtempSync(join(tmpdir(), 'bm-cli-create-'));
    process.env.BITMOVIN_API_KEY = 'test-key-create';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({data: {result: {id: 'tmpl-new', name: 'Test'}}}),
    });
    vi.stubGlobal('fetch', fetchMock);
    return {dir, fetchMock};
  }

  it('posts the YAML body verbatim with Content-Type: application/yaml', async () => {
    const {dir, fetchMock} = setupCreate();
    const file = join(dir, 't.yaml');
    const yamlBody = "metadata:\n  name: Test\n  type: LIVE\nencodings: {}\n";
    writeFileSync(file, yamlBody);
    const cap = vi.spyOn(console, 'log').mockImplementation(() => {});
    const {default: Cmd} = await import('../../src/commands/encoding/templates/create.js');
    await Cmd.run([file]);
    cap.mockRestore();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.bitmovin.com/v1/encoding/templates');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe(yamlBody);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/yaml');
    expect(headers['X-Api-Key']).toBe('test-key-create');
    vi.unstubAllGlobals();
    delete process.env.BITMOVIN_API_KEY;
  });

  it('outputs clean JSON with --json', async () => {
    const {dir} = setupCreate();
    const file = join(dir, 't.yaml');
    writeFileSync(file, 'metadata:\n  name: Test\n');
    const cap = captureStdout();
    const capErr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const {default: Cmd} = await import('../../src/commands/encoding/templates/create.js');
    await Cmd.run([file, '--json']);
    cap.restore();
    capErr.mockRestore();
    const data = JSON.parse(cap.output());
    expect(data).toEqual({id: 'tmpl-new', name: 'Test'});
    vi.unstubAllGlobals();
    delete process.env.BITMOVIN_API_KEY;
  });

  it('surfaces API error message on failure', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bm-cli-create-'));
    process.env.BITMOVIN_API_KEY = 'test-key-create';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({data: {developerMessage: 'Could not parse encoding template'}}),
      }),
    );
    const file = join(dir, 'bad.yaml');
    writeFileSync(file, 'metadata:\n  type: LIVE\n');
    const cap = vi.spyOn(console, 'error').mockImplementation(() => {});
    const {default: Cmd} = await import('../../src/commands/encoding/templates/create.js');
    await expect(Cmd.run([file])).rejects.toThrow(/EEXIT: 1|Could not parse encoding template/);
    cap.mockRestore();
    vi.unstubAllGlobals();
    delete process.env.BITMOVIN_API_KEY;
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
