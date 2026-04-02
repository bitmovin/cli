import { BaseCommand } from '../../lib/base-command.js';
export default class AccountInfo extends BaseCommand {
    static description = 'Show account information';
    static flags = {
        ...BaseCommand.baseFlags,
    };
    async run() {
        const info = await (await this.getApi()).account.information.get();
        await this.outputData(info);
    }
}
//# sourceMappingURL=info.js.map