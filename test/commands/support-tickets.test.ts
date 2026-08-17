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
vi.mock('../../src/lib/confirm.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/confirm.js')>();
  return {
    // The real yesFlag, so the flag definition stays under test here.
    ...actual,
    canPrompt: () => prompt.canPrompt,
    confirmAction: async () => prompt.answer,
    // Mirrors the real policy against the fixture; the policy itself is tested
    // directly in test/lib/confirm.test.ts, which does not mock this module.
    confirmDestructive: async ({jsonMode, yes}: {jsonMode: boolean; yes: boolean}) => {
      if (yes) return 'proceed';
      if (jsonMode || !prompt.canPrompt) return 'unconfirmable';
      return prompt.answer ? 'proceed' : 'declined';
    },
  };
});

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
    expect(apiRequest).toHaveBeenCalledWith('/support/tickets', expect.objectContaining({tenantOrgId: 'config-org'}));
    const options = apiRequest.mock.calls[0][1] as {query: Record<string, unknown>};
    expect(options.query).toMatchObject({limit: 25, offset: 0});
  });

  it('does not present the total as exact when the API prioritises pending tickets', async () => {
    // With no --sort and no filter the API pulls tickets awaiting a customer reply
    // to the front, and its totalCount then counts only those — so reporting it as
    // the grand total would understate the org's tickets.
    apiRequest.mockResolvedValue({items: [ticket], totalCount: 40});
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/list.js');
    await Cmd.run([]);
    cap.restore();

    expect(cap.output()).toContain('Showing 1-1');
    expect(cap.output()).not.toContain('of 40');
    expect(cap.output()).toContain('--sort createdAt:DESC');
  });

  it('reports an exact total once a sort or filter pins the ordering', async () => {
    apiRequest.mockResolvedValue({items: [ticket], totalCount: 40});
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/list.js');
    await Cmd.run(['--sort', 'createdAt:DESC']);
    cap.restore();

    expect(cap.output()).toContain('Showing 1-1 of 40.');
  });

  it('normalizes filter spacing the API would reject', async () => {
    apiRequest.mockResolvedValue({items: [], totalCount: 0});
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/list.js');
    await Cmd.run(['--status', 'open, pending', '--json']);
    cap.restore();

    const options = apiRequest.mock.calls[0][1] as {query: Record<string, unknown>};
    expect(options.query.status).toBe('open,pending');
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

  it('names the targeted organization even when the error does not carry one', async () => {
    // The SDK's BitmovinError never carries tenantOrgId, so reading it off the error
    // alone named the *configured* organization for a --organization request — the
    // wrong one, and precisely the org the user did not ask about.
    const denied = Object.assign(new Error('Access denied'), {httpStatusCode: 403});
    apiRequest.mockRejectedValue(denied);
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/list.js');
    try {
      await Cmd.run(['--organization', 'sub-org-1']);
    } catch (err) {
      if (!isOclifExit(err)) throw err;
    }

    cap.restore();
    expect(cap.errOutput()).toContain('sub-org-1');
    expect(cap.errOutput()).not.toContain('config-org');
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

    expect(apiRequest).toHaveBeenCalledWith('/support/tickets/123456', expect.objectContaining({tenantOrgId: 'config-org'}));
    const out = cap.output();
    expect(out).toContain('Encoding fails');
    expect(out).toContain('Bitmovin Support');
    expect(out).toContain('Please check the logs.');
  });

  it('hides attachment URLs by default and reveals them with --show-secrets', async () => {
    // The API documents these as downloadable by anyone holding the link, so they
    // are masked like any other secret — a CI log or terminal recording would
    // otherwise hand out the customer's attachment with no credential needed.
    const detail = {
      ...ticket,
      comments: [
        {
          id: 1,
          body: 'logs attached',
          author: {name: 'Jane Customer'},
          attachments: [{id: 7, fileName: 'crash.log', url: 'https://files.example.com/crash.log?token=SECRET'}],
        },
      ],
    };

    apiRequest.mockResolvedValue(detail);
    let cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/get.js');
    await Cmd.run(['123456']);
    cap.restore();
    expect(cap.output()).toContain('crash.log');
    expect(cap.output()).not.toContain('token=SECRET');

    apiRequest.mockResolvedValue(detail);
    cap = capture();
    await Cmd.run(['123456', '--show-secrets']);
    cap.restore();
    expect(cap.output()).toContain('token=SECRET');
  });

  it('hides attachment URLs in --json too, where masking used to be skipped entirely', async () => {
    // JSON mode returned the raw payload, so `get --json` (which the --jq example
    // steers users towards) handed every capability URL to a CI log.
    const detail = {
      ...ticket,
      comments: [
        {
          id: 1,
          body: 'logs attached',
          attachments: [{id: 7, fileName: 'crash.log', url: 'https://files.example.com/crash.log?token=SECRET'}],
        },
      ],
    };

    apiRequest.mockResolvedValue(detail);
    let cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/get.js');
    await Cmd.run(['123456', '--json']);
    cap.restore();

    const masked = JSON.parse(cap.output());
    expect(cap.output()).not.toContain('token=SECRET');
    expect(masked.comments[0].attachments[0].fileName).toBe('crash.log');
    expect(masked.comments[0].attachments[0].url).toContain('--show-secrets');

    apiRequest.mockResolvedValue(detail);
    cap = capture();
    await Cmd.run(['123456', '--json', '--show-secrets']);
    cap.restore();
    expect(JSON.parse(cap.output()).comments[0].attachments[0].url).toContain('token=SECRET');
  });

  it('strips control characters from ticket text before printing it', async () => {
    apiRequest.mockResolvedValue({
      ...ticket,
      subject: 'Encoding\u001B[2K fails',
      comments: [{id: 1, body: 'before\u001B[1Aafter', author: {name: 'Jane\u0000 Customer'}}],
    });
    const cap = capture();
    const {default: Cmd} = await import('../../src/commands/support/tickets/get.js');
    await Cmd.run(['123456']);
    cap.restore();

    expect(cap.output()).not.toContain('\u001B[2K');
    expect(cap.output()).not.toContain('\u001B[1A');
    expect(cap.output()).toContain('Jane Customer');
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

    // The preview is a warning, so it goes to stderr; stdout stays reserved for
    // command output (and stays valid JSON in --json mode).
    expect(cap.errOutput()).toContain('REAL support ticket');
    expect(cap.errOutput()).toContain('It broke.');
    expect(cap.output()).not.toContain('REAL support ticket');
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
    expect(path).toBe('/support/tickets');
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
    expect(getPath).toBe('/support/tickets/123456');
    const [postPath, options] = apiRequest.mock.calls[1] as [string, {method: string; body: Record<string, unknown>; tenantOrgId?: string}];
    expect(postPath).toBe('/support/tickets/123456/comments');
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

    expect(cap.errOutput()).toContain('PUBLIC comment');
    expect(cap.output()).toContain('Aborted. No comment was posted.');
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('fails clearly when the ticket has no modifiedAt to stamp with', async () => {
    apiRequest.mockResolvedValue({...ticket, modifiedAt: undefined});
    const {default: Cmd} = await import('../../src/commands/support/tickets/comment.js');
    await expect(Cmd.run(['123456', '--body', 'hello', '--yes'])).rejects.toThrow(/collision protection/);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('bounds --body like create does, instead of previewing an unbounded file', async () => {
    // create and comment now share one body resolver; while each had its own copy,
    // only create applied the length cap.
    apiRequest.mockResolvedValue(ticket);
    const {default: Cmd} = await import('../../src/commands/support/tickets/comment.js');
    await expect(Cmd.run(['123456', '--body', 'x'.repeat(65_537), '--yes'])).rejects.toThrow(/the maximum is 65536/);
    expect(apiRequest).not.toHaveBeenCalled();
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
