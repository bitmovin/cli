import BitmovinApiSdk from '@bitmovin/api-sdk';
import { loadConfig } from './config.js';
// Handle CJS/ESM interop — the SDK may expose the constructor as .default
const BitmovinApi = BitmovinApiSdk.default ?? BitmovinApiSdk;
export function getClient(apiKeyOverride) {
    const config = loadConfig();
    const apiKey = apiKeyOverride ?? process.env.BITMOVIN_API_KEY ?? config.apiKey;
    if (!apiKey) {
        throw new Error('No API key configured.\n\n' +
            '  1. Get your API key from https://dashboard.bitmovin.com/account\n' +
            '  2. Run: bitmovin config set api-key <your-api-key>\n' +
            '  Or set the BITMOVIN_API_KEY environment variable.\n');
    }
    return new BitmovinApi({
        apiKey,
        ...(config.tenantOrgId && { tenantOrgId: config.tenantOrgId }),
    });
}
//# sourceMappingURL=client.js.map