import { Flags } from '@oclif/core';
import { PlayerLicense } from '@bitmovin/api-sdk';
import { BaseCommand } from '../../../lib/base-command.js';
export default class PlayerLicenseCreate extends BaseCommand {
    static description = 'Create a player license';
    static flags = {
        ...BaseCommand.baseFlags,
        name: Flags.string({ description: 'License name', required: true }),
    };
    async run() {
        const { flags } = await this.parse(PlayerLicenseCreate);
        const license = new PlayerLicense({ name: flags.name });
        const result = await (await this.getApi()).player.licenses.create(license);
        this.log(`Player license created: ${result.id}`);
        await this.outputData(result);
    }
}
//# sourceMappingURL=create.js.map