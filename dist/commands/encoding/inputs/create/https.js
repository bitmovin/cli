import { Flags } from '@oclif/core';
import { HttpsInput } from '@bitmovin/api-sdk';
import { BaseCommand } from '../../../../lib/base-command.js';
export default class EncodingInputCreateHttps extends BaseCommand {
    static description = 'Create an HTTPS input';
    static flags = {
        ...BaseCommand.baseFlags,
        name: Flags.string({ description: 'Input name', required: true }),
        host: Flags.string({ description: 'Host (e.g. storage.example.com)', required: true }),
    };
    async run() {
        const { flags } = await this.parse(EncodingInputCreateHttps);
        const input = new HttpsInput({
            name: flags.name,
            host: flags.host,
        });
        const result = await (await this.getApi()).encoding.inputs.https.create(input);
        this.log(`Input created: ${result.id}`);
        await this.outputData(result);
    }
}
//# sourceMappingURL=https.js.map