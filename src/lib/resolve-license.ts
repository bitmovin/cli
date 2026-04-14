import type {ApiClient} from './client.js';

export async function resolvePlayerLicense(api: ApiClient, idOrKeyOrName: string): Promise<string> {
  const result = await api.player.licenses.list({limit: 100});
  const items = result.items ?? [];

  const match = items.find((l) => l.id === idOrKeyOrName)
    ?? items.find((l) => l.licenseKey === idOrKeyOrName)
    ?? items.find((l) => l.name === idOrKeyOrName);

  if (!match?.id) throw new Error(`No player license found for: ${idOrKeyOrName}`);
  return match.id;
}

export async function resolveAnalyticsLicense(api: ApiClient, idOrKeyOrName: string): Promise<string> {
  const result = await api.analytics.licenses.list({limit: 100});
  const items = result.items ?? [];

  const match = items.find((l) => l.id === idOrKeyOrName)
    ?? items.find((l) => l.licenseKey === idOrKeyOrName)
    ?? items.find((l) => l.name === idOrKeyOrName);

  if (!match?.id) throw new Error(`No analytics license found for: ${idOrKeyOrName}`);
  return match.id;
}
