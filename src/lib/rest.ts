import {getAuthHeaders} from './client.js';

/**
 * Minimal REST client for Bitmovin API endpoints that the generated
 * `@bitmovin/api-sdk` does not expose yet (currently the support-ticket
 * endpoints under `/support/tickets`). It reuses the CLI's credential
 * resolution (`getAuthHeaders`) so the API key / OAuth precedence, silent token
 * refresh, and `X-Api-Client` identification stay identical to SDK calls.
 *
 * Prefer the SDK (`BaseCommand.getApi()`) for anything it covers.
 */
const API_BASE_URL = 'https://api.bitmovin.com/v1';

/** Bounded so a hung API surfaces an error instead of an indefinitely silent CLI. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Header the API uses to scope a request to a (sub-)organization. */
export const TENANT_ORG_HEADER = 'X-Tenant-Org-Id';

export type QueryValue = string | number | boolean | undefined;

export interface ApiRequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Sent as X-Tenant-Org-Id — targets a sub-organization. */
  tenantOrgId?: string;
  /** Value of the --api-key flag, if given. */
  apiKey?: string;
}

/**
 * Carries the same fields as the SDK's `BitmovinError` so `BaseCommand.catch`
 * renders REST failures exactly like SDK failures. `tenantOrgId` is added so
 * the 403 hint can name the organization the request was scoped to, which is
 * not necessarily the one in the config file.
 */
export class BitmovinRestError extends Error {
  readonly httpStatusCode: number;
  readonly errorCode?: number | string;
  readonly developerMessage?: string;
  readonly requestId?: string;
  readonly tenantOrgId?: string;

  constructor(args: {
    message: string;
    httpStatusCode: number;
    errorCode?: number | string;
    developerMessage?: string;
    requestId?: string;
    tenantOrgId?: string;
  }) {
    super(args.message);
    this.name = 'BitmovinRestError';
    this.httpStatusCode = args.httpStatusCode;
    this.errorCode = args.errorCode;
    this.developerMessage = args.developerMessage;
    this.requestId = args.requestId;
    this.tenantOrgId = args.tenantOrgId;
  }
}

interface ResponseEnvelope<T> {
  requestId?: string;
  status?: string;
  data?: {
    result?: T;
    code?: number | string;
    message?: string;
    developerMessage?: string;
  };
}

/**
 * Performs a request against the Bitmovin API and unwraps the standard
 * `{data: {result}}` envelope. Errors become {@link BitmovinRestError}.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(await getAuthHeaders(options.apiKey)),
    Accept: 'application/json',
  };

  if (options.tenantOrgId) headers[TENANT_ORG_HEADER] = options.tenantOrgId;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers,
    // `X-Api-Key` is a custom header, so undici does NOT strip it across origins
    // the way it strips `Authorization`. Refuse redirects rather than forward the
    // credential to wherever a redirect points.
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...(options.body !== undefined && {body: JSON.stringify(options.body)}),
  });

  const text = await response.text();
  let envelope: ResponseEnvelope<T> | undefined;
  try {
    envelope = text ? (JSON.parse(text) as ResponseEnvelope<T>) : undefined;
  } catch {
    envelope = undefined;
  }

  if (!response.ok) {
    const data = envelope?.data;
    throw new BitmovinRestError({
      message: data?.message ?? `Request failed with HTTP ${response.status}`,
      httpStatusCode: response.status,
      errorCode: data?.code,
      developerMessage: data?.developerMessage ?? data?.message ?? (envelope ? undefined : truncate(text)),
      requestId: envelope?.requestId,
      tenantOrgId: options.tenantOrgId,
    });
  }

  // A 2xx whose body is not a Bitmovin envelope is NOT a success. Without this,
  // an intercepting gateway answering a create POST with an HTML maintenance page
  // would return `{}` and the CLI would report a ticket that was never filed.
  if (!envelope || envelope.data === undefined) {
    throw new BitmovinRestError({
      message: `The API returned HTTP ${response.status} with an unexpected body.`,
      httpStatusCode: response.status,
      developerMessage: truncate(text) ?? 'The response body was empty.',
      tenantOrgId: options.tenantOrgId,
    });
  }

  if (envelope.status && envelope.status !== 'SUCCESS') {
    throw new BitmovinRestError({
      message: envelope.data.message ?? `The API reported status "${envelope.status}".`,
      httpStatusCode: response.status,
      errorCode: envelope.data.code,
      developerMessage: envelope.data.developerMessage,
      requestId: envelope.requestId,
      tenantOrgId: options.tenantOrgId,
    });
  }

  return (envelope.data.result ?? {}) as T;
}

function truncate(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed;
}
