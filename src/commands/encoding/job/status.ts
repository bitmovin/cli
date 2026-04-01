import {Args, Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import {waitForEncoding} from '../../../lib/wait.js';
import {printStatus} from '../../../lib/output.js';

export default class EncodingJobStatus extends BaseCommand {
  static override description = 'Get encoding status';

  static override args = {
    id: Args.string({description: 'Encoding ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    watch: Flags.boolean({char: 'w', description: 'Poll until encoding finishes'}),
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(EncodingJobStatus);

    if (flags.watch) {
      const task = await waitForEncoding(await this.getApi(), args.id);
      await this.outputData(task);
      return;
    }

    const task = await (await this.getApi()).encoding.encodings.status(args.id);

    if (await this.isJsonMode()) {
      await this.outputData(task);
      return;
    }

    // Human-readable output to stdout
    const out = process.stdout;
    out.write(`Status:   ${printStatus(String(task.status))}\n`);
    out.write(`Progress: ${task.progress ?? 0}%\n`);
    if (task.eta) out.write(`ETA:      ${Math.round(task.eta / 60)}m${task.eta % 60}s\n`);

    if (task.messages?.length) {
      out.write('\nMessages:\n');
      for (const msg of task.messages.slice(-10)) {
        out.write(`  [${msg.type}] ${msg.text}\n`);
      }
    }
  }
}
