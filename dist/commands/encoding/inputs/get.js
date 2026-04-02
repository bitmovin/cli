import { Args } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingInputGet extends BaseCommand {
    static description = 'Get input details';
    static args = {
        id: Args.string({ description: 'Input ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
    };
    async run() {
        const { args } = await this.parse(EncodingInputGet);
        const result = await (await this.getApi()).encoding.inputs.get(args.id);
        await this.outputData(result);
    }
}
//# sourceMappingURL=get.js.map