import { Args } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingJobStop extends BaseCommand {
    static description = 'Stop a running encoding';
    static args = {
        id: Args.string({ description: 'Encoding ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
    };
    async run() {
        const { args } = await this.parse(EncodingJobStop);
        await (await this.getApi()).encoding.encodings.stop(args.id);
        this.log(`Encoding ${args.id} stop requested.`);
    }
}
//# sourceMappingURL=stop.js.map