import type {CliConfig} from './config.js';

export type ApiKeySource = 'flag' | 'env' | 'config-file' | 'none';

export interface ResolvedApiKey {
  value?: string;
  source: ApiKeySource;
}

export function resolveApiKey(config: CliConfig, apiKeyOverride?: string): ResolvedApiKey {
  if (apiKeyOverride !== undefined) return {value: apiKeyOverride, source: 'flag'};

  const fromEnv = process.env.BITMOVIN_API_KEY;
  if (fromEnv !== undefined) return {value: fromEnv, source: 'env'};

  if (config.apiKey != null) return {value: config.apiKey, source: 'config-file'};

  return {source: 'none'};
}
