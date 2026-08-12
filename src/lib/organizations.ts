import {Flags} from '@oclif/core';
import type {Organization} from '@bitmovin/api-sdk';
import {loadConfig} from './config.js';
import type {ApiClient} from './client.js';

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

/** Flag value wins over the configured organization; undefined means "the API key's own org". */
export function resolveTenantOrgId(flagValue?: string): string | undefined {
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
 */
export async function listOrganizations(api: ApiClient): Promise<Organization[]> {
  const result = await api.account.organizations.list();
  return result.items ?? [];
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
