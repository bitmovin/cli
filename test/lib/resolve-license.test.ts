import {describe, it, expect} from 'vitest';
import {resolvePlayerLicense, resolveAnalyticsLicense} from '../../src/lib/resolve-license.js';

function mockApi(items: any[]) {
  return {
    player: {
      licenses: {
        list: async () => ({items}),
      },
    },
    analytics: {
      licenses: {
        list: async () => ({items}),
      },
    },
  };
}

const licenses = [
  {id: 'aaa-111', licenseKey: 'key-aaa', name: 'Production'},
  {id: 'bbb-222', licenseKey: 'key-bbb', name: 'Staging'},
  {id: 'ccc-333', licenseKey: 'key-ccc', name: 'Dev'},
];

describe('resolvePlayerLicense', () => {
  it('resolves by ID', async () => {
    const api = mockApi(licenses);
    expect(await resolvePlayerLicense(api, 'aaa-111')).toBe('aaa-111');
  });

  it('resolves by license key', async () => {
    const api = mockApi(licenses);
    expect(await resolvePlayerLicense(api, 'key-bbb')).toBe('bbb-222');
  });

  it('resolves by name', async () => {
    const api = mockApi(licenses);
    expect(await resolvePlayerLicense(api, 'Staging')).toBe('bbb-222');
  });

  it('prefers ID over name', async () => {
    // Edge case: a name that matches another item's ID
    const items = [
      {id: 'match-id', licenseKey: 'key1', name: 'Something'},
      {id: 'other-id', licenseKey: 'key2', name: 'match-id'},
    ];
    const api = mockApi(items);
    expect(await resolvePlayerLicense(api, 'match-id')).toBe('match-id');
  });

  it('prefers license key over name', async () => {
    const items = [
      {id: 'id1', licenseKey: 'ambiguous', name: 'Something'},
      {id: 'id2', licenseKey: 'key2', name: 'ambiguous'},
    ];
    const api = mockApi(items);
    expect(await resolvePlayerLicense(api, 'ambiguous')).toBe('id1');
  });

  it('throws when not found', async () => {
    const api = mockApi(licenses);
    await expect(resolvePlayerLicense(api, 'nonexistent')).rejects.toThrow('No player license found');
  });
});

describe('resolveAnalyticsLicense', () => {
  it('resolves by ID', async () => {
    const api = mockApi(licenses);
    expect(await resolveAnalyticsLicense(api, 'ccc-333')).toBe('ccc-333');
  });

  it('resolves by name', async () => {
    const api = mockApi(licenses);
    expect(await resolveAnalyticsLicense(api, 'Dev')).toBe('ccc-333');
  });

  it('throws when not found', async () => {
    const api = mockApi(licenses);
    await expect(resolveAnalyticsLicense(api, 'nope')).rejects.toThrow('No analytics license found');
  });
});
