import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingOutputDelete extends BaseCommand {
  static override description = 'Delete an output';

  static override args = {
    id: Args.string({description: 'Output ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args} = await this.parse(EncodingOutputDelete);
    await (await this.getApi()).encoding.outputs.s3.delete(args.id);
    this.log(`Output ${args.id} deleted.`);
  }
}
