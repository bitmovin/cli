import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingJobStop extends BaseCommand {
  static override description = 'Stop a running encoding';

  static override args = {
    id: Args.string({description: 'Encoding ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args} = await this.parse(EncodingJobStop);
    await (await this.getApi()).encoding.encodings.stop(args.id);
    this.log(`Encoding ${args.id} stop requested.`);
  }
}
