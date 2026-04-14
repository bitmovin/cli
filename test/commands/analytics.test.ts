import {describe, it, expect, vi} from 'vitest';

const mockAnalyticsLicenses = [
  {id: 'al-1', name: 'Prod Analytics', licenseKey: 'ak-prod', impressions: 5000, maxImpressions: 10000, timeZone: 'UTC', createdAt: '2026-01-01'},
  {id: 'al-2', name: 'Dev Analytics', licenseKey: 'ak-dev', impressions: 100, maxImpressions: 1000, timeZone: 'Europe/Vienna', createdAt: '2026-02-01'},
];

const mockDomains = {
  domains: [
    {id: 'ad-1', url: 'https://example.com'},
    {id: 'ad-2', url: 'https://staging.example.com'},
  ],
};

const domainCreateMock = vi.fn().mockResolvedValue({id: 'ad-new', url: 'https://new.example.com'});
const domainDeleteMock = vi.fn().mockResolvedValue({});

vi.mock('../../src/lib/client.js', () => ({
  getClient: () => ({
    analytics: {
      licenses: {
        list: async () => ({items: mockAnalyticsLicenses}),
        get: async (id: string) => mockAnalyticsLicenses.find((l) => l.id === id),
        domains: {
          get: async () => mockDomains,
          create: domainCreateMock,
          delete: domainDeleteMock,
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

describe('analytics licenses list', () => {
  it('outputs JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/analytics/licenses/list.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Prod Analytics');
    expect(data[0].licenseKey).toBe('ak-prod');
    expect(data[1].timeZone).toBe('Europe/Vienna');
  });

  it('outputs table data', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/analytics/licenses/list.js');
    await Cmd.run([]);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('al-1');
    expect(out).toContain('Prod Analytics');
  });
});

describe('analytics licenses get', () => {
  it('gets license by ID', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/analytics/licenses/get.js');
    await Cmd.run(['al-1', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.name).toBe('Prod Analytics');
    expect(data.impressions).toBe(5000);
  });
});

describe('analytics domains list', () => {
  it('lists domains by license ID', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/analytics/domains/list.js');
    await Cmd.run(['al-1', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(2);
    expect(data[0].url).toBe('https://example.com');
  });

  it('resolves by license key', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/analytics/domains/list.js');
    await Cmd.run(['ak-dev', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data).toHaveLength(2);
  });
});

describe('analytics domains add', () => {
  it('adds a domain', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/analytics/domains/add.js');
    await Cmd.run(['al-1', '--url', 'https://new.example.com', '--json']);
    cap.restore();
    expect(domainCreateMock).toHaveBeenCalled();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('ad-new');
  });
});
