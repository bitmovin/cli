import { Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingOutputList extends BaseCommand {
    static description = 'List encoding outputs';
    static flags = {
        ...BaseCommand.baseFlags,
        type: Flags.string({ description: 'Filter by type (s3, gcs, azure)' }),
        limit: Flags.integer({ description: 'Max results', default: 25 }),
        offset: Flags.integer({ description: 'Offset for pagination', default: 0 }),
    };
    async run() {
        const { flags } = await this.parse(EncodingOutputList);
        const listFn = (q) => {
            q.limit(flags.limit);
            q.offset(flags.offset);
            return q;
        };
        let items;
        const type = flags.type?.toLowerCase();
        if (type === 's3') {
            items = (await (await this.getApi()).encoding.outputs.s3.list(listFn)).items ?? [];
        }
        else if (type === 'gcs') {
            items = (await (await this.getApi()).encoding.outputs.gcs.list(listFn)).items ?? [];
        }
        else if (type === 'azure') {
            items = (await (await this.getApi()).encoding.outputs.azure.list(listFn)).items ?? [];
        }
        else {
            items = (await (await this.getApi()).encoding.outputs.list(listFn)).items ?? [];
        }
        await this.outputList(items, ['id', 'name', 'type', 'createdAt']);
    }
}
//# sourceMappingURL=list.js.map