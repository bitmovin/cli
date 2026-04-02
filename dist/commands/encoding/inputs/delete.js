import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
const INPUT_TYPE_MAP = {
    S3: (api, id) => api.encoding.inputs.s3.delete(id),
    GCS: (api, id) => api.encoding.inputs.gcs.delete(id),
    GCS_SERVICE_ACCOUNT: (api, id) => api.encoding.inputs.gcsServiceAccount.delete(id),
    AZURE: (api, id) => api.encoding.inputs.azure.delete(id),
    FTP: (api, id) => api.encoding.inputs.ftp.delete(id),
    SFTP: (api, id) => api.encoding.inputs.sftp.delete(id),
    HTTP: (api, id) => api.encoding.inputs.http.delete(id),
    HTTPS: (api, id) => api.encoding.inputs.https.delete(id),
    ASPERA: (api, id) => api.encoding.inputs.aspera.delete(id),
    AKAMAI_NETSTORAGE: (api, id) => api.encoding.inputs.akamaiNetstorage.delete(id),
    S3_ROLE_BASED: (api, id) => api.encoding.inputs.s3RoleBased.delete(id),
    GENERIC_S3: (api, id) => api.encoding.inputs.genericS3.delete(id),
    LOCAL: (api, id) => api.encoding.inputs.local.delete(id),
};
export default class EncodingInputDelete extends BaseCommand {
    static description = 'Delete an input';
    static args = {
        id: Args.string({ description: 'Input ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
        type: Flags.string({ description: 'Input type (auto-detected if omitted)', options: Object.keys(INPUT_TYPE_MAP).map(k => k.toLowerCase()) }),
    };
    async run() {
        const { args, flags } = await this.parse(EncodingInputDelete);
        const api = await this.getApi();
        let inputType = flags.type?.toUpperCase();
        if (!inputType) {
            const typeResponse = await api.encoding.inputs.type.get(args.id);
            inputType = typeResponse.type;
            if (!inputType) {
                this.error('Could not auto-detect input type. Specify --type explicitly.');
            }
        }
        const deleteFn = INPUT_TYPE_MAP[inputType];
        if (!deleteFn) {
            this.error(`Unsupported input type: ${inputType}. Supported: ${Object.keys(INPUT_TYPE_MAP).join(', ').toLowerCase()}`);
        }
        await deleteFn(api, args.id);
        this.log(`Input ${args.id} deleted.`);
    }
}
//# sourceMappingURL=delete.js.map