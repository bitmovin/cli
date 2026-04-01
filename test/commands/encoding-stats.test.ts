import {describe, it, expect, vi} from 'vitest';

const mockStats = {billableEncodingMinutes: 120, totalBytesEncoded: 5000000};
const mockDailyStats = {items: [{date: '2026-01-01', billableEncodingMinutes: 60}, {date: '2026-01-02', billableEncodingMinutes: 60}]};
const listByDateRangeMock = vi.fn().mockResolvedValue(mockDailyStats);

vi.mock('../../src/lib/client.js', () => ({
  getClient: () => ({
    encoding: {
      statistics: {
        get: async () => mockStats,
        daily: {
          listByDateRange: listByDateRangeMock,
        },
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

/** oclif this.error() and this.exit() throw errors we need to catch */
function isOclifExit(err: unknown): boolean {
  return err instanceof Error && (err as any).oclif?.exit !== undefined;
}

describe('encoding stats', () => {
  it('outputs overall stats as JSON', async () => {
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/stats.js');
    await Cmd.run(['--json']);
    cap.restore();
    const data = JSON.parse(cap.output());
    expect(data.billableEncodingMinutes).toBe(120);
  });

  it('outputs daily stats with date range', async () => {
    listByDateRangeMock.mockClear();
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/stats.js');
    await Cmd.run(['--from', '2026-01-01', '--to', '2026-01-02', '--json']);
    cap.restore();
    expect(listByDateRangeMock).toHaveBeenCalled();
  });

  it('errors when only --from is provided', async () => {
    const capErr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/stats.js');
    let threw = false;
    try {
      await Cmd.run(['--from', '2026-01-01']);
    } catch (err) {
      if (isOclifExit(err) || (err instanceof Error && err.message.includes('--from and --to'))) {
        threw = true;
      } else {
        throw err;
      }
    }
    cap.restore();
    capErr.mockRestore();
    expect(threw).toBe(true);
  });

  it('errors when only --to is provided', async () => {
    const capErr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const cap = captureStdout();
    const {default: Cmd} = await import('../../src/commands/encoding/stats.js');
    let threw = false;
    try {
      await Cmd.run(['--to', '2026-01-02']);
    } catch (err) {
      if (isOclifExit(err) || (err instanceof Error && err.message.includes('--from and --to'))) {
        threw = true;
      } else {
        throw err;
      }
    }
    cap.restore();
    capErr.mockRestore();
    expect(threw).toBe(true);
  });
});
