import { Args } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingTemplateDelete extends BaseCommand {
    static description = 'Delete a stored encoding template';
    static args = {
        id: Args.string({ description: 'Template ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
    };
    async run() {
        const { args } = await this.parse(EncodingTemplateDelete);
        await (await this.getApi()).encoding.templates.delete(args.id);
        this.log(`Template ${args.id} deleted.`);
    }
}
//# sourceMappingURL=delete.js.map