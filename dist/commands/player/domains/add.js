import { Args, Flags } from '@oclif/core';
import { Domain } from '@bitmovin/api-sdk';
import { BaseCommand } from '../../../lib/base-command.js';
import { resolvePlayerLicense } from '../../../lib/resolve-license.js';
export default class PlayerDomainAdd extends BaseCommand {
    static description = 'Add a domain to a player license allowlist';
    static args = {
        license: Args.string({ description: 'Player license ID or license key', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
        url: Flags.string({ description: 'Domain URL (e.g. https://example.com)', required: true }),
    };
    async run() {
        const { args, flags } = await this.parse(PlayerDomainAdd);
        const api = await this.getApi();
        const licenseId = await resolvePlayerLicense(api, args.license);
        const domain = new Domain({ url: flags.url });
        const result = await api.player.licenses.domains.create(licenseId, domain);
        this.log(`Domain added: ${result.id}`);
        await this.outputData(result);
    }
}
//# sourceMappingURL=add.js.map