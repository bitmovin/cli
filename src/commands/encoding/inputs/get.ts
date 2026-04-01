import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingInputGet extends BaseCommand {
  static override description = 'Get input details';

  static override args = {
    id: Args.string({description: 'Input ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args} = await this.parse(EncodingInputGet);
    const result = await (await this.getApi()).encoding.inputs.get(args.id);
    await this.outputData(result);
  }
}
