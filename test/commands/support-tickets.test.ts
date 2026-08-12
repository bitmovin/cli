import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('../../src/lib/config.js', () => ({
  loadConfig: () => ({apiKey: 'test-key', tenantOrgId: 'config-org'}),
  saveConfig: () => {},
  getConfigPath: () => '/mock/.config/bitmovin/config.json',
}));

const apiRequest = vi.fn();
vi.mock('../../src/lib/rest.js', () => ({
  apiRequest: (path: string, options?: unknown) => apiRequest(path, options),
  TENANT_ORG_HEADER: 'X-Tenant-Org-Id',
}));

const prompt = {canPrompt: false, answer: false};
vi.mock('../../src/lib/confirm.js', () => ({
  canPrompt: () => prompt.canPrompt,
  confirmAction: async () => prompt.answer,
}));

function capture(): {output: () => string; errOutput: () => string; restore: () => void} {
  let out = '';
  let err = '';
  const outMock = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    out += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  });
  const errMock = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
    err += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  });
  const logMock = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    out += args.join(' ') + '\n';
  });
  return {
    output: () => out,
    errOutput: () => err,
    restore: () => {
      outMock.mockRestore();
      errMock.mockRestore();
      logMock.mockRestore();
    },
  };
}

const ticket = {
  caseId: 123_456,
  subject: 'Encoding fails',
  status: 'open',
  category: 'ENCODING',
  priority: 'HIGH',
  severity: 'MEDIUM',
  createdAt: '2026-08-01T10:00:00.000Z',
  modifiedAt: '2026-08-02T11:00:00.000Z',
};

/** oclif this.exit()/this.error() throws an Error carrying an oclif descriptor */
function isOclifExit(err: unknown): boolean {
  return err instanceof Error && (err as {oclif?: {exit?: number}}).oclif?.exit !== undefined;
}

describe('support tickets list', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    prompt.canPrompt = false;
    prompt.answer = false;
  });

  it('lists tickets for the configured organization', async () => {
    apiRequest.mockResolvedValue({items: [ticket], totalCount: 1});
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/list.js');
    await Cmd.run(['--json']);
    cap.restore();

    expect(JSON.parse(cap.output())[0].caseId).toBe(123_456);
    expect(apiRequest).toHaveBeenCalledWith('/account/zendesk/tickets', expect.objectContaining({tenantOrgId: 'config-org'}));
    const options = apiRequest.mock.calls[0][1] as {query: Record<string, unknown>};
    expect(options.query).toMatchObject({limit: 25, offset: 0});
  });

  it('targets a sub-organization with --organization and passes filters through', async () => {
    apiRequest.mockResolvedValue({items: [], totalCount: 0});
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/list.js');
    await Cmd.run(['--organization', 'sub-org-1', '--status', 'open,pending', '--sort', 'modifiedAt:DESC', '--json']);
    cap.restore();

    const [, options] = apiRequest.mock.calls[0] as [string, {tenantOrgId?: string; query: Record<string, unknown>}];
    expect(options.tenantOrgId).toBe('sub-org-1');
    expect(options.query).toMatchObject({status: 'open,pending', sort: 'modifiedAt:DESC'});
  });

  it('rejects an offset that is not a page boundary without calling the API', async () => {
    const {default: Cmd} = await import('../../src/commands/support/tickets/list.js');
    await expect(Cmd.run(['--limit', '25', '--offset', '30', '--json'])).rejects.toThrow(/multiple of --limit/);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('rejects punctuation in --search without calling the API', async () => {
    const {default: Cmd} = await import('../../src/commands/support/tickets/list.js');
    await expect(Cmd.run(['--search', 'why-not', '--json'])).rejects.toThrow(/letters, digits, and spaces/);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('names the targeted organization when the API denies access', async () => {
    const denied = Object.assign(new Error('Access denied'), {httpStatusCode: 403, tenantOrgId: 'sub-org-1'});
    apiRequest.mockRejectedValue(denied);
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/list.js');
    try {
      await Cmd.run(['--organization', 'sub-org-1']);
    } catch (err) {
      if (!isOclifExit(err)) throw err;
    }

    cap.restore();
    expect(cap.errOutput()).toContain('Access denied');
    expect(cap.errOutput()).toContain('sub-org-1');
    expect(cap.errOutput()).toContain('bitmovin account organizations list');
  });
});

describe('support tickets get', () => {
  beforeEach(() => apiRequest.mockReset());

  it('shows the ticket and its comment conversation', async () => {
    apiRequest.mockResolvedValue({
      ...ticket,
      requester: {name: 'Jane Customer'},
      organization: {id: 'config-org', name: 'Acme'},
      comments: [{id: 1, body: 'Please check the logs.', createdAt: '2026-08-01T10:05:00.000Z', author: {name: 'Bitmovin Support', agent: true}}],
    });
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/get.js');
    await Cmd.run(['123456']);
    cap.restore();

    expect(apiRequest).toHaveBeenCalledWith('/account/zendesk/tickets/123456', expect.objectContaining({tenantOrgId: 'config-org'}));
    const out = cap.output();
    expect(out).toContain('Encoding fails');
    expect(out).toContain('Bitmovin Support');
    expect(out).toContain('Please check the logs.');
  });
});

describe('support tickets create', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    prompt.canPrompt = false;
    prompt.answer = false;
  });

  it('refuses to create anything without a confirmation when prompting is impossible', async () => {
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/create.js');
    await expect(Cmd.run(['--category', 'other', '--body', 'It broke.'])).rejects.toThrow(/requires confirmation/);
    cap.restore();

    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('refuses in --json mode without --yes', async () => {
    const {default: Cmd} = await import('../../src/commands/support/tickets/create.js');
    prompt.canPrompt = true;
    await expect(Cmd.run(['--category', 'other', '--body', 'It broke.', '--json'])).rejects.toThrow(/requires confirmation/);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('prints the payload and creates nothing when the confirmation is declined', async () => {
    prompt.canPrompt = true;
    prompt.answer = false;
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/create.js');
    await Cmd.run(['--category', 'other', '--body', 'It broke.']);
    cap.restore();

    expect(cap.output()).toContain('REAL support ticket');
    expect(cap.output()).toContain('"body": "It broke."');
    expect(cap.output()).toContain('Aborted. No ticket was created.');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('creates the ticket once the confirmation is accepted', async () => {
    prompt.canPrompt = true;
    prompt.answer = true;
    apiRequest.mockResolvedValue({id: 987, subject: 'It broke.'});
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/create.js');
    await Cmd.run(['--category', 'encoding', '--body', 'It broke.', '--encoding-id', 'enc-1']);
    cap.restore();

    expect(apiRequest).toHaveBeenCalledTimes(1);
    const [path, options] = apiRequest.mock.calls[0] as [string, {method: string; body: Record<string, unknown>; tenantOrgId?: string}];
    expect(path).toBe('/account/zendesk/tickets');
    expect(options.method).toBe('POST');
    expect(options.tenantOrgId).toBe('config-org');
    // organizationId must match the X-Tenant-Org-Id the request is sent with
    expect(options.body).toEqual({body: 'It broke.', category: 'encoding', encodingId: 'enc-1', organizationId: 'config-org'});
    expect(cap.output()).toContain('Support ticket created: 987');
  });

  it('skips the prompt with --yes and keeps organizationId aligned with --organization', async () => {
    apiRequest.mockResolvedValue({id: 988});
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/create.js');
    await Cmd.run(['--category', 'other', '--body', 'It broke.', '--organization', 'sub-org-1', '--yes']);
    cap.restore();

    const [, options] = apiRequest.mock.calls[0] as [string, {body: Record<string, unknown>; tenantOrgId?: string}];
    expect(options.tenantOrgId).toBe('sub-org-1');
    expect(options.body.organizationId).toBe('sub-org-1');
  });

  it('rejects category-gated fields before asking for confirmation', async () => {
    const {default: Cmd} = await import('../../src/commands/support/tickets/create.js');
    await expect(Cmd.run(['--category', 'other', '--body', 'x', '--encoding-id', 'enc-1', '--yes'])).rejects.toThrow(
      /--encoding-id requires --category encoding/,
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('requires a body', async () => {
    const {default: Cmd} = await import('../../src/commands/support/tickets/create.js');
    await expect(Cmd.run(['--category', 'other', '--yes'])).rejects.toThrow(/ticket body is required/);
    expect(apiRequest).not.toHaveBeenCalled();
  });
});

describe('support tickets comment', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    prompt.canPrompt = false;
    prompt.answer = false;
  });

  it('stamps the comment with the ticket modifiedAt for collision protection', async () => {
    apiRequest.mockImplementation(async (path: string) =>
      path.endsWith('/comments') ? {caseId: 123_456, modifiedAt: '2026-08-02T12:00:00.000Z'} : ticket,
    );
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/comment.js');
    await Cmd.run(['123456', '--body', 'Still broken\non 8.150.0', '--yes']);
    cap.restore();

    const [getPath] = apiRequest.mock.calls[0] as [string];
    expect(getPath).toBe('/account/zendesk/tickets/123456');
    const [postPath, options] = apiRequest.mock.calls[1] as [string, {method: string; body: Record<string, unknown>; tenantOrgId?: string}];
    expect(postPath).toBe('/account/zendesk/tickets/123456/comments');
    expect(options.method).toBe('POST');
    expect(options.tenantOrgId).toBe('config-org');
    expect(options.body).toEqual({htmlBody: 'Still broken<br>\non 8.150.0', updatedStamp: '2026-08-02T11:00:00.000Z'});
  });

  it('refuses to post without a confirmation when prompting is impossible', async () => {
    apiRequest.mockResolvedValue(ticket);
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/comment.js');
    await expect(Cmd.run(['123456', '--body', 'hello'])).rejects.toThrow(/requires confirmation/);
    cap.restore();

    expect(apiRequest).toHaveBeenCalledTimes(1); // the ticket read only
  });

  it('does not post when the confirmation is declined', async () => {
    apiRequest.mockResolvedValue(ticket);
    prompt.canPrompt = true;
    prompt.answer = false;
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/comment.js');
    await Cmd.run(['123456', '--body', 'hello']);
    cap.restore();

    expect(cap.output()).toContain('PUBLIC comment');
    expect(cap.output()).toContain('Aborted. No comment was posted.');
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('fails clearly when the ticket has no modifiedAt to stamp with', async () => {
    apiRequest.mockResolvedValue({...ticket, modifiedAt: undefined});
    const {default: Cmd} = await import('../../src/commands/support/tickets/comment.js');
    await expect(Cmd.run(['123456', '--body', 'hello', '--yes'])).rejects.toThrow(/collision protection/);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('sends HTML as-is with --html', async () => {
    apiRequest.mockImplementation(async (path: string) => (path.endsWith('/comments') ? {caseId: 1} : ticket));
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/comment.js');
    await Cmd.run(['123456', '--body', '<p>hi</p>', '--html', '--yes']);
    cap.restore();

    const [, options] = apiRequest.mock.calls[1] as [string, {body: Record<string, unknown>}];
    expect(options.body.htmlBody).toBe('<p>hi</p>');
  });
});
