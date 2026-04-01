import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class PlayerAnalyticsDeactivate extends BaseCommand {
  static override description = 'Deactivate analytics on a player license';

  static override args = {
    licenseId: Args.string({description: 'Player license ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args} = await this.parse(PlayerAnalyticsDeactivate);
    await (await this.getApi()).player.licenses.analytics.delete(args.licenseId);
    this.log(`Analytics deactivated on player license ${args.licenseId}.`);
  }
}
