import {Flags} from '@oclif/core';
import {apiRequest} from './rest.js';

/**
 * Support-ticket API (`/support/tickets`). Not part of the generated
 * `@bitmovin/api-sdk`, so these calls go through the small REST helper in
 * `rest.ts` — which reuses the CLI's credential resolution.
 *
 * Every call takes the resolved tenant organization id, sent as
 * `X-Tenant-Org-Id`, so a ticket can be listed/created for a sub-organization.
 *
 * NOTE on the path: the older `/account/zendesk/tickets` route is marked
 * deprecated in `bitmovin-open-api` ("Use `/support/tickets` instead").
 * support-service serves both from one controller — `@RequestMapping("/tickets",
 * "/public/tickets")` — behind the two gateway routes, so they are the same
 * handlers and the responses are identical. We use the non-deprecated one.
 */
const TICKETS_PATH = '/support/tickets';

export const TICKET_CATEGORIES = ['encoding', 'player', 'analytics', 'other'] as const;
export const TICKET_STATUSES = ['new', 'open', 'pending', 'hold', 'solved', 'closed', 'deleted'] as const;
export const TICKET_PRIORITIES = ['blocker', 'high', 'medium', 'low'] as const;
export const TICKET_SEVERITIES = ['high', 'medium', 'low', 'minor'] as const;
export const TICKET_SORT_FIELDS = ['createdAt', 'modifiedAt'] as const;

export const MAX_LIMIT = 100;
export const MAX_SEARCH_TEXT_LENGTH = 100;
export const MAX_COMMENT_LENGTH = 65_536;
/**
 * The API's ticket `body` is only checked for non-emptiness, so this bound is the
 * CLI's own: the body goes into a ticket that cannot be withdrawn via the API, and
 * an unbounded `--body-file` would push the confirmation warning off screen.
 * Matches the comment limit for consistency.
 */
export const MAX_BODY_LENGTH = 65_536;

/** Head-and-tail view of a long value, so a preview stays readable and honest about size. */
export function abbreviate(text: string, headChars = 600, tailChars = 200): string {
  if (text.length <= headChars + tailChars) return text;
  const omitted = text.length - headChars - tailChars;
  return `${text.slice(0, headChars)}\n… [${omitted} characters omitted] …\n${text.slice(-tailChars)}`;
}

/**
 * Strips control and escape sequences before printing ticket text.
 *
 * Ticket subjects and comment bodies are attacker-influenceable — anyone who can
 * land a public comment (the requester, a CC'd party) controls them. The API
 * sanitizes HTML but not C0/ANSI, so raw output would let a comment rewrite the
 * rendered conversation, including forging the "(Bitmovin)" agent attribution a
 * reader relies on.
 */
export function sanitizeForTerminal(text: string): string {
  // C0 controls except tab/newline/carriage-return, plus DEL and the C1 range
  // (which is where ANSI/OSC escape sequences live).
  /* eslint-disable-next-line no-control-regex -- stripping control characters is the point */
  return text.replaceAll(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
}

/** Newest comment on a ticket, by createdAt, for the comment preview. */
export function latestComment(ticket: SupportTicketDetail): SupportTicketComment | undefined {
  const comments = ticket.comments ?? [];
  if (comments.length === 0) return undefined;
  return comments.reduce((newest, candidate) =>
    (candidate.createdAt ?? '') > (newest.createdAt ?? '') ? candidate : newest,
  );
}

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
    // Floor, not round: the page that actually contains item `offset + 1` starts
    // at the multiple below it. Rounding up would suggest a page that skips
    // results — the very thing this check exists to prevent.
    const pageStart = Math.floor(offset / limit) * limit;
    return (
      `--offset must be 0 or a multiple of --limit (${limit}); got ${offset}. ` +
      `The API silently returns an earlier page otherwise. Try --offset ${pageStart}.`
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

/**
 * Normalizes a comma-separated filter to what the API can parse.
 *
 * Validation above trims each part, but the API splits on `,` and uppercases
 * *without* trimming — so `--status "open, pending"` would pass validation here and
 * still come back as HTTP 400, exactly the round trip the local check exists to
 * avoid. Send what we validated.
 */
export function normalizeEnumFilter(value: string): string {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(',');
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

/**
 * The optional create-ticket fields, declared once.
 *
 * The oclif flags, the accepted flag type, and the API payload key all come from
 * this table. Previously the same ~18 fields were listed three times — flag
 * definition, TypeScript interface, payload mapping — and the call site cast the
 * parsed flags, so a field added to two of the three compiled cleanly and then never
 * reached the API. Add a field here and it is wired end to end.
 */
export const CREATE_TICKET_FIELDS = [
  {flag: 'subject', payload: 'subject', description: 'Ticket subject'},
  {flag: 'priority', payload: 'priority', description: 'Ticket priority', options: TICKET_PRIORITIES},
  {flag: 'severity', payload: 'severity', description: 'Ticket severity', options: TICKET_SEVERITIES},
  {flag: 'platform', payload: 'platform', description: 'Affected platform (e.g. web, android, ios, roku)'},
  {flag: 'sdk-version', payload: 'sdkVersion', description: 'SDK / player version in use'},
  {flag: 'encoding-id', payload: 'encodingId', description: 'Affected encoding ID (requires --category encoding)'},
  {flag: 'license', payload: 'license', description: 'Affected license key (requires --category player or analytics)'},
  {flag: 'page-url', payload: 'pageUrl', description: 'URL where the issue reproduces (requires --category player or analytics)'},
  {
    flag: 'allow-file-access',
    payload: 'allowFileAccess',
    description: 'Allow Bitmovin support to access the referenced files (requires --category encoding)',
    type: 'boolean' as const,
  },
  {flag: 'input-url', payload: 'inputUrl', description: 'Input / stream URL involved'},
  {flag: 'request-type', payload: 'requestType', description: 'Kind of request', values: REQUEST_TYPES},
  {flag: 'reference-id', payload: 'referenceId', description: 'Your own reference (e.g. internal ticket id)'},
  {
    flag: 'reproducible-with-sample-app',
    payload: 'reproducibleWithSampleApp',
    description: 'Whether the issue reproduces in the Bitmovin sample app',
    values: REPRODUCIBLE_WITH_SAMPLE_APP,
  },
  {
    flag: 'reproducible-reliably',
    payload: 'reproducibleReliably',
    description: 'Whether the issue reproduces reliably',
    values: REPRODUCIBLE_RELIABLY,
  },
  {flag: 'os-details', payload: 'osDetails', description: 'Operating system details'},
  {flag: 'device-details', payload: 'deviceDetails', description: 'Device details'},
  {flag: 'geo-restriction-country', payload: 'geoRestrictionCountry', description: 'Country the issue is restricted to'},
] as const;

export interface CreateTicketFlags extends Record<string, unknown> {
  body: string;
  category: string;
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

  for (const field of CREATE_TICKET_FIELDS) {
    const value = flags[field.flag];
    if (value === undefined) continue;
    // `values` maps the CLI's readable choice onto the API's field value.
    payload[field.payload] = 'values' in field ? field.values[value as string] : value;
  }

  if (tenantOrgId !== undefined) payload.organizationId = tenantOrgId;

  return payload;
}

/**
 * oclif flag definitions derived from {@link CREATE_TICKET_FIELDS}, so the flags and
 * the payload mapping cannot diverge. Spread into a command's `flags`.
 */
export function createTicketFlags() {
  const entries = CREATE_TICKET_FIELDS.map((field) => {
    const flag =
      'type' in field && field.type === 'boolean'
        ? Flags.boolean({description: field.description})
        : Flags.string({
            description: field.description,
            ...('options' in field && {options: [...field.options]}),
            ...('values' in field && {options: Object.keys(field.values)}),
          });
    return [field.flag, flag] as const;
  });

  return Object.fromEntries(entries);
}

/**
 * Category-gated fields.
 *
 * The API does NOT reject these when the category does not match — it maps them
 * only inside the branch for their category and otherwise drops them silently, so
 * the create succeeds while the data disappears. That is why the check lives here:
 * without it, `--category player --allow-file-access` would leave the user
 * believing they granted support access to their files while support sees no such
 * field. Do not relax this expecting a loud API error.
 */
export function validateCreateTicketPayload(payload: Record<string, unknown>): string | undefined {
  const category = String(payload.category ?? '').toLowerCase();

  if (typeof payload.body !== 'string' || payload.body.trim() === '') {
    return 'Ticket body must not be empty.';
  }

  if (payload.encodingId !== undefined && category !== 'encoding') {
    return `--encoding-id requires --category encoding (got '${category}').`;
  }

  if (payload.allowFileAccess !== undefined && category !== 'encoding') {
    return `--allow-file-access requires --category encoding (got '${category}').`;
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
