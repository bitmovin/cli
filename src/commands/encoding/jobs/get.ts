import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingJobGet extends BaseCommand {
  static override description = 'Get encoding details';

  static override args = {
    id: Args.string({description: 'Encoding ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args} = await this.parse(EncodingJobGet);
    const result = await (await this.getApi()).encoding.encodings.get(args.id);
    await this.outputData(result);
  }
}
