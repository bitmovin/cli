import {Command, Flags} from '@oclif/core';
import chalk from 'chalk';
import {getClient, type ApiClient} from './client.js';
import {sanitizeForTerminal} from './sanitize.js';
import {resolveTenantOrgId} from './tenant.js';
import {formatJson, formatTable, formatKeyValue, isTTY} from './output.js';
import {applyJq} from './jq.js';
import {loadConfig} from './config.js';

export abstract class BaseCommand extends Command {
  static baseFlags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output JSON to stdout. Use with --jq for filtering.',
      default: false,
    }),
    fields: Flags.string({
      description: 'Comma-separated list of fields to include in JSON output (implies --json)',
    }),
    jq: Flags.string({
      description: 'Filter JSON output with a jq expression (implies --json)',
    }),
    format: Flags.string({
      description: 'Force output format',
      options: ['table'],
      hidden: false,
    }),
    'api-key': Flags.string({description: 'Override API key'}),
    quiet: Flags.boolean({char: 'q', description: 'Suppress non-essential output'}),
  };

  /**
   * `--organization` (alias `--tenant-org`) for commands that can act on a
   * sub-organization. Spread into a command's flags alongside {@link baseFlags};
   * {@link requestScope} then applies it to SDK and REST calls alike, so declaring
   * it can never leave it silently ignored.
   *
   * Only spread it into a command whose request is actually scoped by it. A command
   * that cannot pass the organization on (because its endpoint ignores the header,
   * say) must leave it out: the flag also rejects an empty value, so an unused
   * `--organization "$UNSET_VAR"` would abort the command over a no-op.
   */
  static tenantOrgFlag = {
    organization: Flags.string({
      description: 'Organization to act on (sub-org id); sent as X-Tenant-Org-Id. Defaults to the configured organization.',
      aliases: ['tenant-org'],
      helpValue: '<org-id>',
    }),
  };

  /**
   * `--limit` / `--offset` for list commands, declared once so the defaults and
   * wording cannot drift between them. `notes` appends an API-specific constraint —
   * the support-ticket API, for instance, caps the page size and rejects an offset
   * that is not page-aligned.
   */
  static paginationFlags(notes: {limit?: string; offset?: string} = {}) {
    return {
      limit: Flags.integer({description: `Max results${notes.limit ? ` ${notes.limit}` : ''}`, default: 25}),
      offset: Flags.integer({description: `Offset for pagination${notes.offset ? `; ${notes.offset}` : ''}`, default: 0}),
    };
  }

  private _parsedFlags?: Record<string, unknown>;
  private _api?: ApiClient;
  private _jsonMode?: {enabled: boolean; fields?: string[]};
  private _scope?: {apiKey?: string; tenantOrgId?: string};

  /**
   * Status/info messages. Goes to stderr in JSON mode so stdout stays clean.
   * Goes to stdout in interactive mode so users see it normally.
   */
  override log(message?: string, ...args: unknown[]): void {
    if (this._jsonMode?.enabled) {
      this.logToStderr(message, ...args);
    } else {
      // Default oclif behavior: stdout
      super.log(message, ...args);
    }
  }

  protected override async catch(err: Error & {httpStatusCode?: number; errorCode?: number | string; developerMessage?: string; requestId?: string; tenantOrgId?: string}): Promise<void> {
    // Handle Bitmovin API errors
    if (err.httpStatusCode) {
      const config = loadConfig();
      const lines: string[] = [];

      switch (err.httpStatusCode) {
        case 401:
          lines.push(chalk.red('Authentication failed.'));
          lines.push('');
          lines.push('  Your credentials are invalid or missing. Try one of:');
          lines.push('    bitmovin login                              # OAuth (recommended)');
          lines.push('    bitmovin config set api-key <your-api-key>  # API key');
          lines.push('  Get an API key at https://dashboard.bitmovin.com/account');
          break;
        case 403: {
          lines.push(chalk.red('Access denied.'));
          lines.push('');
          // Name the organization the failed request was scoped to, not the
          // configured one. `tenantOrgId` on the error is the most precise source
          // (BitmovinRestError carries it), but the SDK's BitmovinError never does —
          // so fall back to the scope this invocation resolved, which is what any
          // SDK command with --organization was sent with. Only if neither is known
          // does the configured organization stand in.
          const orgId = err.tenantOrgId ?? this._scope?.tenantOrgId ?? config.tenantOrgId;
          if (orgId) {
            lines.push(`  Organization: ${orgId}`);
            lines.push('  Your credentials have no access grant for this organization, or it cannot access this resource.');
            lines.push('');
            lines.push('  Check which organizations you can use:');
            lines.push('    bitmovin account organizations list');
            lines.push('    bitmovin config set organization <id>');
          } else {
            lines.push('  Your API key does not have permission for this resource.');
            lines.push('  You may need to select an organization:');
            lines.push('    bitmovin account organizations list');
            lines.push('    bitmovin config set organization <id>');
          }

          break;
        }

        case 404:
          lines.push(chalk.red('Resource not found.'));
          if (err.developerMessage) {
            lines.push(`  ${sanitizeForTerminal(err.developerMessage)}`);
          }
          break;
        case 409:
          // The support-ticket comment flow sends the ticket state it read as a
          // collision stamp, so this is the expected answer when someone replied
          // while the user was deciding. Without this the promised protection
          // surfaces as a bare "API error: 409".
          lines.push(chalk.red('The resource changed since you last read it.'));
          lines.push('');
          lines.push('  Someone updated it in the meantime, so the change was not applied.');
          lines.push('  Re-read it and try again — for a support ticket:');
          lines.push('    bitmovin support tickets get <case-id>');
          if (err.developerMessage) {
            lines.push('');
            lines.push(`  ${sanitizeForTerminal(err.developerMessage)}`);
          }

          break;
        default:
          lines.push(chalk.red(`API error: ${err.httpStatusCode}`));
          // Sanitized: this is API-supplied text, and it is the one error path that
          // can carry content the caller does not control — `developerMessage` falls
          // back to the API's own message (which reflects submitted values) or to a
          // snippet of a non-envelope response body. Raw, an escape sequence in it
          // would repaint the lines already printed above.
          if (err.developerMessage) {
            lines.push(`  ${sanitizeForTerminal(err.developerMessage)}`);
          } else if (err.message) {
            lines.push(`  ${sanitizeForTerminal(err.message)}`);
          }
      }

      if (err.requestId) {
        lines.push('');
        lines.push(chalk.dim(`  Request ID: ${err.requestId}`));
      }

      // In JSON mode, output structured error
      if (this._jsonMode?.enabled) {
        process.stdout.write(JSON.stringify({
          error: true,
          httpStatusCode: err.httpStatusCode,
          message: err.developerMessage ?? err.message,
          ...(err.requestId && {requestId: err.requestId}),
        }, null, 2) + '\n');
      } else {
        process.stderr.write(lines.join('\n') + '\n');
      }

      this.exit(1);
      return;
    }

    // A transport failure carries no httpStatusCode, so without this the user gets a
    // bare `TypeError: fetch failed` and a stack trace. It matters most for a write:
    // a timeout after the request was sent leaves the outcome genuinely unknown, and
    // the message has to say so rather than implying a retry is safe.
    const transport = describeTransportFailure(err);
    if (transport) {
      if (this._jsonMode?.enabled) {
        process.stdout.write(JSON.stringify({error: true, message: transport.summary}, null, 2) + '\n');
      } else {
        process.stderr.write([chalk.red(transport.summary), '', ...transport.detail.map((line) => `  ${line}`)].join('\n') + '\n');
      }

      this.exit(1);
      return;
    }

    // Fall back to default error handling
    throw err;
  }

  protected async parseFlags(): Promise<Record<string, unknown>> {
    if (!this._parsedFlags) {
      const {flags} = await this.parse(this.ctor);
      this._parsedFlags = flags;
      const fieldsStr = flags.fields as string | undefined;
      const fields = fieldsStr ? fieldsStr.split(',').map((f: string) => f.trim()) : undefined;
      const enabled = Boolean(flags.json || flags.jq || fields);
      this._jsonMode = {enabled, fields};
    }

    return this._parsedFlags;
  }

  /**
   * The credential and organization scope for one invocation, derived from the
   * parsed flags in one place.
   *
   * Commands pass this straight to the REST helper instead of threading
   * `flags['api-key']` and the organization by hand — so a new credential-affecting
   * base flag (a `--profile`, say) is wired up here once rather than in every
   * command, and REST-backed commands cannot drift from SDK-backed ones.
   */
  protected async requestScope(): Promise<{apiKey?: string; tenantOrgId?: string}> {
    const flags = await this.parseFlags();
    // Remembered so {@link catch} can name the organization the request was actually
    // scoped to, whatever error type surfaced — see the 403 branch.
    this._scope ??= {
      apiKey: flags['api-key'] as string | undefined,
      tenantOrgId: resolveTenantOrgId(flags.organization as string | undefined, loadConfig().tenantOrgId),
    };
    return this._scope;
  }

  protected async getApi(): Promise<ApiClient> {
    if (!this._api) {
      const scope = await this.requestScope();
      this._api = await getClient(scope.apiKey, scope.tenantOrgId);
    }

    return this._api;
  }

  protected async isJsonMode(): Promise<boolean> {
    await this.parseFlags();
    return this._jsonMode!.enabled;
  }

  /** Whether to render rich tables (TTY or --format table) */
  private async useTable(): Promise<boolean> {
    const flags = await this.parseFlags();
    if (flags.format === 'table') return true;
    return isTTY();
  }

  private async writeJson(data: unknown): Promise<void> {
    const flags = await this.parseFlags();
    const fields = this._jsonMode!.fields;
    let json = formatJson(data, fields);

    if (flags.jq) {
      json = applyJq(json, flags.jq as string);
    }

    process.stdout.write(json + '\n');
  }

  /**
   * Output structured data. In --json mode writes JSON to stdout.
   * Otherwise renders a key-value table for objects, columnar table for arrays.
   */
  protected async outputData(data: unknown): Promise<void> {
    if (await this.isJsonMode()) {
      await this.writeJson(data);
      return;
    }

    const table = await this.useTable();

    if (Array.isArray(data)) {
      const keys = data.length > 0 ? Object.keys(data[0]) : [];
      process.stdout.write(formatTable(data as Record<string, unknown>[], keys, table) + '\n');
    } else {
      process.stdout.write(formatKeyValue(data as Record<string, unknown>, table) + '\n');
    }
  }

  /**
   * Output a list of items. In --json mode writes full objects as JSON.
   * In table mode, only shows the specified columns.
   */
  protected async outputList(items: Record<string, unknown>[], columns: string[]): Promise<void> {
    if (await this.isJsonMode()) {
      await this.writeJson(items);
      return;
    }

    const table = await this.useTable();
    process.stdout.write(formatTable(items, columns, table) + '\n');
  }
}

/**
 * DNS, connection and TLS failures, as undici reports them on `err.cause.code`.
 *
 * Matching the code rather than the message is deliberate: this classifier runs in
 * `catch` for *every* command, and a free-text test for "network" or "socket" also
 * swallowed genuine programming `TypeError`s whose message happened to contain those
 * words — reporting a real bug as "check your VPN" and dropping its stack.
 */
const TRANSPORT_CAUSE_CODES = new Set([
  'EAI_AGAIN',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'EPROTO',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

/**
 * Recognises a transport-level failure (no HTTP response, so no `httpStatusCode`)
 * and describes it in terms the user can act on.
 *
 * The timeout wording is deliberately non-committal about whether the request took
 * effect: `AbortSignal.timeout` fires after the request was sent, so for a create or
 * comment the ticket may well exist. Telling the user to "just retry" could file it
 * twice.
 */
function describeTransportFailure(err: Error): {summary: string; detail: string[]} | undefined {
  if (err.name === 'TimeoutError' || err.name === 'AbortError') {
    return {
      summary: 'The request to the Bitmovin API timed out.',
      detail: [
        'The request was sent but no response arrived in time, so whether it took effect is unknown.',
        'Check the current state before retrying — a write may already have been applied:',
        '  bitmovin support tickets list',
      ],
    };
  }

  // undici surfaces DNS/TLS/connection failures as `TypeError: fetch failed` with
  // the real reason on `cause`. Either signal on its own is enough: the wrapper is
  // exact and unambiguous, and a cause code from the set above identifies a
  // transport failure however it was wrapped.
  const cause = (err as {cause?: unknown}).cause;
  const causeCode = typeof cause === 'object' && cause !== null ? (cause as {code?: unknown}).code : undefined;
  const isTransport =
    (err instanceof TypeError && err.message === 'fetch failed') ||
    (typeof causeCode === 'string' && TRANSPORT_CAUSE_CODES.has(causeCode));

  if (isTransport) {
    return {
      summary: 'Could not reach the Bitmovin API.',
      detail: [
        'Check your network connection, VPN, and any proxy settings, then try again.',
        'Nothing was sent, so no change was made.',
      ],
    };
  }

  return undefined;
}
