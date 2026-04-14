import {Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class PlayerLicenseList extends BaseCommand {
  static override description = 'List player licenses';

  static override flags = {
    ...BaseCommand.baseFlags,
    limit: Flags.integer({description: 'Max results', default: 25}),
    offset: Flags.integer({description: 'Offset for pagination', default: 0}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(PlayerLicenseList);
    const result = await (await this.getApi()).player.licenses.list({
      limit: flags.limit,
      offset: flags.offset,
    });

    const items = (result.items ?? []).map((l) => ({
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
