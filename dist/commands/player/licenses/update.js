import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class PlayerLicenseUpdate extends BaseCommand {
    static description = 'Update a player license';
    static args = {
        id: Args.string({ description: 'License ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
        name: Flags.string({ description: 'New license name', required: true }),
    };
    async run() {
        const { args, flags } = await this.parse(PlayerLicenseUpdate);
        const result = await (await this.getApi()).player.licenses.update(args.id, { name: flags.name });
        this.log(`Player license ${args.id} updated.`);
        await this.outputData(result);
    }
}
//# sourceMappingURL=update.js.map