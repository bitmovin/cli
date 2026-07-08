import {createRequire} from 'node:module';
import BitmovinApiSdk from '@bitmovin/api-sdk';
import {loadConfig, saveConfig, type OAuthSession} from './config.js';
import {resolveAuth} from './api-key.js';
import {isExpired, refreshAccessToken} from './oauth.js';

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
  new (config: {
    apiKey: string;
    tenantOrgId?: string;
    headers?: Record<string, string>;
    fetch?: typeof fetch;
  }): ApiClient;
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
const SdkModule = BitmovinApiSdk as unknown as {default?: BitmovinApiConstructor};
const BitmovinApi: BitmovinApiConstructor = SdkModule.default ?? (BitmovinApiSdk as unknown as BitmovinApiConstructor);

// Overrides the SDK's default X-Api-Client headers (bitmovin-api-sdk-javascript)
// so backend usage metrics attribute requests to the CLI itself.
const {version: CLI_VERSION} = createRequire(import.meta.url)('../../package.json') as {version: string};

const CLIENT_ID_HEADERS = {
  'X-Api-Client': 'bitmovin-cli',
  'X-Api-Client-Version': CLI_VERSION,
};

const NO_CREDENTIALS_MESSAGE =
  'No credentials configured.\n\n' +
  '  Run one of:\n' +
  '    bitmovin login                              # OAuth (recommended)\n' +
  '    bitmovin config set api-key <your-api-key>  # API key from https://dashboard.bitmovin.com/account\n' +
  '  Or set the BITMOVIN_API_KEY environment variable.\n';

export async function getClient(apiKeyOverride?: string): Promise<ApiClient> {
  const config = loadConfig();
  const auth = resolveAuth(config, apiKeyOverride);

  if (auth.kind === 'none') {
    throw new Error(NO_CREDENTIALS_MESSAGE);
  }

  if (auth.kind === 'api-key') {
    if (!auth.value) {
      throw new Error(NO_CREDENTIALS_MESSAGE);
    }

    return new BitmovinApi({
      apiKey: auth.value,
      ...(config.tenantOrgId && {tenantOrgId: config.tenantOrgId}),
      headers: {...CLIENT_ID_HEADERS},
    });
  }

  // OAuth: refresh proactively if the token is near/past expiry, then build
  // an SDK client that sends Authorization: Bearer instead of X-Api-Key.
  const session = await ensureFreshSession(auth.session);

  return new BitmovinApi({
    // SDK validates apiKey is non-empty; we replace the header below.
    apiKey: 'oauth',
    ...(config.tenantOrgId && {tenantOrgId: config.tenantOrgId}),
    headers: {
      ...CLIENT_ID_HEADERS,
      'X-Api-Key': '',
      Authorization: `Bearer ${session.accessToken}`,
    },
    fetch: createBearerFetch(),
  });
}

async function ensureFreshSession(session: OAuthSession): Promise<OAuthSession> {
  if (!isExpired(session)) return session;

  if (!session.refreshToken) {
    throw new Error(
      'OAuth session expired and no refresh token is available.\n' +
      '  Run: bitmovin login\n',
    );
  }

  let refreshed: OAuthSession;
  try {
    refreshed = await refreshAccessToken(session.refreshToken);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      'Failed to refresh OAuth token: ' + detail + '\n' +
      '  Run: bitmovin login\n',
      {cause: err},
    );
  }

  // Persist refreshed tokens so the next command picks them up without
  // another round-trip.
  const config = loadConfig();
  config.oauth = refreshed;
  saveConfig(config);
  return refreshed;
}

/**
 * Returns a fetch that strips the X-Api-Key header before sending. The SDK
 * unconditionally builds a request with X-Api-Key, but for OAuth sessions we
 * want the server to see only the Authorization: Bearer header.
 */
function createBearerFetch(): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers ?? {});
    if (headers.has('X-Api-Key') && headers.get('X-Api-Key') === '') {
      headers.delete('X-Api-Key');
    }

    return fetch(input, {...init, headers});
  };
}
