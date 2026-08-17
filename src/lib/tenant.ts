/**
 * Which organization a request targets.
 *
 * Its own module on purpose: `base-command.ts` needs it for every command, and the
 * command tests mock `client.js` wholesale — importing it from there would force
 * every existing test to extend its mock. It is also a request concern rather than
 * an account-resource one, so it does not belong in `organizations.ts`.
 */

/**
 * An explicit `--organization` wins over the configured one. Pure — the caller
 * supplies the configured value — so the same rule applies to SDK and REST calls
 * without either reaching into the config file, and a future `--profile` only has to
 * change where `configuredOrgId` comes from.
 *
 * A blank flag value is rejected rather than treated as "no organization": with
 * `--organization "$SUB_ORG"` and `SUB_ORG` unset, falling back would silently widen
 * a write from the intended sub-organization to the credential's own organization.
 *
 * A blank *configured* value cannot be rejected the same way — the user is not
 * supplying it in this invocation — so it is normalized to "no organization". Passing
 * `""` through would break the header/body agreement `create` relies on: it sets
 * `organizationId` for any value that is not `undefined`, while the REST helper only
 * sends `X-Tenant-Org-Id` for a truthy one, so the request would claim an empty
 * organization in its body and none in its header.
 */
export function resolveTenantOrgId(flagValue?: string, configuredOrgId?: string): string | undefined {
  if (flagValue !== undefined && flagValue.trim() === '') {
    throw new Error('--organization was given an empty value. Pass an organization id, or omit the flag to use the configured organization.');
  }

  const configured = configuredOrgId?.trim() === '' ? undefined : configuredOrgId;
  return flagValue ?? configured;
}
