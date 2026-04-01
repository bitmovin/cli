import {Flags} from '@oclif/core';
import {BaseCommand} from '../../lib/base-command.js';

export default class EncodingStats extends BaseCommand {
  static override description = 'Show encoding statistics';

  static override flags = {
    ...BaseCommand.baseFlags,
    from: Flags.string({description: 'Start date (YYYY-MM-DD)'}),
    to: Flags.string({description: 'End date (YYYY-MM-DD)'}),
    limit: Flags.integer({description: 'Max results', default: 25}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingStats);

    if (flags.from && flags.to) {
      const result = await (await this.getApi()).encoding.statistics.daily.listByDateRange(
        new Date(flags.from),
        new Date(flags.to),
      );
      await this.outputData(result);
    } else {
      const result = await (await this.getApi()).encoding.statistics.get();
      await this.outputData(result);
    }
  }
}
