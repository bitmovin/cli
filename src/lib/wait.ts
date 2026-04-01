import ora from 'ora';
import chalk from 'chalk';

const POLL_INTERVAL_MS = 5000;
const TERMINAL_STATUSES = new Set(['FINISHED', 'ERROR', 'CANCELED', 'TRANSFER_ERROR']);
const isTTY = Boolean(process.stderr.isTTY);

export async function waitForEncoding(api: any, encodingId: string): Promise<any> {
  const spinner = isTTY
    ? ora({text: `Encoding ${encodingId}  starting...`, color: 'cyan', stream: process.stderr}).start()
    : null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const task = await api.encoding.encodings.status(encodingId);
    const status = String(task.status ?? 'UNKNOWN');
    const progress = task.progress ?? 0;
    const eta = task.eta ? ` ETA: ${Math.round(task.eta / 60)}m${task.eta % 60}s` : '';

    if (spinner) {
      const bar = progressBar(progress);
      spinner.text = `Encoding ${encodingId}  ${bar}  ${progress}%${eta}  [${statusColor(status)}]`;
    } else {
      process.stderr.write(`${encodingId}\t${status}\t${progress}%${eta}\n`);
    }

    if (TERMINAL_STATUSES.has(status)) {
      if (spinner) {
        if (status === 'FINISHED') {
          spinner.succeed(`Encoding ${encodingId} ${chalk.green('FINISHED')}`);
        } else {
          spinner.fail(`Encoding ${encodingId} ${statusColor(status)}`);
        }
      }

      if (task.messages) {
        for (const msg of task.messages) {
          if (msg.type === 'ERROR') {
            process.stderr.write(`  ERROR: ${msg.text}\n`);
          }
        }
      }

      return task;
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

function progressBar(percent: number): string {
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;
  return chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}

function statusColor(status: string): string {
  switch (status) {
    case 'FINISHED':
      return chalk.green(status);
    case 'ERROR':
    case 'TRANSFER_ERROR':
      return chalk.red(status);
    case 'RUNNING':
      return chalk.blue(status);
    default:
      return chalk.yellow(status);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
