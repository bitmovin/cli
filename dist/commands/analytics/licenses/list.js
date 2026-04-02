import { Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class AnalyticsLicenseList extends BaseCommand {
    static description = 'List analytics licenses';
    static flags = {
        ...BaseCommand.baseFlags,
        limit: Flags.integer({ description: 'Max results', default: 25 }),
        offset: Flags.integer({ description: 'Offset for pagination', default: 0 }),
    };
    async run() {
        const { flags } = await this.parse(AnalyticsLicenseList);
        const result = await (await this.getApi()).analytics.licenses.list((q) => {
            q.limit(flags.limit);
            q.offset(flags.offset);
            return q;
        });
        const items = (result.items ?? []).map((l) => ({
            id: l.id,
            name: l.name,
            licenseKey: l.licenseKey,
            impressions: l.impressions,
            maxImpressions: l.maxImpressions,
            timeZone: l.timeZone,
            createdAt: l.createdAt,
        }));
        await this.outputList(items, ['id', 'name', 'licenseKey', 'impressions', 'maxImpressions', 'timeZone']);
    }
}
//# sourceMappingURL=list.js.map