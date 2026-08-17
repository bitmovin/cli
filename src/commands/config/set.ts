import {Args} from '@oclif/core';
import {BaseCommand} from '../../lib/base-command.js';
import {getConfigPath, loadConfig, saveConfig} from '../../lib/config.js';

const VALID_KEYS: Record<string, string> = {
  'api-key': 'apiKey',
  'organization': 'tenantOrgId',
  'default-region': 'defaultRegion',
};

export default class ConfigSet extends BaseCommand {
  static override description = 'Set a configuration value';

  static override args = {
    key: Args.string({
      description: 'Config key to set',
      required: true,
      options: Object.keys(VALID_KEYS),
    }),
    value: Args.string({description: 'Value to set', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  static override examples = [
    'bitmovin config set api-key 41514766-1f1a-480b-aafd-9c89a98932e8',
    'bitmovin config set organization 5a1b2c3d-...',
    'bitmovin config set default-region GOOGLE_EUROPE_WEST_1',
  ];

  async run(): Promise<void> {
    const {args} = await this.parse(ConfigSet);
    const configKey = VALID_KEYS[args.key];
    if (!configKey) {
      this.error(`Unknown key: ${args.key}. Valid keys: ${Object.keys(VALID_KEYS).join(', ')}`);
    }

    // An empty value would be stored and then mean "no organization" at request time,
    // so the config would silently not say what it appears to say. Rejected here
    // instead; `bitmovin config set organization <id>` is the only useful form.
    if (args.value.trim() === '') {
      this.error(`${args.key} cannot be set to an empty value. Pass a value, or edit ${getConfigPath()} to remove the key.`, {exit: 2});
    }

    const config = loadConfig();
    (config as Record<string, string>)[configKey] = args.value;
    saveConfig(config);
    this.log(`Set ${args.key} = ${args.key === 'api-key' ? args.value.slice(0, 8) + '...' : args.value}`);
  }
}
