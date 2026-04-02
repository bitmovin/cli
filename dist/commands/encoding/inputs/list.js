import { Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingInputList extends BaseCommand {
    static description = 'List encoding inputs';
    static flags = {
        ...BaseCommand.baseFlags,
        type: Flags.string({ description: 'Filter by type (s3, gcs, http, https, azure)' }),
        limit: Flags.integer({ description: 'Max results', default: 25 }),
        offset: Flags.integer({ description: 'Offset for pagination', default: 0 }),
    };
    async run() {
        const { flags } = await this.parse(EncodingInputList);
        const listFn = (q) => {
            q.limit(flags.limit);
            q.offset(flags.offset);
            return q;
        };
        let items;
        const type = flags.type?.toLowerCase();
        if (type === 's3') {
            items = (await (await this.getApi()).encoding.inputs.s3.list(listFn)).items ?? [];
        }
        else if (type === 'gcs') {
            items = (await (await this.getApi()).encoding.inputs.gcs.list(listFn)).items ?? [];
        }
        else if (type === 'http') {
            items = (await (await this.getApi()).encoding.inputs.http.list(listFn)).items ?? [];
        }
        else if (type === 'https') {
            items = (await (await this.getApi()).encoding.inputs.https.list(listFn)).items ?? [];
        }
        else if (type === 'azure') {
            items = (await (await this.getApi()).encoding.inputs.azure.list(listFn)).items ?? [];
        }
        else {
            items = (await (await this.getApi()).encoding.inputs.list(listFn)).items ?? [];
        }
        await this.outputList(items, ['id', 'name', 'type', 'createdAt']);
    }
}
//# sourceMappingURL=list.js.map