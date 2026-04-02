export async function resolvePlayerLicense(api, idOrKeyOrName) {
    const result = await api.player.licenses.list((q) => q.limit(100));
    const items = result.items ?? [];
    const match = items.find((l) => l.id === idOrKeyOrName)
        ?? items.find((l) => l.licenseKey === idOrKeyOrName)
        ?? items.find((l) => l.name === idOrKeyOrName);
    if (!match)
        throw new Error(`No player license found for: ${idOrKeyOrName}`);
    return match.id;
}
export async function resolveAnalyticsLicense(api, idOrKeyOrName) {
    const result = await api.analytics.licenses.list((q) => q.limit(100));
    const items = result.items ?? [];
    const match = items.find((l) => l.id === idOrKeyOrName)
        ?? items.find((l) => l.licenseKey === idOrKeyOrName)
        ?? items.find((l) => l.name === idOrKeyOrName);
    if (!match)
        throw new Error(`No analytics license found for: ${idOrKeyOrName}`);
    return match.id;
}
//# sourceMappingURL=resolve-license.js.map