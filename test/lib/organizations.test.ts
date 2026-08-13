import {describe, it, expect, vi} from 'vitest';

vi.mock('../../src/lib/config.js', () => ({
  loadConfig: () => ({tenantOrgId: 'config-org'}),
  saveConfig: () => {},
  getConfigPath: () => '/mock/.config/bitmovin/config.json',
}));

const {toOrganizationRows} = await import('../../src/lib/organizations.js');
// Tenant resolution lives in its own module: it is a request concern, not an
// account-resource one, and base-command needs it without dragging in this file.
const {resolveTenantOrgId} = await import('../../src/lib/tenant.js');

describe('toOrganizationRows', () => {
  it('lists each root immediately followed by its sub-organizations', () => {
    const rows = toOrganizationRows([
      {id: 'sub-b', name: 'Beta Sub', parentId: 'root-1', type: 'SUB_ORGANIZATION'},
      {id: 'root-2', name: 'Zulu Root', type: 'ROOT_ORGANIZATION'},
      {id: 'sub-a', name: 'Alpha Sub', parentId: 'root-1', type: 'SUB_ORGANIZATION'},
      {id: 'root-1', name: 'Acme Root', type: 'ROOT_ORGANIZATION'},
    ]);

    expect(rows.map((row) => row.id)).toEqual(['root-1', 'sub-a', 'sub-b', 'root-2']);
    expect(rows[1]).toMatchObject({type: 'SUB_ORGANIZATION', parentId: 'root-1', active: false});
    expect(rows[0]).toMatchObject({type: 'ROOT_ORGANIZATION', parentId: null});
  });

  it('derives the type from parentId when the API omits it and marks the active org', () => {
    const rows = toOrganizationRows(
      [
        {id: 'root-1', name: 'Acme'},
        {id: 'sub-1', name: 'Acme EU', parentId: 'root-1'},
      ],
      'sub-1',
    );

    expect(rows.map((row) => [row.id, row.type, row.active])).toEqual([
      ['root-1', 'ROOT_ORGANIZATION', false],
      ['sub-1', 'SUB_ORGANIZATION', true],
    ]);
  });

  it('keeps sub-organizations whose parent is not visible, retaining their parentId', () => {
    const rows = toOrganizationRows([{id: 'sub-1', name: 'Orphan', parentId: 'invisible-root'}]);
    expect(rows).toEqual([{id: 'sub-1', name: 'Orphan', type: 'SUB_ORGANIZATION', parentId: 'invisible-root', active: false}]);
  });

  it('skips organizations without an id and survives a parentId cycle', () => {
    const rows = toOrganizationRows([
      {name: 'No id'},
      {id: 'a', name: 'A', parentId: 'b'},
      {id: 'b', name: 'B', parentId: 'a'},
    ]);

    expect(rows.map((row) => row.id).sort()).toEqual(['a', 'b']);
  });
});

describe('resolveTenantOrgId', () => {
  // Pure: the configured value is passed in rather than read from the config file,
  // so the same rule can serve SDK and REST calls (and a future --profile).
  it('prefers the flag over the configured organization', () => {
    expect(resolveTenantOrgId('flag-org', 'config-org')).toBe('flag-org');
  });

  it('falls back to the configured organization', () => {
    expect(resolveTenantOrgId(undefined, 'config-org')).toBe('config-org');
  });

  it('is undefined when neither is set, meaning the credential\'s own organization', () => {
    expect(resolveTenantOrgId(undefined, undefined)).toBeUndefined();
  });

  it('rejects a blank flag value instead of silently widening the scope', () => {
    // `--organization "$SUB_ORG"` with SUB_ORG unset would otherwise drop the
    // X-Tenant-Org-Id header while still sending organizationId: "", which the API
    // treats as absent — filing the ticket against the credential's own org.
    expect(() => resolveTenantOrgId('')).toThrow(/empty value/i);
    expect(() => resolveTenantOrgId('   ')).toThrow(/empty value/i);
  });
});
