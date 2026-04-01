import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import {resolveAnalyticsLicense} from '../../../lib/resolve-license.js';

export default class AnalyticsDomainRemove extends BaseCommand {
  static override description = 'Remove a domain from an analytics license allowlist';

  static override args = {
    license: Args.string({description: 'Analytics license ID or license key', required: true}),
    domainId: Args.string({description: 'Domain ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args} = await this.parse(AnalyticsDomainRemove);
    const api = await this.getApi();
    const licenseId = await resolveAnalyticsLicense(api, args.license);
    await api.analytics.licenses.domains.delete(licenseId, args.domainId);
    this.log(`Domain ${args.domainId} removed.`);
  }
}
