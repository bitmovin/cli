import {describe, it, expect, vi} from 'vitest';

const deleteMock = vi.fn().mockResolvedValue({});

vi.mock('../../src/lib/client.js', () => ({
  getClient: () => ({
    encoding: {
      encodings: {
        delete: deleteMock,
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

describe('encoding jobs delete', () => {
  it('deletes an encoding by ID', async () => {
    const capErr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/jobs/delete.js');
    await Cmd.run(['enc-delete-1']);
    cap.restore();
    capErr.mockRestore();
    expect(deleteMock).toHaveBeenCalledWith('enc-delete-1');
  });
});
