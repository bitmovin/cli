import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingTemplateDelete extends BaseCommand {
  static override description = 'Delete a stored encoding template';

  static override args = {
    id: Args.string({description: 'Template ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args} = await this.parse(EncodingTemplateDelete);
    await (await this.getApi()).encoding.templates.delete(args.id);
    this.log(`Template ${args.id} deleted.`);
  }
}
