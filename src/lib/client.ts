import BitmovinApiSdk from '@bitmovin/api-sdk';
import {loadConfig} from './config.js';

// The Bitmovin SDK is CJS with `export default class BitmovinApi`.
// Under NodeNext module resolution, TypeScript treats default imports from CJS
// as module namespaces. We extract the actual class types via import().default.
type AccountApi = import('@bitmovin/api-sdk/dist/account/AccountApi.js').default;
type AnalyticsApi = import('@bitmovin/api-sdk/dist/analytics/AnalyticsApi.js').default;
type EncodingApi = import('@bitmovin/api-sdk/dist/encoding/EncodingApi.js').default;
type GeneralApi = import('@bitmovin/api-sdk/dist/general/GeneralApi.js').default;
type NotificationsApi = import('@bitmovin/api-sdk/dist/notifications/NotificationsApi.js').default;
type PlayerApi = import('@bitmovin/api-sdk/dist/player/PlayerApi.js').default;
type StreamsApi = import('@bitmovin/api-sdk/dist/streams/StreamsApi.js').default;

interface BitmovinApiConstructor {
  new (config: {apiKey: string; tenantOrgId?: string}): ApiClient;
}

export interface ApiClient {
  account: AccountApi;
  analytics: AnalyticsApi;
  encoding: EncodingApi;
  general: GeneralApi;
  notifications: NotificationsApi;
  player: PlayerApi;
  streams: StreamsApi;
}

// Handle CJS/ESM interop — the SDK may expose the constructor as .default
const BitmovinApi: BitmovinApiConstructor = (BitmovinApiSdk as any).default ?? BitmovinApiSdk;

export function getClient(apiKeyOverride?: string): ApiClient {
  const config = loadConfig();
  const apiKey = apiKeyOverride ?? process.env.BITMOVIN_API_KEY ?? config.apiKey;

  if (!apiKey) {
    throw new Error(
      'No API key configured.\n\n' +
      '  1. Get your API key from https://dashboard.bitmovin.com/account\n' +
      '  2. Run: bitmovin config set api-key <your-api-key>\n' +
      '  Or set the BITMOVIN_API_KEY environment variable.\n',
    );
  }

  return new BitmovinApi({
    apiKey,
    ...(config.tenantOrgId && {tenantOrgId: config.tenantOrgId}),
  });
}
