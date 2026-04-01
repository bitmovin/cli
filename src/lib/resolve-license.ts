export async function resolvePlayerLicense(api: any, idOrKeyOrName: string): Promise<string> {
  const result = await api.player.licenses.list((q: any) => q.limit(100));
  const items = result.items ?? [];

  const match = items.find((l: any) => l.id === idOrKeyOrName)
    ?? items.find((l: any) => l.licenseKey === idOrKeyOrName)
    ?? items.find((l: any) => l.name === idOrKeyOrName);

  if (!match) throw new Error(`No player license found for: ${idOrKeyOrName}`);
  return match.id;
}

export async function resolveAnalyticsLicense(api: any, idOrKeyOrName: string): Promise<string> {
  const result = await api.analytics.licenses.list((q: any) => q.limit(100));
  const items = result.items ?? [];

  const match = items.find((l: any) => l.id === idOrKeyOrName)
    ?? items.find((l: any) => l.licenseKey === idOrKeyOrName)
    ?? items.find((l: any) => l.name === idOrKeyOrName);

  if (!match) throw new Error(`No analytics license found for: ${idOrKeyOrName}`);
  return match.id;
}
