import {describe, it, expect, vi} from 'vitest';

const mockLicenses = [
  {id: 'lic-1', name: 'Production', licenseKey: 'key-prod', impressions: 5000, maxImpressions: 10000, createdAt: '2026-01-01'},
  {id: 'lic-2', name: 'Staging', licenseKey: 'key-staging', impressions: 100, maxImpressions: 1000, createdAt: '2026-02-01'},
];

const mockDomains = [
  {id: 'dom-1', url: 'https://example.com'},
  {id: 'dom-2', url: 'https://staging.example.com'},
];

vi.mock('../../src/lib/client.js', () => ({
  getClient: () => ({
    player: {
      licenses: {
        list: async () => ({items: mockLicenses}),
        get: async (id: string) => mockLicenses.find((l) => l.id === id),
        create: async (lic: any) => ({id: 'lic-new', ...lic}),
        domains: {
          list: async () => ({items: mockDomains}),
          create: async (_id: string, domain: any) => ({id: 'dom-new', url: domain?.url ?? domain?._url}),
          delete: async () => ({}),
        },
        analytics: {
          create: async () => ({}),
          delete: async () => ({}),
        },
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

describe('player licenses list', () => {
  it('outputs JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/player/licenses/list.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Production');
    expect(data[0].licenseKey).toBe('key-prod');
  });

  it('outputs table data', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/player/licenses/list.js');
    await Cmd.run([]);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('id');
    expect(out).toContain('lic-1');
    expect(out).toContain('Production');
  });
});

describe('player licenses get', () => {
  it('outputs JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/player/licenses/get.js');
    await Cmd.run(['lic-1', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.name).toBe('Production');
  });
});

describe('player domains list', () => {
  it('resolves by name and lists domains', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/player/domains/list.js');
    await Cmd.run(['Production', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(2);
    expect(data[0].url).toBe('https://example.com');
  });

  it('resolves by license key', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/player/domains/list.js');
    await Cmd.run(['key-staging', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(2);
  });
});

describe('player domains add', () => {
  it('adds a domain', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/player/domains/add.js');
    await Cmd.run(['lic-1', '--url', 'https://new.example.com', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('dom-new');
  });
});
