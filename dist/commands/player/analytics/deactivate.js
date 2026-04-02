import { Args } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class PlayerAnalyticsDeactivate extends BaseCommand {
    static description = 'Deactivate analytics on a player license';
    static args = {
        licenseId: Args.string({ description: 'Player license ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
    };
    async run() {
        const { args } = await this.parse(PlayerAnalyticsDeactivate);
        await (await this.getApi()).player.licenses.analytics.delete(args.licenseId);
        this.log(`Analytics deactivated on player license ${args.licenseId}.`);
    }
}
//# sourceMappingURL=deactivate.js.map