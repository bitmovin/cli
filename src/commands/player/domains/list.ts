import {Args, Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import {resolvePlayerLicense} from '../../../lib/resolve-license.js';

export default class PlayerDomainList extends BaseCommand {
  static override description = 'List allowlisted domains for a player license';

  static override args = {
    license: Args.string({description: 'Player license ID or license key', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    limit: Flags.integer({description: 'Max results', default: 25}),
    offset: Flags.integer({description: 'Offset for pagination', default: 0}),
  };

  async run(): Promise<void> {
    const {args} = await this.parse(PlayerDomainList);
    const api = await this.getApi();
    const licenseId = await resolvePlayerLicense(api, args.license);
    const result = await api.player.licenses.domains.list(licenseId);
    let items = (result.items ?? []).map((d: any) => ({
      id: d.id,
      url: d.url,
    }));

    const parsedFlags = await this.parseFlags();
    const offset = parsedFlags.offset as number;
    const limit = parsedFlags.limit as number;
    items = items.slice(offset, offset + limit);

    await this.outputList(items as Record<string, unknown>[], ['id', 'url']);
  }
}
