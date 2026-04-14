import {Args, Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import type {ApiClient} from '../../../lib/client.js';

const OUTPUT_TYPE_MAP: Record<string, (api: ApiClient, id: string) => Promise<unknown>> = {
  S3: (api, id) => api.encoding.outputs.s3.delete(id),
  GCS: (api, id) => api.encoding.outputs.gcs.delete(id),
  GCS_SERVICE_ACCOUNT: (api, id) => api.encoding.outputs.gcsServiceAccount.delete(id),
  AZURE: (api, id) => api.encoding.outputs.azure.delete(id),
  FTP: (api, id) => api.encoding.outputs.ftp.delete(id),
  SFTP: (api, id) => api.encoding.outputs.sftp.delete(id),
  AKAMAI_NETSTORAGE: (api, id) => api.encoding.outputs.akamaiNetstorage.delete(id),
  S3_ROLE_BASED: (api, id) => api.encoding.outputs.s3RoleBased.delete(id),
  GENERIC_S3: (api, id) => api.encoding.outputs.genericS3.delete(id),
  LOCAL: (api, id) => api.encoding.outputs.local.delete(id),
};

export default class EncodingOutputDelete extends BaseCommand {
  static override description = 'Delete an output';

  static override args = {
    id: Args.string({description: 'Output ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    type: Flags.string({description: 'Output type (auto-detected if omitted)', options: Object.keys(OUTPUT_TYPE_MAP).map(k => k.toLowerCase())}),
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(EncodingOutputDelete);
    const api = await this.getApi();

    let outputType = flags.type?.toUpperCase();
    if (!outputType) {
      const typeResponse = await api.encoding.outputs.type.get(args.id);
      outputType = typeResponse.type as string | undefined;
      if (!outputType) {
        this.error('Could not auto-detect output type. Specify --type explicitly.');
      }
    }

    const deleteFn = OUTPUT_TYPE_MAP[outputType];
    if (!deleteFn) {
      this.error(`Unsupported output type: ${outputType}. Supported: ${Object.keys(OUTPUT_TYPE_MAP).join(', ').toLowerCase()}`);
    }

    await deleteFn(api, args.id);
    this.log(`Output ${args.id} deleted.`);
  }
}
