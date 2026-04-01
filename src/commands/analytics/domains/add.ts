import {Args, Flags} from '@oclif/core';
import {AnalyticsLicenseDomain} from '@bitmovin/api-sdk';
import {BaseCommand} from '../../../lib/base-command.js';
import {resolveAnalyticsLicense} from '../../../lib/resolve-license.js';

export default class AnalyticsDomainAdd extends BaseCommand {
  static override description = 'Add a domain to an analytics license allowlist';

  static override args = {
    license: Args.string({description: 'Analytics license ID or license key', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    url: Flags.string({description: 'Domain URL (e.g. https://example.com)', required: true}),
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(AnalyticsDomainAdd);
    const api = await this.getApi();
    const licenseId = await resolveAnalyticsLicense(api, args.license);
    const domain = new AnalyticsLicenseDomain({url: flags.url});
    const result = await api.analytics.licenses.domains.create(licenseId, domain);
    this.log(`Domain added: ${(result as any).id}`);
    await this.outputData(result);
  }
}
