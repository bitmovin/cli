import {Flags} from '@oclif/core';
import {readFileSync} from 'node:fs';
import {GcsServiceAccountOutput} from '@bitmovin/api-sdk';
import {BaseCommand} from '../../../../lib/base-command.js';

export default class EncodingOutputCreateGcsServiceAccount extends BaseCommand {
  static override description =
    'Create a service-account-based GCS output. Reads the JSON key file directly so credentials never appear in shell history.';

  static override flags = {
    ...BaseCommand.baseFlags,
    name: Flags.string({description: 'Output name', required: true}),
    bucket: Flags.string({description: 'GCS bucket name', required: true}),
    'service-account-key-file': Flags.string({
      description: 'Path to the service account JSON key file',
      required: true,
    }),
    'cloud-region': Flags.string({
      description: 'GCS region the bucket is located in (e.g. EUROPE_WEST_1)',
    }),
  };

  static override examples = [
    'bitmovin encoding outputs create gcs-service-account --name my-output --bucket my-bucket --service-account-key-file ./sa-key.json',
    'bitmovin encoding outputs create gcs-service-account --name my-output --bucket my-bucket --service-account-key-file ./sa-key.json --cloud-region EUROPE_WEST_1',
  ];

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingOutputCreateGcsServiceAccount);

    let credentials: string;
    try {
      credentials = readFileSync(flags['service-account-key-file'], 'utf-8');
    } catch (e) {
      this.error(`Could not read service account key file: ${(e as Error).message}`);
    }

    // The JSON file should at least be parsable JSON; surface a clear error
    // here rather than letting the API reject it later.
    try {
      JSON.parse(credentials);
    } catch {
      this.error(
        `Service account key file ${flags['service-account-key-file']} is not valid JSON.`,
      );
    }

    const output = new GcsServiceAccountOutput({
      name: flags.name,
      bucketName: flags.bucket,
      serviceAccountCredentials: credentials,
      ...(flags['cloud-region'] && {cloudRegion: flags['cloud-region'] as never}),
    });

    const result = await (
      await this.getApi()
    ).encoding.outputs.gcsServiceAccount.create(output);
    this.log(`Output created: ${result.id}`);
    await this.outputData(result);
  }
}
