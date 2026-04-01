import {Command, Flags} from '@oclif/core';
import chalk from 'chalk';
import {getClient, type ApiClient} from './client.js';
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

  private _parsedFlags?: Record<string, unknown>;
  private _api?: ApiClient;
  private _jsonMode?: {enabled: boolean; fields?: string[]};

  /**
   * Status/info messages. Goes to stderr in JSON mode so stdout stays clean.
   * Goes to stdout in interactive mode so users see it normally.
   */
  override log(message?: string, ...args: any[]): void {
    if (this._jsonMode?.enabled) {
      this.logToStderr(message, ...args);
    } else {
      // Default oclif behavior: stdout
      super.log(message, ...args);
    }
  }

  protected override async catch(err: Error & {httpStatusCode?: number; errorCode?: number; developerMessage?: string; requestId?: string}): Promise<void> {
    // Handle Bitmovin API errors
    if (err.httpStatusCode) {
      const config = loadConfig();
      const lines: string[] = [];

      switch (err.httpStatusCode) {
        case 401:
          lines.push(chalk.red('Authentication failed.'));
          lines.push('');
          lines.push('  Your API key is invalid or missing.');
          lines.push('  1. Get your API key from https://dashboard.bitmovin.com/account');
          lines.push('  2. Run: bitmovin config set api-key <your-api-key>');
          break;
        case 403:
          lines.push(chalk.red('Access denied.'));
          lines.push('');
          if (config.tenantOrgId) {
            lines.push(`  Active organization: ${config.tenantOrgId}`);
            lines.push('  This organization may not have access to this resource.');
            lines.push('');
            lines.push('  Try switching organizations:');
            lines.push('    bitmovin config list organizations');
            lines.push('    bitmovin config set organization <id>');
          } else {
            lines.push('  Your API key does not have permission for this resource.');
            lines.push('  You may need to select an organization:');
            lines.push('    bitmovin config list organizations');
            lines.push('    bitmovin config set organization <id>');
          }
          break;
        case 404:
          lines.push(chalk.red('Resource not found.'));
          if (err.developerMessage) {
            lines.push(`  ${err.developerMessage}`);
          }
          break;
        default:
          lines.push(chalk.red(`API error: ${err.httpStatusCode}`));
          if (err.developerMessage) {
            lines.push(`  ${err.developerMessage}`);
          } else if (err.message) {
            lines.push(`  ${err.message}`);
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

    // Fall back to default error handling
    throw err;
  }

  protected async parseFlags(): Promise<Record<string, unknown>> {
    if (!this._parsedFlags) {
      const {flags} = await this.parse(this.constructor as any);
      this._parsedFlags = flags;
      const fieldsStr = flags.fields as string | undefined;
      const fields = fieldsStr ? fieldsStr.split(',').map((f: string) => f.trim()) : undefined;
      const enabled = Boolean(flags.json || flags.jq || fields);
      this._jsonMode = {enabled, fields};
    }

    return this._parsedFlags;
  }

  protected async getApi(): Promise<ApiClient> {
    if (!this._api) {
      const flags = await this.parseFlags();
      this._api = getClient(flags['api-key'] as string | undefined);
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
