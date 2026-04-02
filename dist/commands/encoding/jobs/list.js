import { Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingJobList extends BaseCommand {
    static description = 'List encodings';
    static flags = {
        ...BaseCommand.baseFlags,
        limit: Flags.integer({ description: 'Max results', default: 25 }),
        offset: Flags.integer({ description: 'Offset for pagination', default: 0 }),
        status: Flags.string({ description: 'Filter by status (CREATED, QUEUED, RUNNING, FINISHED, ERROR)' }),
    };
    async run() {
        const { flags } = await this.parse(EncodingJobList);
        const result = await (await this.getApi()).encoding.encodings.list((q) => {
            q.limit(flags.limit);
            q.offset(flags.offset);
            if (flags.status)
                q.status(flags.status);
            return q;
        });
        const items = (result.items ?? []).map((e) => ({
            id: e.id,
            name: e.name,
            cloudRegion: e.cloudRegion,
            status: String(e.status ?? ''),
            createdAt: e.createdAt,
        }));
        await this.outputList(items, ['id', 'name', 'cloudRegion', 'status', 'createdAt']);
    }
}
//# sourceMappingURL=list.js.map