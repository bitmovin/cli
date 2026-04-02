import { Args } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class AnalyticsLicenseGet extends BaseCommand {
    static description = 'Get analytics license details';
    static args = {
        id: Args.string({ description: 'License ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
    };
    async run() {
        const { args } = await this.parse(AnalyticsLicenseGet);
        const result = await (await this.getApi()).analytics.licenses.get(args.id);
        await this.outputData(result);
    }
}
//# sourceMappingURL=get.js.map