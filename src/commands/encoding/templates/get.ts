import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingTemplateGet extends BaseCommand {
  static override description = 'Get details of a stored encoding template';

  static override args = {
    id: Args.string({description: 'Template ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args} = await this.parse(EncodingTemplateGet);
    const result = await (await this.getApi()).encoding.templates.get(args.id);
    await this.outputData(result);
  }
}
