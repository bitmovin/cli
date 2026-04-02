import { Flags } from '@oclif/core';
import { AnalyticsLicense } from '@bitmovin/api-sdk';
import { BaseCommand } from '../../../lib/base-command.js';
export default class AnalyticsLicenseCreate extends BaseCommand {
    static description = 'Create an analytics license';
    static flags = {
        ...BaseCommand.baseFlags,
        name: Flags.string({ description: 'License name', required: true }),
        timezone: Flags.string({ description: 'Timezone (e.g. Europe/Vienna)' }),
    };
    async run() {
        const { flags } = await this.parse(AnalyticsLicenseCreate);
        const license = new AnalyticsLicense({
            name: flags.name,
            ...(flags.timezone && { timeZone: flags.timezone }),
        });
        const result = await (await this.getApi()).analytics.licenses.create(license);
        this.log(`Analytics license created: ${result.id}`);
        await this.outputData(result);
    }
}
//# sourceMappingURL=create.js.map