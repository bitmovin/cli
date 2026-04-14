import {Flags} from '@oclif/core';
import {S3Output, AwsCloudRegion} from '@bitmovin/api-sdk';
import {BaseCommand} from '../../../../lib/base-command.js';

export default class EncodingOutputCreateS3 extends BaseCommand {
  static override description = 'Create an S3 output';

  static override flags = {
    ...BaseCommand.baseFlags,
    name: Flags.string({description: 'Output name', required: true}),
    bucket: Flags.string({description: 'S3 bucket name', required: true}),
    'access-key': Flags.string({description: 'AWS access key ID', required: true}),
    'secret-key': Flags.string({description: 'AWS secret access key', required: true}),
    region: Flags.string({description: 'AWS region'}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingOutputCreateS3);
    const output = new S3Output({
      name: flags.name,
      bucketName: flags.bucket,
      accessKey: flags['access-key'],
      secretKey: flags['secret-key'],
      ...(flags.region && {cloudRegion: flags.region as AwsCloudRegion}),
    });

    const result = await (await this.getApi()).encoding.outputs.s3.create(output);
    this.log(`Output created: ${result.id}`);
    await this.outputData(result);
  }
}
