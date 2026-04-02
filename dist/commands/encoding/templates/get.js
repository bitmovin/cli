import { Args } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingTemplateGet extends BaseCommand {
    static description = 'Get details of a stored encoding template';
    static args = {
        id: Args.string({ description: 'Template ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
    };
    async run() {
        const { args } = await this.parse(EncodingTemplateGet);
        const result = await (await this.getApi()).encoding.templates.get(args.id);
        await this.outputData(result);
    }
}
//# sourceMappingURL=get.js.map