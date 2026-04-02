import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
import { waitForEncoding } from '../../../lib/wait.js';
export default class EncodingJobStart extends BaseCommand {
    static description = 'Start an existing encoding';
    static args = {
        id: Args.string({ description: 'Encoding ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
        watch: Flags.boolean({ char: 'w', description: 'Wait for encoding to finish' }),
    };
    async run() {
        const { args, flags } = await this.parse(EncodingJobStart);
        await (await this.getApi()).encoding.encodings.start(args.id);
        this.log(`Encoding ${args.id} started.`);
        if (flags.watch) {
            const task = await waitForEncoding(await this.getApi(), args.id);
            await this.outputData(task);
        }
    }
}
//# sourceMappingURL=start.js.map