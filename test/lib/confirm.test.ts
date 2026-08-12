import {describe, it, expect, vi, afterEach} from 'vitest';

/**
 * The confirmation gate is a safety control, not UX: it is the only thing standing
 * between a scripted invocation and a real support ticket that cannot be withdrawn
 * via the API. Every command test stubs this module, so these tests exercise the
 * real implementation — without them, making `canPrompt()` return true
 * unconditionally or flipping the prompt default to yes breaks no test at all.
 */

const confirmSpy = vi.hoisted(() => vi.fn());
vi.mock('@inquirer/prompts', () => ({confirm: confirmSpy}));

function withTty(stdin: boolean, stdout: boolean): () => void {
  const originals = {stdin: process.stdin.isTTY, stdout: process.stdout.isTTY};
  Object.defineProperty(process.stdin, 'isTTY', {value: stdin, configurable: true});
  Object.defineProperty(process.stdout, 'isTTY', {value: stdout, configurable: true});
  return () => {
    Object.defineProperty(process.stdin, 'isTTY', {value: originals.stdin, configurable: true});
    Object.defineProperty(process.stdout, 'isTTY', {value: originals.stdout, configurable: true});
  };
}

afterEach(() => {
  confirmSpy.mockReset();
});

describe('canPrompt', () => {
  it('is true only when both stdin and stdout are a TTY', async () => {
    const {canPrompt} = await import('../../src/lib/confirm.js');

    for (const [stdin, stdout, expected] of [
      [true, true, true],
      [true, false, false], // stdout piped: `… | tee log` must not silently prompt
      [false, true, false], // stdin piped: `echo y | …` must not count as consent
      [false, false, false],
    ] as [boolean, boolean, boolean][]) {
      const restore = withTty(stdin, stdout);
      expect(canPrompt(), `stdin=${stdin} stdout=${stdout}`).toBe(expected);
      restore();
    }
  });
});

describe('confirmAction', () => {
  it('defaults to no, so a bare Enter does not file anything', async () => {
    const {confirmAction} = await import('../../src/lib/confirm.js');
    confirmSpy.mockResolvedValue(false);

    await expect(confirmAction('File this?')).resolves.toBe(false);
    expect(confirmSpy).toHaveBeenCalledWith(expect.objectContaining({message: 'File this?', default: false}));
  });

  it('resolves true only on an explicit yes', async () => {
    const {confirmAction} = await import('../../src/lib/confirm.js');
    confirmSpy.mockResolvedValue(true);

    await expect(confirmAction('File this?')).resolves.toBe(true);
  });
});
