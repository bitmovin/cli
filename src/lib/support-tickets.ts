import {apiRequest} from './rest.js';

/**
 * Support-ticket API (`/account/zendesk/tickets`). Not part of the generated
 * `@bitmovin/api-sdk`, so these calls go through the small REST helper in
 * `rest.ts` — which reuses the CLI's credential resolution.
 *
 * Every call takes the resolved tenant organization id, sent as
 * `X-Tenant-Org-Id`, so a ticket can be listed/created for a sub-organization.
 */
const TICKETS_PATH = '/account/zendesk/tickets';

export const TICKET_CATEGORIES = ['encoding', 'player', 'analytics', 'other'] as const;
export const TICKET_STATUSES = ['new', 'open', 'pending', 'hold', 'solved', 'closed', 'deleted'] as const;
export const TICKET_PRIORITIES = ['blocker', 'high', 'medium', 'low'] as const;
export const TICKET_SEVERITIES = ['high', 'medium', 'low', 'minor'] as const;
export const TICKET_SORT_FIELDS = ['createdAt', 'modifiedAt'] as const;

export const MAX_LIMIT = 100;
export const MAX_SEARCH_TEXT_LENGTH = 100;
export const MAX_COMMENT_LENGTH = 65_536;

/** CLI-friendly flag values mapped to the API's Zendesk field values. */
export const REQUEST_TYPES: Record<string, string> = {
  'technical-question': 'technical_question',
  'unexpected-behaviour': 'unexpected_behaviour',
  'feature-suggestion': 'feature_suggestion',
  'additional-assistance': 'additional_assistance',
};

export const REPRODUCIBLE_WITH_SAMPLE_APP: Record<string, string> = {
  yes: 'player_sample_app_yes',
  no: 'player_sample_app_no',
  'didnt-try': 'player_sample_app_didnt_try',
};

export const REPRODUCIBLE_RELIABLY: Record<string, string> = {
  yes: 'reprod_yes',
  no: 'reprod_no',
  sometimes: 'reprod_sometimes',
};

export interface SupportTicket extends Record<string, unknown> {
  caseId?: number;
  externalId?: string;
  subject?: string;
  category?: string;
  status?: string;
  priority?: string;
  severity?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface SupportTicketComment {
  id?: number;
  body?: string;
  htmlBody?: string;
  createdAt?: string;
  author?: {name?: string; agent?: boolean};
  attachments?: {id?: number; fileName?: string; contentType?: string; size?: number; url?: string}[];
}

export interface SupportTicketDetail extends SupportTicket {
  requester?: {name?: string; agent?: boolean};
  organization?: {id?: string; name?: string};
  comments?: SupportTicketComment[];
}

export interface SupportTicketPage {
  items?: SupportTicket[];
  totalCount?: number;
  previous?: string;
  next?: string;
}

export interface ListTicketsOptions {
  limit: number;
  offset: number;
  status?: string;
  category?: string;
  priority?: string;
  severity?: string;
  searchText?: string;
  sort?: string;
}

export interface RequestContext {
  tenantOrgId?: string;
  apiKey?: string;
}

export async function listTickets(options: ListTicketsOptions, context: RequestContext): Promise<SupportTicketPage> {
  return apiRequest<SupportTicketPage>(TICKETS_PATH, {
    query: {
      limit: options.limit,
      offset: options.offset,
      status: options.status,
      category: options.category,
      priority: options.priority,
      severity: options.severity,
      searchText: options.searchText,
      sort: options.sort,
    },
    ...context,
  });
}

export async function getTicket(caseId: string, context: RequestContext): Promise<SupportTicketDetail> {
  return apiRequest<SupportTicketDetail>(`${TICKETS_PATH}/${encodeURIComponent(caseId)}`, context);
}

export interface CreatedTicket {
  id?: number;
  subject?: string;
}

export async function createTicket(payload: Record<string, unknown>, context: RequestContext): Promise<CreatedTicket> {
  return apiRequest<CreatedTicket>(TICKETS_PATH, {method: 'POST', body: payload, ...context});
}

export interface CommentPayload extends Record<string, unknown> {
  htmlBody: string;
  /** The ticket's last known modifiedAt — the API requires it for collision protection. */
  updatedStamp: string;
}

export interface AddedComment {
  caseId?: number;
  modifiedAt?: string;
}

export async function addComment(caseId: string, payload: CommentPayload, context: RequestContext): Promise<AddedComment> {
  return apiRequest<AddedComment>(`${TICKETS_PATH}/${encodeURIComponent(caseId)}/comments`, {
    method: 'POST',
    body: payload,
    ...context,
  });
}

/**
 * The API accepts any non-negative offset but silently serves an earlier page
 * unless the offset lands on a page boundary, so reject that client-side rather
 * than returning duplicate results.
 */
export function validatePagination(limit: number, offset: number): string | undefined {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return `--limit must be an integer between 1 and ${MAX_LIMIT}.`;
  }

  if (!Number.isInteger(offset) || offset < 0) {
    return '--offset must be an integer greater than or equal to 0.';
  }

  if (offset % limit !== 0) {
    const nearest = Math.round(offset / limit) * limit;
    return (
      `--offset must be 0 or a multiple of --limit (${limit}); got ${offset}. ` +
      `The API silently returns an earlier page otherwise. Try --offset ${nearest}.`
    );
  }

  return undefined;
}

/** The API rejects punctuation in searchText, and truncating silently would change the query. */
export function validateSearchText(searchText: string): string | undefined {
  if (searchText.length > MAX_SEARCH_TEXT_LENGTH) {
    return `--search must not exceed ${MAX_SEARCH_TEXT_LENGTH} characters (got ${searchText.length}).`;
  }

  if (!/^[a-zA-Z0-9 ]*$/.test(searchText)) {
    return '--search may only contain letters, digits, and spaces — the API rejects punctuation.';
  }

  return undefined;
}

/**
 * Validates a comma-separated filter value (the API accepts several values per
 * filter) against the allowed set, case-insensitively.
 */
export function validateEnumFilter(flagName: string, value: string, allowed: readonly string[]): string | undefined {
  const invalid = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => !allowed.includes(part.toLowerCase()));

  if (invalid.length > 0) {
    return `${flagName}: unknown value(s) ${invalid.map((v) => `'${v}'`).join(', ')}. Allowed: ${allowed.join(', ')}.`;
  }

  return undefined;
}

export function validateSort(sort: string): string | undefined {
  const parts = sort.split(',').filter(Boolean);
  for (const part of parts) {
    const [field, direction, ...rest] = part.split(':');
    if (rest.length > 0 || !TICKET_SORT_FIELDS.includes(field as (typeof TICKET_SORT_FIELDS)[number])) {
      return `--sort must be <field>[:ASC|:DESC] with field one of ${TICKET_SORT_FIELDS.join(', ')}; got '${part}'.`;
    }

    if (direction !== undefined && !['ASC', 'DESC'].includes(direction.toUpperCase())) {
      return `--sort direction must be ASC or DESC; got '${direction}'.`;
    }
  }

  return undefined;
}

export interface CreateTicketFlags {
  body: string;
  category: string;
  subject?: string;
  priority?: string;
  severity?: string;
  platform?: string;
  'sdk-version'?: string;
  'encoding-id'?: string;
  license?: string;
  'page-url'?: string;
  'allow-file-access'?: boolean;
  'input-url'?: string;
  'request-type'?: string;
  'reference-id'?: string;
  'reproducible-with-sample-app'?: string;
  'reproducible-reliably'?: string;
  'os-details'?: string;
  'device-details'?: string;
  'geo-restriction-country'?: string;
}

/**
 * Builds the create-ticket request body.
 *
 * `organizationId` is always set from the resolved tenant organization (never
 * from a separate flag): the API rejects the request when the body's
 * `organizationId` disagrees with the `X-Tenant-Org-Id` header, so the two can
 * only ever be set together.
 */
export function buildCreateTicketPayload(flags: CreateTicketFlags, tenantOrgId?: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    body: flags.body,
    category: flags.category,
  };

  const optional: Record<string, unknown> = {
    subject: flags.subject,
    priority: flags.priority,
    severity: flags.severity,
    platform: flags.platform,
    sdkVersion: flags['sdk-version'],
    encodingId: flags['encoding-id'],
    license: flags.license,
    pageUrl: flags['page-url'],
    allowFileAccess: flags['allow-file-access'],
    inputUrl: flags['input-url'],
    requestType: flags['request-type'] && REQUEST_TYPES[flags['request-type']],
    referenceId: flags['reference-id'],
    reproducibleWithSampleApp: flags['reproducible-with-sample-app'] && REPRODUCIBLE_WITH_SAMPLE_APP[flags['reproducible-with-sample-app']],
    reproducibleReliably: flags['reproducible-reliably'] && REPRODUCIBLE_RELIABLY[flags['reproducible-reliably']],
    osDetails: flags['os-details'],
    deviceDetails: flags['device-details'],
    geoRestrictionCountry: flags['geo-restriction-country'],
    organizationId: tenantOrgId,
  };

  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) payload[key] = value;
  }

  return payload;
}

/**
 * Category-gated fields — the API only accepts these in combination with a
 * matching category, and rejecting locally beats a confirmed-then-failed create.
 */
export function validateCreateTicketPayload(payload: Record<string, unknown>): string | undefined {
  const category = String(payload.category ?? '').toLowerCase();

  if (typeof payload.body !== 'string' || payload.body.trim() === '') {
    return 'Ticket body must not be empty.';
  }

  if (payload.encodingId !== undefined && category !== 'encoding') {
    return `--encoding-id requires --category encoding (got '${category}').`;
  }

  for (const field of ['license', 'pageUrl'] as const) {
    if (payload[field] !== undefined && category !== 'player' && category !== 'analytics') {
      const flag = field === 'pageUrl' ? '--page-url' : '--license';
      return `${flag} requires --category player or --category analytics (got '${category}').`;
    }
  }

  return undefined;
}

/**
 * Comments are posted as `htmlBody`. Plain text is escaped and its line breaks
 * converted, so a multi-line terminal/file input does not collapse into one
 * paragraph and `<`/`&` in log excerpts survive verbatim. `--html` passes the
 * input through untouched (the API sanitizes it server-side either way).
 */
export function toHtmlBody(text: string, isHtml: boolean): string {
  if (isHtml) return text;
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll(/\r\n|\r|\n/g, '<br>\n');
}

export function validateCommentBody(htmlBody: string): string | undefined {
  if (htmlBody.trim() === '') return 'Comment body must not be empty.';
  if (htmlBody.length > MAX_COMMENT_LENGTH) {
    return `Comment body must not exceed ${MAX_COMMENT_LENGTH} characters (got ${htmlBody.length}).`;
  }

  return undefined;
}
