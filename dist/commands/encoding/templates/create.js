import { Args, Flags } from '@oclif/core';
import { readFileSync } from 'node:fs';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingTemplateCreate extends BaseCommand {
    static description = 'Store an encoding template for reuse';
    static args = {
        file: Args.string({ description: 'Path to YAML template file', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
        name: Flags.string({ description: 'Template name', required: true }),
    };
    async run() {
        const { args, flags } = await this.parse(EncodingTemplateCreate);
        const content = readFileSync(args.file, 'utf-8');
        const templatePayload = { name: flags.name, template: content };
        const result = await (await this.getApi()).encoding.templates.create(templatePayload);
        this.log(`Template created: ${result.id}`);
        await this.outputData(result);
    }
}
//# sourceMappingURL=create.js.map