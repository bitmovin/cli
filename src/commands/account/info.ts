import {BaseCommand} from '../../lib/base-command.js';

export default class AccountInfo extends BaseCommand {
  static override description = 'Show account information';

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const info = await (await this.getApi()).account.information.get();
    await this.outputData(info);
  }
}
