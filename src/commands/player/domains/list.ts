import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import {resolvePlayerLicense} from '../../../lib/resolve-license.js';

export default class PlayerDomainList extends BaseCommand {
  static override description = 'List allowlisted domains for a player license';

  static override args = {
    license: Args.string({description: 'Player license ID or license key', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(PlayerDomainList);
    const api = await this.getApi();
    const licenseId = await resolvePlayerLicense(api, args.license);
    const result = await api.player.licenses.domains.list(licenseId);
    const items = (result.items ?? []).map((d: any) => ({
      id: d.id,
      url: d.url,
    }));

    await this.outputList(items as Record<string, unknown>[], ['id', 'url']);
  }
}
