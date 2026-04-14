import {Args, Flags} from '@oclif/core';
import {PlayerLicenseAnalytics} from '@bitmovin/api-sdk';
import {BaseCommand} from '../../../lib/base-command.js';

export default class PlayerAnalyticsActivate extends BaseCommand {
  static override description = 'Activate analytics on a player license';

  static override args = {
    licenseId: Args.string({description: 'Player license ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    'analytics-key': Flags.string({description: 'Analytics license key', required: true}),
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(PlayerAnalyticsActivate);
    await (await this.getApi()).player.licenses.analytics.create(args.licenseId, new PlayerLicenseAnalytics({analyticsKey: flags['analytics-key']}));
    this.log(`Analytics activated on player license ${args.licenseId}.`);
  }
}
