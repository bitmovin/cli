import { Args } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingOutputGet extends BaseCommand {
    static description = 'Get output details';
    static args = {
        id: Args.string({ description: 'Output ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
    };
    async run() {
        const { args } = await this.parse(EncodingOutputGet);
        const result = await (await this.getApi()).encoding.outputs.get(args.id);
        await this.outputData(result);
    }
}
//# sourceMappingURL=get.js.map