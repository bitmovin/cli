import {describe, it, expect, vi} from 'vitest';

const mockInputs = [
  {id: 'in-1', name: 'Prod S3', type: 'S3', createdAt: '2026-01-01'},
  {id: 'in-2', name: 'Staging GCS', type: 'GCS', createdAt: '2026-01-02'},
];

const mockOutputs = [
  {id: 'out-1', name: 'CDN S3', type: 'S3', createdAt: '2026-01-01'},
  {id: 'out-2', name: 'Archive GCS', type: 'GCS', createdAt: '2026-01-02'},
];

const inputCreateS3Mock = vi.fn().mockResolvedValue({id: 'in-new-s3', name: 'New S3'});
const inputCreateGcsMock = vi.fn().mockResolvedValue({id: 'in-new-gcs', name: 'New GCS'});
const inputCreateHttpsMock = vi.fn().mockResolvedValue({id: 'in-new-https', name: 'New HTTPS'});
const inputDeleteS3Mock = vi.fn().mockResolvedValue({});
const outputCreateS3Mock = vi.fn().mockResolvedValue({id: 'out-new-s3', name: 'New S3 Out'});
const outputCreateGcsMock = vi.fn().mockResolvedValue({id: 'out-new-gcs', name: 'New GCS Out'});
const outputDeleteS3Mock = vi.fn().mockResolvedValue({});

vi.mock('../../src/lib/client.js', () => ({
  getClient: () => ({
    encoding: {
      inputs: {
        list: async () => ({items: mockInputs}),
        get: async (id: string) => mockInputs.find((i) => i.id === id),
        type: {
          get: async (id: string) => ({type: mockInputs.find((i) => i.id === id)?.type}),
        },
        s3: {
          list: async () => ({items: mockInputs.filter((i) => i.type === 'S3')}),
          create: inputCreateS3Mock,
          delete: inputDeleteS3Mock,
        },
        gcs: {
          list: async () => ({items: mockInputs.filter((i) => i.type === 'GCS')}),
          create: inputCreateGcsMock,
          delete: vi.fn(),
        },
        http: {list: async () => ({items: []}), delete: vi.fn()},
        https: {
          list: async () => ({items: []}),
          create: inputCreateHttpsMock,
          delete: vi.fn(),
        },
        azure: {list: async () => ({items: []}), delete: vi.fn()},
        gcsServiceAccount: {delete: vi.fn()},
        ftp: {delete: vi.fn()},
        sftp: {delete: vi.fn()},
        aspera: {delete: vi.fn()},
        akamaiNetstorage: {delete: vi.fn()},
        s3RoleBased: {delete: vi.fn()},
        genericS3: {delete: vi.fn()},
        local: {delete: vi.fn()},
      },
      outputs: {
        list: async () => ({items: mockOutputs}),
        get: async (id: string) => mockOutputs.find((o) => o.id === id),
        type: {
          get: async (id: string) => ({type: mockOutputs.find((o) => o.id === id)?.type}),
        },
        s3: {
          list: async () => ({items: mockOutputs.filter((o) => o.type === 'S3')}),
          create: outputCreateS3Mock,
          delete: outputDeleteS3Mock,
        },
        gcs: {
          list: async () => ({items: mockOutputs.filter((o) => o.type === 'GCS')}),
          create: outputCreateGcsMock,
          delete: vi.fn(),
        },
        azure: {list: async () => ({items: []}), delete: vi.fn()},
        gcsServiceAccount: {delete: vi.fn()},
        ftp: {delete: vi.fn()},
        sftp: {delete: vi.fn()},
        akamaiNetstorage: {delete: vi.fn()},
        s3RoleBased: {delete: vi.fn()},
        genericS3: {delete: vi.fn()},
        local: {delete: vi.fn()},
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

describe('encoding inputs list', () => {
  it('lists all inputs as JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/inputs/list.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Prod S3');
  });

  it('filters by --type s3', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/inputs/list.js');
    await Cmd.run(['--type', 's3', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe('S3');
  });
});

describe('encoding inputs get', () => {
  it('gets input by ID', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/inputs/get.js');
    await Cmd.run(['in-1', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('in-1');
    expect(data.name).toBe('Prod S3');
  });
});

describe('encoding inputs delete', () => {
  it('deletes with auto-detected type', async () => {
    const capErr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/inputs/delete.js');
    await Cmd.run(['in-1']);
    cap.restore();
    capErr.mockRestore();
    expect(inputDeleteS3Mock).toHaveBeenCalledWith('in-1');
  });
});

describe('encoding inputs create', () => {
  it('creates an S3 input', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/inputs/create/s3.js');
    await Cmd.run(['--name', 'My S3', '--bucket', 'my-bucket', '--access-key', 'AK', '--secret-key', 'SK', '--json']);
    cap.restore();
    expect(inputCreateS3Mock).toHaveBeenCalled();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('in-new-s3');
  });

  it('creates a GCS input', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/inputs/create/gcs.js');
    await Cmd.run(['--name', 'My GCS', '--bucket', 'my-bucket', '--access-key', 'AK', '--secret-key', 'SK', '--json']);
    cap.restore();
    expect(inputCreateGcsMock).toHaveBeenCalled();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('in-new-gcs');
  });

  it('creates an HTTPS input', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/inputs/create/https.js');
    await Cmd.run(['--name', 'My CDN', '--host', 'cdn.example.com', '--json']);
    cap.restore();
    expect(inputCreateHttpsMock).toHaveBeenCalled();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('in-new-https');
  });
});

describe('encoding outputs list', () => {
  it('lists all outputs as JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/outputs/list.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(2);
  });

  it('filters by --type s3', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/outputs/list.js');
    await Cmd.run(['--type', 's3', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe('S3');
  });
});

describe('encoding outputs get', () => {
  it('gets output by ID', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/outputs/get.js');
    await Cmd.run(['out-1', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('out-1');
  });
});

describe('encoding outputs delete', () => {
  it('deletes with auto-detected type', async () => {
    const capErr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/outputs/delete.js');
    await Cmd.run(['out-1']);
    cap.restore();
    capErr.mockRestore();
    expect(outputDeleteS3Mock).toHaveBeenCalledWith('out-1');
  });
});

describe('encoding outputs create', () => {
  it('creates an S3 output', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/outputs/create/s3.js');
    await Cmd.run(['--name', 'My S3', '--bucket', 'my-bucket', '--access-key', 'AK', '--secret-key', 'SK', '--json']);
    cap.restore();
    expect(outputCreateS3Mock).toHaveBeenCalled();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('out-new-s3');
  });

  it('creates a GCS output', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/outputs/create/gcs.js');
    await Cmd.run(['--name', 'My GCS', '--bucket', 'my-bucket', '--access-key', 'AK', '--secret-key', 'SK', '--json']);
    cap.restore();
    expect(outputCreateGcsMock).toHaveBeenCalled();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('out-new-gcs');
  });
});
