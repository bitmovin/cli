import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingInputDelete extends BaseCommand {
  static override description = 'Delete an input';

  static override args = {
    id: Args.string({description: 'Input ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args} = await this.parse(EncodingInputDelete);
    await (await this.getApi()).encoding.inputs.s3.delete(args.id);
    this.log(`Input ${args.id} deleted.`);
  }
}
