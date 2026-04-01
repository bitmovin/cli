import {describe, it, expect, vi} from 'vitest';

vi.mock('../../src/lib/client.js', () => ({
  getClient: () => ({
    player: {
      licenses: {
        create: async (lic: any) => ({id: 'lic-new', name: lic.name ?? lic._name}),
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

describe('player licenses create', () => {
  it('creates a license and outputs JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/player/licenses/create.js');
    await Cmd.run(['--name', 'My License', '--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.id).toBe('lic-new');
  });

  it('outputs human-readable success message', async () => {
    const cap = captureStdout();
    const capErr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const {default: Cmd} = await import('../../src/commands/player/licenses/create.js');
    await Cmd.run(['--name', 'Test License']);
    cap.restore();
    capErr.mockRestore();
    const out = cap.output();
    expect(out).toContain('lic-new');
  });
});
