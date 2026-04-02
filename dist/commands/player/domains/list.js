import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
import { resolvePlayerLicense } from '../../../lib/resolve-license.js';
export default class PlayerDomainList extends BaseCommand {
    static description = 'List allowlisted domains for a player license';
    static args = {
        license: Args.string({ description: 'Player license ID or license key', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
        limit: Flags.integer({ description: 'Max results', default: 25 }),
        offset: Flags.integer({ description: 'Offset for pagination', default: 0 }),
    };
    async run() {
        const { args } = await this.parse(PlayerDomainList);
        const api = await this.getApi();
        const licenseId = await resolvePlayerLicense(api, args.license);
        const result = await api.player.licenses.domains.list(licenseId);
        let items = (result.items ?? []).map((d) => ({
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