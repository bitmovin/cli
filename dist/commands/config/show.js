import { BaseCommand } from '../../lib/base-command.js';
import { loadConfig, getConfigPath } from '../../lib/config.js';
export default class ConfigShow extends BaseCommand {
    static description = 'Show current configuration';
    static flags = {
        ...BaseCommand.baseFlags,
    };
    async run() {
        const config = loadConfig();
        if (await this.isJsonMode()) {
            const masked = config.apiKey
                ? config.apiKey.slice(0, 8) + '...' + config.apiKey.slice(-4)
                : undefined;
            await this.outputData({
                configFile: getConfigPath(),
                apiKey: masked ?? '(not set)',
                tenantOrgId: config.tenantOrgId ?? '(not set)',
                defaultRegion: config.defaultRegion ?? '(not set)',
            });
            return;
        }
        this.log(`Config file: ${getConfigPath()}\n`);
        if (config.apiKey) {
            const masked = config.apiKey.slice(0, 8) + '...' + config.apiKey.slice(-4);
            this.log(`API Key:        ${masked}`);
        }
        else {
            this.log('API Key:        (not set)');
        }
        this.log(`Tenant Org ID:  ${config.tenantOrgId ?? '(not set)'}`);
        this.log(`Default Region: ${config.defaultRegion ?? '(not set)'}`);
    }
}
//# sourceMappingURL=show.js.map