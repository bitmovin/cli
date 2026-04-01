import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import {resolvePlayerLicense} from '../../../lib/resolve-license.js';

export default class PlayerDomainRemove extends BaseCommand {
  static override description = 'Remove a domain from a player license allowlist';

  static override args = {
    license: Args.string({description: 'Player license ID or license key', required: true}),
    domainId: Args.string({description: 'Domain ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args} = await this.parse(PlayerDomainRemove);
    const api = await this.getApi();
    const licenseId = await resolvePlayerLicense(api, args.license);
    await api.player.licenses.domains.delete(licenseId, args.domainId);
    this.log(`Domain ${args.domainId} removed.`);
  }
}
