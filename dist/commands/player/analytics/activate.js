import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class PlayerAnalyticsActivate extends BaseCommand {
    static description = 'Activate analytics on a player license';
    static args = {
        licenseId: Args.string({ description: 'Player license ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
        'analytics-key': Flags.string({ description: 'Analytics license key', required: true }),
    };
    async run() {
        const { args, flags } = await this.parse(PlayerAnalyticsActivate);
        await (await this.getApi()).player.licenses.analytics.create(args.licenseId, { analyticsKey: flags['analytics-key'] });
        this.log(`Analytics activated on player license ${args.licenseId}.`);
    }
}
//# sourceMappingURL=activate.js.map