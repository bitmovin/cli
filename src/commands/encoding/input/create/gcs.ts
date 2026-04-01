import {Flags} from '@oclif/core';
import {GcsInput} from '@bitmovin/api-sdk';
import {BaseCommand} from '../../../../lib/base-command.js';

export default class EncodingInputCreateGcs extends BaseCommand {
  static override description = 'Create a GCS input';

  static override flags = {
    ...BaseCommand.baseFlags,
    name: Flags.string({description: 'Input name', required: true}),
    bucket: Flags.string({description: 'GCS bucket name', required: true}),
    'access-key': Flags.string({description: 'GCS HMAC access key', required: true}),
    'secret-key': Flags.string({description: 'GCS HMAC secret key', required: true}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingInputCreateGcs);
    const input = new GcsInput({
      name: flags.name,
      bucketName: flags.bucket,
      accessKey: flags['access-key'],
      secretKey: flags['secret-key'],
    });

    const result = await (await this.getApi()).encoding.inputs.gcs.create(input);
    this.log(`Input created: ${result.id}`);
    await this.outputData(result);
  }
}
