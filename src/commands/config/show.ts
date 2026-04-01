import {Command} from '@oclif/core';
import {loadConfig, getConfigPath} from '../../lib/config.js';

export default class ConfigShow extends Command {
  static override description = 'Show current configuration';

  async run(): Promise<void> {
    const config = loadConfig();
    this.log(`Config file: ${getConfigPath()}\n`);

    if (config.apiKey) {
      const masked = config.apiKey.slice(0, 8) + '...' + config.apiKey.slice(-4);
      this.log(`API Key:        ${masked}`);
    } else {
      this.log('API Key:        (not set)');
    }

    this.log(`Tenant Org ID:  ${config.tenantOrgId ?? '(not set)'}`);
    this.log(`Default Region: ${config.defaultRegion ?? '(not set)'}`);
  }
}
