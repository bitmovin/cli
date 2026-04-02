import { Flags } from '@oclif/core';
import { GcsOutput } from '@bitmovin/api-sdk';
import { BaseCommand } from '../../../../lib/base-command.js';
export default class EncodingOutputCreateGcs extends BaseCommand {
    static description = 'Create a GCS output';
    static flags = {
        ...BaseCommand.baseFlags,
        name: Flags.string({ description: 'Output name', required: true }),
        bucket: Flags.string({ description: 'GCS bucket name', required: true }),
        'access-key': Flags.string({ description: 'GCS HMAC access key', required: true }),
        'secret-key': Flags.string({ description: 'GCS HMAC secret key', required: true }),
    };
    async run() {
        const { flags } = await this.parse(EncodingOutputCreateGcs);
        const output = new GcsOutput({
            name: flags.name,
            bucketName: flags.bucket,
            accessKey: flags['access-key'],
            secretKey: flags['secret-key'],
        });
        const result = await (await this.getApi()).encoding.outputs.gcs.create(output);
        this.log(`Output created: ${result.id}`);
        await this.outputData(result);
    }
}
//# sourceMappingURL=gcs.js.map