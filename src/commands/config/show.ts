import {BaseCommand} from '../../lib/base-command.js';
import {loadConfig, getConfigPath} from '../../lib/config.js';
import {resolveApiKey, type ApiKeySource} from '../../lib/client.js';
import {maskSecret} from '../../lib/secrets.js';

function describeSource(source: Exclude<ApiKeySource, 'none'>): string {
  switch (source) {
    case 'flag': return '--api-key flag';
    case 'env': return 'BITMOVIN_API_KEY env var';
    case 'config-file': return 'config file';
  }
}

export default class ConfigShow extends BaseCommand {
  static override description = 'Show current configuration. Resolves the API key from BITMOVIN_API_KEY first, then the config file.';

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const config = loadConfig();
    const resolved = resolveApiKey(config);
    const maskedKey = resolved.value !== undefined ? maskSecret(resolved.value) : undefined;

    if (await this.isJsonMode()) {
      await this.outputData({
        configFile: getConfigPath(),
        apiKey: maskedKey ?? null,
        apiKeySource: resolved.source,
        tenantOrgId: config.tenantOrgId ?? null,
        defaultRegion: config.defaultRegion ?? null,
      });
      return;
    }

    this.log(`Config file: ${getConfigPath()}\n`);

    if (resolved.source === 'none') {
      this.log('API Key:        (not set)');
    } else {
      this.log(`API Key:        ${maskedKey} (${describeSource(resolved.source)})`);
    }

    this.log(`Tenant Org ID:  ${config.tenantOrgId ?? '(not set)'}`);
    this.log(`Default Region: ${config.defaultRegion ?? '(not set)'}`);
  }
}
