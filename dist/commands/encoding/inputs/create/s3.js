import { Flags } from '@oclif/core';
import { S3Input } from '@bitmovin/api-sdk';
import { BaseCommand } from '../../../../lib/base-command.js';
export default class EncodingInputCreateS3 extends BaseCommand {
    static description = 'Create an S3 input';
    static flags = {
        ...BaseCommand.baseFlags,
        name: Flags.string({ description: 'Input name', required: true }),
        bucket: Flags.string({ description: 'S3 bucket name', required: true }),
        'access-key': Flags.string({ description: 'AWS access key ID', required: true }),
        'secret-key': Flags.string({ description: 'AWS secret access key', required: true }),
        region: Flags.string({ description: 'AWS region' }),
    };
    async run() {
        const { flags } = await this.parse(EncodingInputCreateS3);
        const input = new S3Input({
            name: flags.name,
            bucketName: flags.bucket,
            accessKey: flags['access-key'],
            secretKey: flags['secret-key'],
            ...(flags.region && { cloudRegion: flags.region }),
        });
        const result = await (await this.getApi()).encoding.inputs.s3.create(input);
        this.log(`Input created: ${result.id}`);
        await this.outputData(result);
    }
}
//# sourceMappingURL=s3.js.map