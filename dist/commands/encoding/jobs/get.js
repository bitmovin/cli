import { Args } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingJobGet extends BaseCommand {
    static description = 'Get encoding details';
    static args = {
        id: Args.string({ description: 'Encoding ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
    };
    async run() {
        const { args } = await this.parse(EncodingJobGet);
        const result = await (await this.getApi()).encoding.encodings.get(args.id);
        await this.outputData(result);
    }
}
//# sourceMappingURL=get.js.map