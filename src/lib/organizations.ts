import {Flags} from '@oclif/core';
import type {Organization} from '@bitmovin/api-sdk';
import {loadConfig} from './config.js';
import type {ApiClient} from './client.js';
import {apiRequest} from './rest.js';

export const ROOT_ORGANIZATION = 'ROOT_ORGANIZATION';
export const SUB_ORGANIZATION = 'SUB_ORGANIZATION';

export interface OrganizationRow extends Record<string, unknown> {
  id: string;
  name: string;
  /** ROOT_ORGANIZATION or SUB_ORGANIZATION, derived from parentId when absent. */
  type: string;
  /** Parent organization id, or null for a root organization. */
  parentId: string | null;
  /** Whether this is the organization the CLI currently targets. */
  active: boolean;
}

export const ORGANIZATION_COLUMNS = ['id', 'name', 'type', 'parentId', 'active'];

/**
 * `--organization` (alias `--tenant-org`) for commands that can act on a
 * sub-organization. Sent as the `X-Tenant-Org-Id` header; defaults to the
 * organization stored by `bitmovin config set organization`.
 */
export const organizationFlag = Flags.string({
  description: 'Organization to act on (sub-org id); sent as X-Tenant-Org-Id. Defaults to the configured organization.',
  aliases: ['tenant-org'],
  helpValue: '<org-id>',
});

/**
 * Flag value wins over the configured organization; undefined means "the API key's
 * own org".
 *
 * A blank flag value is rejected rather than treated as either. `--organization ""`
 * (an unset shell variable in CI, say) would otherwise drop the `X-Tenant-Org-Id`
 * header while still sending `organizationId: ""`, which the API treats as absent —
 * silently widening a write from the intended sub-org to the credential's own org.
 */
export function resolveTenantOrgId(flagValue?: string): string | undefined {
  if (flagValue !== undefined && flagValue.trim() === '') {
    throw new Error('--organization was given an empty value. Pass an organization id, or omit the flag to use the configured organization.');
  }

  return flagValue ?? loadConfig().tenantOrgId;
}

/**
 * Lists every organization the credential can see — roots and sub-orgs in one
 * flat list, each sub-org carrying its `parentId`.
 *
 * `GET /account/organizations/{id}/sub-organizations` is deliberately not used:
 * it answers `1001 An organization with the given id does not exist` for org ids
 * that are plainly visible in this listing, so the hierarchy is derived from
 * `parentId` instead.
 *
 * Paged through the REST helper rather than the SDK: `organizations.list()` takes
 * no arguments, so it silently returns only the API's default first page. On an
 * account with more organizations than that page holds, sub-orgs whose parent sits
 * on a later page would be rendered as roots, and `--parent` would report a
 * visible organization as invisible.
 */
export async function listOrganizations(_api: ApiClient, apiKey?: string, pageSize = 100): Promise<Organization[]> {
  const items: Organization[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const page = await apiRequest<{items?: Organization[]; totalCount?: number}>('/account/organizations', {
      query: {limit: pageSize, offset},
      apiKey,
    });
    const pageItems = page.items ?? [];
    items.push(...pageItems);

    const total = page.totalCount;
    if (total !== undefined && items.length >= total) return items;
    if (pageItems.length === 0) return items;

    if (pageItems.length < pageSize) {
      // Offsets must stay page-aligned (this API pages by offset/limit), so we
      // cannot resume mid-page. A short page while `totalCount` says there is more
      // means the server capped the page size — report it rather than quietly
      // returning a truncated list that would misrender the org hierarchy.
      if (total !== undefined && items.length < total) {
        throw new Error(
          `Listed only ${items.length} of ${total} organizations: the API returned ${pageItems.length} items for a ` +
          `page size of ${pageSize}. Please report this — the organization list would otherwise be incomplete.`,
        );
      }

      return items;
    }
  }
}

/**
 * Flattens organizations into display rows ordered parent-first: every root is
 * immediately followed by its sub-organizations, so the hierarchy stays readable
 * in a flat table. Sub-orgs whose parent is not visible to the credential are
 * emitted at the top level, keeping their `parentId` so nothing is hidden.
 */
export function toOrganizationRows(orgs: Organization[], activeOrgId?: string): OrganizationRow[] {
  const withId = orgs.filter((org): org is Organization & {id: string} => Boolean(org.id));
  const ids = new Set(withId.map((org) => org.id));

  const childrenByParent = new Map<string, (Organization & {id: string})[]>();
  const roots: (Organization & {id: string})[] = [];
  for (const org of withId) {
    // A sub-org whose parent is not in the listing is treated as a root for
    // ordering purposes only — its parentId is still reported.
    if (org.parentId && ids.has(org.parentId)) {
      const siblings = childrenByParent.get(org.parentId) ?? [];
      siblings.push(org);
      childrenByParent.set(org.parentId, siblings);
    } else {
      roots.push(org);
    }
  }

  const byLabel = (a: Organization, b: Organization) => (a.name ?? '').localeCompare(b.name ?? '') || (a.id ?? '').localeCompare(b.id ?? '');
  const rows: OrganizationRow[] = [];
  const emitted = new Set<string>();

  const emit = (org: Organization & {id: string}) => {
    if (emitted.has(org.id)) return; // guards against a parentId cycle
    emitted.add(org.id);
    rows.push(toRow(org, activeOrgId));
    for (const child of (childrenByParent.get(org.id) ?? []).sort(byLabel)) emit(child);
  };

  for (const root of roots.sort(byLabel)) emit(root);
  // Anything unreachable from a root (only possible if the API ever reports a
  // parentId cycle) is still listed rather than silently dropped.
  for (const org of withId.sort(byLabel)) emit(org);
  return rows;
}

function toRow(org: Organization & {id: string}, activeOrgId?: string): OrganizationRow {
  return {
    id: org.id,
    name: org.name ?? '',
    type: String(org.type ?? (org.parentId ? SUB_ORGANIZATION : ROOT_ORGANIZATION)),
    parentId: org.parentId ?? null,
    active: activeOrgId === org.id,
  };
}
