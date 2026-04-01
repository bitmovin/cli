import {Args, Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import {resolveAnalyticsLicense} from '../../../lib/resolve-license.js';

export default class AnalyticsDomainList extends BaseCommand {
  static override description = 'List allowlisted domains for an analytics license';

  static override args = {
    license: Args.string({description: 'Analytics license ID or license key', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    limit: Flags.integer({description: 'Max results', default: 25}),
    offset: Flags.integer({description: 'Offset for pagination', default: 0}),
  };

  async run(): Promise<void> {
    const {args} = await this.parse(AnalyticsDomainList);
    const api = await this.getApi();
    const licenseId = await resolveAnalyticsLicense(api, args.license);
    const result = await api.analytics.licenses.domains.get(licenseId);
    let items = ((result as any).domains ?? []).map((d: any) => ({
      id: d.id,
      url: d.url,
    }));

    const parsedFlags = await this.parseFlags();
    const offset = parsedFlags.offset as number;
    const limit = parsedFlags.limit as number;
    items = items.slice(offset, offset + limit);

    await this.outputList(items, ['id', 'url']);
  }
}
