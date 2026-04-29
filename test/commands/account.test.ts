import {describe, it, expect, vi} from 'vitest';

const mockAccountInfo = {
  id: 'acc-1',
  email: 'user@bitmovin.com',
  firstName: 'Test',
  lastName: 'User',
  apiKeys: [
    {
      id: 'key-1',
      value: 'aaaabbbb-1111-2222-3333-eeeeeeeeffff',
      createdAt: null,
    },
  ],
  intercomIdVerification: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
};

vi.mock('../../src/lib/client.js', () => ({
  getClient: () => ({
    account: {
      information: {
        get: async () => mockAccountInfo,
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

describe('account info', () => {
  it('outputs JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/info.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.email).toBe('user@bitmovin.com');
    expect(data.firstName).toBe('Test');
  });

  it('outputs table data', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/info.js');
    await Cmd.run([]);
    cap.restore();
    const out = cap.output();
    expect(out).toContain('user@bitmovin.com');
  });

  it('masks the API key value by default', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/info.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(JSON.stringify(data)).not.toContain('aaaabbbb-1111-2222-3333-eeeeeeeeffff');
    expect(data.apiKeys[0].value).toBe('aaaa...ffff');
    expect(data.apiKeys[0].id).toBe('key-1');
  });

  it('masks the intercom verification token by default', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/info.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.intercomIdVerification).toBe('abcd...6789');
    expect(JSON.stringify(data)).not.toContain(
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    );
  });

  it('masks the API key value in default (table) output', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/info.js');
    await Cmd.run([]);
    cap.restore();
    const out = cap.output();
    expect(out).not.toContain('aaaabbbb-1111-2222-3333-eeeeeeeeffff');
    expect(out).toContain('aaaa...ffff');
  });

  it('shows secrets in plaintext when --show-secrets is set', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/account/info.js');
    await Cmd.run(['--json', '--show-secrets']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.apiKeys[0].value).toBe('aaaabbbb-1111-2222-3333-eeeeeeeeffff');
    expect(data.intercomIdVerification).toBe(
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    );
  });
});
