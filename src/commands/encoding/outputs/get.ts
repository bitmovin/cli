import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingOutputGet extends BaseCommand {
  static override description = 'Get output details';

  static override args = {
    id: Args.string({description: 'Output ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args} = await this.parse(EncodingOutputGet);
    const result = await (await this.getApi()).encoding.outputs.get(args.id);
    await this.outputData(result);
  }
}
