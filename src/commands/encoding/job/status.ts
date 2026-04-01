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

    this.log(`Status:   ${printStatus(String(task.status))}`);
    this.log(`Progress: ${task.progress ?? 0}%`);
    if (task.eta) this.log(`ETA:      ${Math.round(task.eta / 60)}m${task.eta % 60}s`);

    if (task.messages?.length) {
      this.log('\nMessages:');
      for (const msg of task.messages.slice(-10)) {
        this.log(`  [${msg.type}] ${msg.text}`);
      }
    }
  }
}
