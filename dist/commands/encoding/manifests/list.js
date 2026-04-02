import { Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingManifestList extends BaseCommand {
    static description = 'List manifests';
    static flags = {
        ...BaseCommand.baseFlags,
        type: Flags.string({ description: 'Filter by manifest type', options: ['dash', 'hls', 'smooth'] }),
        limit: Flags.integer({ description: 'Max results', default: 25 }),
        offset: Flags.integer({ description: 'Offset for pagination', default: 0 }),
    };
    async run() {
        const { flags } = await this.parse(EncodingManifestList);
        const listFn = (q) => {
            q.limit(flags.limit);
            q.offset(flags.offset);
            return q;
        };
        let items;
        if (flags.type === 'dash') {
            items = (await (await this.getApi()).encoding.manifests.dash.list(listFn)).items ?? [];
        }
        else if (flags.type === 'hls') {
            items = (await (await this.getApi()).encoding.manifests.hls.list(listFn)).items ?? [];
        }
        else if (flags.type === 'smooth') {
            items = (await (await this.getApi()).encoding.manifests.smooth.list(listFn)).items ?? [];
        }
        else {
            items = (await (await this.getApi()).encoding.manifests.list(listFn)).items ?? [];
        }
        await this.outputList(items, ['id', 'name', 'type', 'status', 'createdAt']);
    }
}
//# sourceMappingURL=list.js.map