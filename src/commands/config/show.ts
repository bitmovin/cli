import {BaseCommand} from '../../lib/base-command.js';
import {loadConfig, getConfigPath} from '../../lib/config.js';
import {maskSecret} from '../../lib/secrets.js';

type ApiKeySource = 'env' | 'config-file' | 'none';

interface ResolvedApiKey {
  value?: string;
  source: ApiKeySource;
}

function resolveApiKey(): ResolvedApiKey {
  const config = loadConfig();
  const fromEnv = process.env.BITMOVIN_API_KEY;
  if (fromEnv) return {value: fromEnv, source: 'env'};
  if (config.apiKey) return {value: config.apiKey, source: 'config-file'};
  return {source: 'none'};
}

function describeSource(source: ApiKeySource): string {
  switch (source) {
    case 'env': return 'BITMOVIN_API_KEY env var';
    case 'config-file': return 'config file';
    case 'none': return '(not set)';
  }
}

export default class ConfigShow extends BaseCommand {
  static override description = 'Show current configuration. Resolves the API key from BITMOVIN_API_KEY first, then the config file.';

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const config = loadConfig();
    const resolved = resolveApiKey();
    const maskedKey = resolved.value ? maskSecret(resolved.value) : undefined;

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
