import {describe, it, expect, vi} from 'vitest';

vi.mock('../../src/lib/config.js', () => ({
  loadConfig: () => ({apiKey: 'test-key', tenantOrgId: 'sub-1'}),
  saveConfig: () => {},
  getConfigPath: () => '/mock/.config/bitmovin/config.json',
}));

const organizations = [
  {id: 'root-1', name: 'Acme', type: 'ROOT_ORGANIZATION'},
  {id: 'sub-1', name: 'Acme EU', type: 'SUB_ORGANIZATION', parentId: 'root-1'},
  {id: 'sub-2', name: 'Acme US', type: 'SUB_ORGANIZATION', parentId: 'root-1'},
];

const subOrganizationsList = vi.fn();
const sdkOrganizationsList = vi.fn(async () => ({items: organizations}));

vi.mock('../../src/lib/client.js', () => ({
  getClient: async () => ({
    account: {
      organizations: {
        list: sdkOrganizationsList,
        subOrganizations: {list: subOrganizationsList},
      },
    },
  }),
}));

// Organizations are paged through the REST helper, not the SDK: the SDK's
// `organizations.list()` takes no arguments and so silently returns only the first
// page. Pages are served from `organizations` above so the paging loop is exercised.
const apiRequest = vi.fn(async (path: string, options?: {query?: {limit?: number; offset?: number}}) => {
  if (path !== '/account/organizations') throw new Error(`unexpected path ${path}`);
  const offset = options?.query?.offset ?? 0;
  const limit = options?.query?.limit ?? 100;
  return {items: organizations.slice(offset, offset + limit), totalCount: organizations.length};
});

vi.mock('../../src/lib/rest.js', () => ({apiRequest: (...args: unknown[]) => apiRequest(...(args as [string])), TENANT_ORG_HEADER: 'X-Tenant-Org-Id'}));

function captureStdout(): {output: () => string; restore: () => void} {
  let captured = '';
  const mock = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  });
  return {output: () => captured, restore: () => mock.mockRestore()};
}

describe('account organizations list', () => {
  it('reports type, parentId and the active organization in JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/organizations/list.js');
    await Cmd.run(['--json']);
    cap.restore();

    const data = JSON.parse(cap.output());
    expect(data.map((row: {id: string}) => row.id)).toEqual(['root-1', 'sub-1', 'sub-2']);
    expect(data[0]).toEqual({id: 'root-1', name: 'Acme', type: 'ROOT_ORGANIZATION', parentId: null, active: false});
    expect(data[1]).toEqual({id: 'sub-1', name: 'Acme EU', type: 'SUB_ORGANIZATION', parentId: 'root-1', active: true});
  });

  it('does not call the unreliable sub-organizations endpoint', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/organizations/list.js');
    await Cmd.run(['--json']);
    cap.restore();

    expect(subOrganizationsList).not.toHaveBeenCalled();
  });

  it('pages the organizations endpoint instead of the unpaged SDK call', async () => {
    // The SDK's organizations.list() accepts no query parameters, so using it would
    // silently cap the listing at the API's default page — sub-orgs whose parent
    // landed on a later page would then be rendered as roots.
    apiRequest.mockClear();
    sdkOrganizationsList.mockClear();
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/organizations/list.js');
    await Cmd.run(['--json']);
    cap.restore();

    expect(sdkOrganizationsList).not.toHaveBeenCalled();
    expect(apiRequest).toHaveBeenCalledWith('/account/organizations', expect.objectContaining({query: {limit: 100, offset: 0}}));
  });

  it('keeps requesting pages until every organization is collected', async () => {
    // Drives the paging loop directly with a page size of 2, so the three orgs span
    // two pages: a parent on page 1 with a sub-org on page 2 must still nest.
    const {listOrganizations, toOrganizationRows} = await import('../../src/lib/organizations.js');
    apiRequest.mockClear();

    const orgs = await listOrganizations(undefined, 2);

    expect(apiRequest).toHaveBeenCalledTimes(2);
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/account/organizations', expect.objectContaining({query: {limit: 2, offset: 0}}));
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/account/organizations', expect.objectContaining({query: {limit: 2, offset: 2}}));
    expect(toOrganizationRows(orgs).map((row) => row.id)).toEqual(['root-1', 'sub-1', 'sub-2']);
  });

  it('refuses to return a truncated organization list', async () => {
    // A short page while totalCount says there is more means the server capped the
    // page size; offsets are page-aligned so we cannot resume mid-page. Returning
    // the partial list would render sub-orgs as roots.
    const {listOrganizations} = await import('../../src/lib/organizations.js');
    apiRequest.mockClear();
    apiRequest.mockImplementationOnce(async () => ({items: organizations.slice(0, 1), totalCount: 9}));

    await expect(listOrganizations(undefined, 2)).rejects.toThrow(/only 1 of 9 organizations/);
  });

  it('filters to the sub-organizations of a parent', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/organizations/list.js');
    await Cmd.run(['--parent', 'root-1', '--json']);
    cap.restore();

    expect(JSON.parse(cap.output()).map((row: {id: string}) => row.id)).toEqual(['sub-1', 'sub-2']);
  });

  it('filters by type', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/organizations/list.js');
    await Cmd.run(['--type', 'root', '--json']);
    cap.restore();

    expect(JSON.parse(cap.output()).map((row: {id: string}) => row.id)).toEqual(['root-1']);
  });

  it('fails with an actionable message for an invisible parent', async () => {
    const {default: Cmd} = await import('../../src/commands/account/organizations/list.js');
    await expect(Cmd.run(['--parent', 'nope', '--json'])).rejects.toThrow(/not visible to these credentials/);
  });

  it('renders the id, type and parentId in table output', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/organizations/list.js');
    await Cmd.run([]);
    cap.restore();

    const out = cap.output();
    expect(out).toContain('sub-1');
    expect(out).toContain('SUB_ORGANIZATION');
    expect(out).toContain('root-1');
  });
});

describe('organization listing scope and bounds', () => {
  it('forwards --api-key so the listing follows the credential you asked for', async () => {
    // Both organization commands previously hand-threaded this; if it is dropped the
    // command silently lists the config key's organizations instead.
    apiRequest.mockClear();
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/organizations/list.js');
    await Cmd.run(['--api-key', 'other-account-key', '--json']);
    cap.restore();

    expect(apiRequest).toHaveBeenCalledWith('/account/organizations', expect.objectContaining({apiKey: 'other-account-key'}));
  });

  it('stops instead of looping forever when the API ignores the offset', async () => {
    // A proxy that strips query parameters would otherwise return the same full page
    // for every offset and the loop would never end.
    const {listOrganizations} = await import('../../src/lib/organizations.js');
    apiRequest.mockClear();
    apiRequest.mockImplementation(async () => ({items: [{id: 'a'}, {id: 'b'}]}));

    await expect(listOrganizations(undefined, 2)).rejects.toThrow(/does not appear to be honouring the pagination offset/);
    // Explicit timeout: if the bound is ever removed this must fail fast rather than
    // hanging CI on an unbounded loop.
  }, 10_000);
});
