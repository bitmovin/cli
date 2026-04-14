import {describe, it, expect, vi} from 'vitest';

const mockAccountInfo = {
  id: 'acc-1',
  email: 'user@bitmovin.com',
  firstName: 'Test',
  lastName: 'User',
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
});
