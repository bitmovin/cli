import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import {resolveAnalyticsLicense} from '../../../lib/resolve-license.js';

export default class AnalyticsDomainList extends BaseCommand {
  static override description = 'List allowlisted domains for an analytics license';

  static override args = {
    license: Args.string({description: 'Analytics license ID or license key', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(AnalyticsDomainList);
    const api = await this.getApi();
    const licenseId = await resolveAnalyticsLicense(api, args.license);
    const result = await api.analytics.licenses.domains.get(licenseId);
    const items = ((result as any).domains ?? []).map((d: any) => ({
      id: d.id,
      url: d.url,
    }));

    await this.outputList(items, ['id', 'url']);
  }
}
