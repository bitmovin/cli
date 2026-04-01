import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingJobDelete extends BaseCommand {
  static override description = 'Delete an encoding';

  static override args = {
    id: Args.string({description: 'Encoding ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args} = await this.parse(EncodingJobDelete);
    await (await this.getApi()).encoding.encodings.delete(args.id);
    this.log(`Encoding ${args.id} deleted.`);
  }
}
