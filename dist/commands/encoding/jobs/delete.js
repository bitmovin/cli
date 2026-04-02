import { Args } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingJobDelete extends BaseCommand {
    static description = 'Delete an encoding';
    static args = {
        id: Args.string({ description: 'Encoding ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
    };
    async run() {
        const { args } = await this.parse(EncodingJobDelete);
        await (await this.getApi()).encoding.encodings.delete(args.id);
        this.log(`Encoding ${args.id} deleted.`);
    }
}
//# sourceMappingURL=delete.js.map