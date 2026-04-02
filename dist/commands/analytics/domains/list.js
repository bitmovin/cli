import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
import { resolveAnalyticsLicense } from '../../../lib/resolve-license.js';
export default class AnalyticsDomainList extends BaseCommand {
    static description = 'List allowlisted domains for an analytics license';
    static args = {
        license: Args.string({ description: 'Analytics license ID or license key', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
        limit: Flags.integer({ description: 'Max results', default: 25 }),
        offset: Flags.integer({ description: 'Offset for pagination', default: 0 }),
    };
    async run() {
        const { args } = await this.parse(AnalyticsDomainList);
        const api = await this.getApi();
        const licenseId = await resolveAnalyticsLicense(api, args.license);
        const result = await api.analytics.licenses.domains.get(licenseId);
        let items = (result.domains ?? []).map((d) => ({
            id: d.id,
            url: d.url,
        }));
        const parsedFlags = await this.parseFlags();
        const offset = parsedFlags.offset;
        const limit = parsedFlags.limit;
        items = items.slice(offset, offset + limit);
        await this.outputList(items, ['id', 'url']);
    }
}
//# sourceMappingURL=list.js.map