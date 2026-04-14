import {Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class AnalyticsLicenseList extends BaseCommand {
  static override description = 'List analytics licenses';

  static override flags = {
    ...BaseCommand.baseFlags,
    limit: Flags.integer({description: 'Max results', default: 25}),
    offset: Flags.integer({description: 'Offset for pagination', default: 0}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(AnalyticsLicenseList);
    const result = await (await this.getApi()).analytics.licenses.list({
      limit: flags.limit,
      offset: flags.offset,
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

    await this.outputList(items as Record<string, unknown>[], ['id', 'name', 'licenseKey', 'impressions', 'maxImpressions', 'timeZone']);
  }
}
