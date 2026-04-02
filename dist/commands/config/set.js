import { Args } from '@oclif/core';
import { BaseCommand } from '../../lib/base-command.js';
import { loadConfig, saveConfig } from '../../lib/config.js';
const VALID_KEYS = {
    'api-key': 'apiKey',
    'organization': 'tenantOrgId',
    'default-region': 'defaultRegion',
};
export default class ConfigSet extends BaseCommand {
    static description = 'Set a configuration value';
    static args = {
        key: Args.string({
            description: 'Config key to set',
            required: true,
            options: Object.keys(VALID_KEYS),
        }),
        value: Args.string({ description: 'Value to set', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
    };
    static examples = [
        'bitmovin config set api-key 41514766-1f1a-480b-aafd-9c89a98932e8',
        'bitmovin config set organization 5a1b2c3d-...',
        'bitmovin config set default-region GOOGLE_EUROPE_WEST_1',
    ];
    async run() {
        const { args } = await this.parse(ConfigSet);
        const configKey = VALID_KEYS[args.key];
        if (!configKey) {
            this.error(`Unknown key: ${args.key}. Valid keys: ${Object.keys(VALID_KEYS).join(', ')}`);
        }
        const config = loadConfig();
        config[configKey] = args.value;
        saveConfig(config);
        this.log(`Set ${args.key} = ${args.key === 'api-key' ? args.value.slice(0, 8) + '...' : args.value}`);
    }
}
//# sourceMappingURL=set.js.map