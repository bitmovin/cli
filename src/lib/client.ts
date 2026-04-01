import BitmovinApiSdk from '@bitmovin/api-sdk';
import {loadConfig} from './config.js';

// Handle CJS/ESM interop — the SDK may expose the constructor as .default
const BitmovinApi: any = (BitmovinApiSdk as any).default ?? BitmovinApiSdk;

let cachedClient: any;

export function getClient(apiKeyOverride?: string): any {
  if (cachedClient && !apiKeyOverride) return cachedClient;

  const config = loadConfig();
  const apiKey = apiKeyOverride ?? config.apiKey;

  if (!apiKey) {
    throw new Error(
      'No API key configured.\n\n' +
      '  1. Get your API key from https://dashboard.bitmovin.com/account\n' +
      '  2. Run: bitmovin config set api-key <your-api-key>\n',
    );
  }

  cachedClient = new BitmovinApi({
    apiKey,
    ...(config.tenantOrgId && {tenantOrgId: config.tenantOrgId}),
  });

  return cachedClient;
}
