import {describe, it, expect, vi} from 'vitest';
import {writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Redirect the validate command's schema cache to a per-test temp dir.
// Set BM_CLI_TEST_HOME before each validate test below.
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: () => process.env.BM_CLI_TEST_HOME ?? actual.homedir(),
  };
});

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

describe('encoding templates validate', () => {
  // Minimal 2020-12 schema modeled after the real encoding template schema.
  // It keeps the tests fast while covering representative YAML shape errors.
  const miniSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      metadata: {
        type: 'object',
        properties: {
          name: {type: 'string'},
          type: {enum: ['VOD', 'LIVE']},
        },
        required: ['name', 'type'],
      },
      inputs: {type: 'object'},
      outputs: {type: 'object'},
      configurations: {type: 'object'},
      filters: {type: 'object'},
      encodings: {
        type: 'object',
        patternProperties: {
          '^[A-Za-z0-9_-]+$': {
            type: 'object',
            properties: {
              properties: {
                type: 'object',
                properties: {
                  name: {type: 'string'},
                  type: {enum: ['LIVE', 'VOD', 'NONE']},
                  cloudRegion: {enum: ['AWS_US_EAST_1', 'GOOGLE_US_CENTRAL_1']},
                },
              },
              start: {
                type: 'object',
                properties: {
                  encodingMode: {enum: ['STANDARD', 'SINGLE_PASS', 'TWO_PASS']},
                },
              },
              live: {type: 'object'},
            },
          },
        },
      },
      live: {type: 'object'},
      manifests: {type: 'object'},
    },
    required: ['metadata', 'encodings'],
  };

  function setup(): string {
    const dir = mkdtempSync(join(tmpdir(), 'bm-cli-validate-'));
    // Empty temp dir → loadSchema's cache check misses → fetch fires.
    process.env.BM_CLI_TEST_HOME = dir;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => miniSchema,
      }),
    );
    return dir;
  }

  function captureLogs(): {output: () => string; restore: () => void} {
    // The CLI's `this.log()` routes through oclif's ux.stdout which uses
    // console.log, so capturing process.stdout.write is not enough.
    let captured = '';
    const append = (parts: unknown[]) => {
      captured += parts.map((p) => (typeof p === 'string' ? p : String(p))).join(' ') + '\n';
    };
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => append(args));
    const errSpy = vi.spyOn(console, 'error').mockImplementation((...args) => append(args));
    return {
      output: () => captured,
      restore: () => {
        logSpy.mockRestore();
        errSpy.mockRestore();
      },
    };
  }

  it('reports a valid template', async () => {
    const dir = setup();
    const file = join(dir, 'valid.yaml');
    writeFileSync(file, "metadata:\n  name: t\n  type: VOD\nencodings: {}\n");
    const cap = captureLogs();
    const {default: Cmd} = await import('../../src/commands/encoding/templates/validate.js');
    await Cmd.run([file]);
    cap.restore();
    expect(cap.output()).toContain('Template is valid');
    vi.unstubAllGlobals();
  });

  it('reports schema violations and exits non-zero', async () => {
    const dir = setup();
    const file = join(dir, 'invalid.yaml');
    writeFileSync(file, "metadata:\n  name: t\n  type: BOGUS\n");
    const cap = captureLogs();
    const {default: Cmd} = await import('../../src/commands/encoding/templates/validate.js');
    await expect(Cmd.run([file])).rejects.toThrow(/EEXIT: 1/);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('Validation errors');
    expect(out).toContain("required property 'encodings'");
    expect(out).toContain('/metadata/type');
    vi.unstubAllGlobals();
  });

  it.each([
    ['empty document', '', '/: must be object'],
    ['scalar document', 'just-a-string\n', '/: must be object'],
    ['missing metadata', 'encodings: {}\n', "required property 'metadata'"],
    ['missing encodings', 'metadata:\n  name: t\n  type: VOD\n', "required property 'encodings'"],
    ['metadata missing type', 'metadata:\n  name: t\nencodings: {}\n', "required property 'type'"],
    ['metadata name with wrong type', 'metadata:\n  name: 123\n  type: VOD\nencodings: {}\n', '/metadata/name'],
    ['metadata with invalid type', 'metadata:\n  name: t\n  type: BOGUS\nencodings: {}\n', '/metadata/type'],
    ['null metadata', 'metadata: null\nencodings: {}\n', '/metadata: must be object'],
    ['encodings with wrong type', 'metadata:\n  name: t\n  type: VOD\nencodings: []\n', '/encodings: must be object'],
    ['inputs with wrong type', 'metadata:\n  name: t\n  type: VOD\nencodings: {}\ninputs: []\n', '/inputs: must be object'],
    ['outputs with wrong type', 'metadata:\n  name: t\n  type: VOD\nencodings: {}\noutputs: nope\n', '/outputs: must be object'],
    [
      'configurations with wrong type',
      'metadata:\n  name: t\n  type: VOD\nencodings: {}\nconfigurations: []\n',
      '/configurations: must be object',
    ],
    ['live with wrong type', 'metadata:\n  name: t\n  type: LIVE\nencodings: {}\nlive: no\n', '/live: must be object'],
    ['manifests with wrong type', 'metadata:\n  name: t\n  type: VOD\nencodings: {}\nmanifests: []\n', '/manifests: must be object'],
    [
      'encoding cloudRegion with invalid enum value',
      'metadata:\n  name: t\n  type: VOD\nencodings:\n  main:\n    properties:\n      name: main\n      type: VOD\n      cloudRegion: MARS_1\n',
      '/encodings/main/properties/cloudRegion',
    ],
    [
      'encoding start mode with invalid enum value',
      'metadata:\n  name: t\n  type: VOD\nencodings:\n  main:\n    start:\n      encodingMode: BOGUS\n',
      '/encodings/main/start/encodingMode',
    ],
    [
      'encoding live block with wrong type',
      'metadata:\n  name: t\n  type: VOD\nencodings:\n  main:\n    live: nope\n',
      '/encodings/main/live: must be object',
    ],
  ])('reports invalid YAML template shape: %s', async (_name, yamlContent, expectedError) => {
    const dir = setup();
    const file = join(dir, 'invalid-shape.yaml');
    writeFileSync(file, yamlContent);
    const cap = captureLogs();
    const {default: Cmd} = await import('../../src/commands/encoding/templates/validate.js');
    await expect(Cmd.run([file])).rejects.toThrow(/EEXIT: 1/);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('Validation errors');
    expect(out).toContain(expectedError);
    vi.unstubAllGlobals();
  });

  it('reports invalid YAML syntax before schema validation', async () => {
    const dir = setup();
    const file = join(dir, 'invalid-syntax.yaml');
    writeFileSync(file, 'metadata:\n  name: [unterminated\n');
    const {default: Cmd} = await import('../../src/commands/encoding/templates/validate.js');
    await expect(Cmd.run([file])).rejects.toThrow('Invalid YAML syntax');
    vi.unstubAllGlobals();
  });
});
