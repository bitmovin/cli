import {Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class PlayerLicenseList extends BaseCommand {
  static override description = 'List player licenses';

  static override flags = {
    ...BaseCommand.baseFlags,
    limit: Flags.integer({description: 'Max results', default: 25}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(PlayerLicenseList);
    const result = await (await this.getApi()).player.licenses.list((q: any) => {
      q.limit(flags.limit);
      return q;
    });

    const items = (result.items ?? []).map((l: any) => ({
      id: l.id,
      name: l.name,
      licenseKey: l.licenseKey,
      impressions: l.impressions,
      maxImpressions: l.maxImpressions,
      createdAt: l.createdAt,
    }));

    await this.outputList(items as Record<string, unknown>[], ['id', 'name', 'licenseKey', 'impressions', 'maxImpressions']);
  }
}
