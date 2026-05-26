import type {CliConfig, OAuthSession} from './config.js';

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

export type AuthSource = ApiKeySource | 'oauth';

export type ResolvedAuth =
  | {kind: 'api-key'; value: string; source: ApiKeySource}
  | {kind: 'oauth'; session: OAuthSession; source: 'oauth'}
  | {kind: 'none'; source: 'none'};

/**
 * Resolves which credential the SDK should use. --api-key flag and
 * BITMOVIN_API_KEY env still win over a stored OAuth session, so an
 * automation script can override an interactive login.
 */
export function resolveAuth(config: CliConfig, apiKeyOverride?: string): ResolvedAuth {
  // --api-key flag and BITMOVIN_API_KEY env take precedence over OAuth even
  // when explicitly empty. An empty value short-circuits to 'none' rather
  // than silently falling back to a lower-precedence credential.
  if (apiKeyOverride !== undefined) {
    return apiKeyOverride ? {kind: 'api-key', value: apiKeyOverride, source: 'flag'} : {kind: 'none', source: 'none'};
  }

  const fromEnv = process.env.BITMOVIN_API_KEY;
  if (fromEnv !== undefined) {
    return fromEnv ? {kind: 'api-key', value: fromEnv, source: 'env'} : {kind: 'none', source: 'none'};
  }

  if (config.oauth?.accessToken) return {kind: 'oauth', session: config.oauth, source: 'oauth'};

  if (config.apiKey) return {kind: 'api-key', value: config.apiKey, source: 'config-file'};

  return {kind: 'none', source: 'none'};
}
