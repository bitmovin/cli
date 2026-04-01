import {Args, Flags} from '@oclif/core';
import {AnalyticsLicense} from '@bitmovin/api-sdk';
import {BaseCommand} from '../../../lib/base-command.js';

export default class AnalyticsLicenseUpdate extends BaseCommand {
  static override description = 'Update an analytics license';

  static override args = {
    id: Args.string({description: 'License ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    name: Flags.string({description: 'New license name'}),
    'ignore-dnt': Flags.boolean({description: 'Ignore Do Not Track requests', allowNo: true}),
    timezone: Flags.string({description: 'Timezone'}),
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(AnalyticsLicenseUpdate);
    const update = new AnalyticsLicense({
      ...(flags.name && {name: flags.name}),
      ...(flags['ignore-dnt'] !== undefined && {ignoreDNT: flags['ignore-dnt']}),
      ...(flags.timezone && {timeZone: flags.timezone}),
    });

    const result = await (await this.getApi()).analytics.licenses.update(args.id, update);
    this.log(`Analytics license ${args.id} updated.`);
    await this.outputData(result);
  }
}
