import {Args, Flags} from '@oclif/core';
import {readFileSync} from 'node:fs';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingTemplateCreate extends BaseCommand {
  static override description = 'Store an encoding template for reuse';

  static override args = {
    file: Args.string({description: 'Path to YAML template file', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    name: Flags.string({description: 'Template name', required: true}),
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(EncodingTemplateCreate);
    const content = readFileSync(args.file, 'utf-8');
    const templatePayload: Record<string, unknown> = {name: flags.name, template: content};
    const result = await (await this.getApi()).encoding.templates.create(templatePayload as never);
    this.log(`Template created: ${(result as {id?: string}).id}`);
    await this.outputData(result);
  }
}
