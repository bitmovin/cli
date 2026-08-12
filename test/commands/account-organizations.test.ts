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

vi.mock('../../src/lib/client.js', () => ({
  getClient: async () => ({
    account: {
      organizations: {
        list: async () => ({items: organizations}),
        subOrganizations: {list: subOrganizationsList},
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
