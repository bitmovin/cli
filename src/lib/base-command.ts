import {Command, Flags, Interfaces} from '@oclif/core';
import {getClient} from './client.js';
import {formatJson, formatTable, formatKeyValue} from './output.js';
import {applyJq} from './jq.js';

// Parse --json as: bare flag (all fields) or --json=id,name (field selection)
function parseJsonFlag(argv: string[]): {enabled: boolean; fields?: string[]} {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--json' || arg === '-j') {
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        return {enabled: true, fields: next.split(',').map((f) => f.trim())};
      }

      return {enabled: true};
    }

    if (arg.startsWith('--json=')) {
      return {enabled: true, fields: arg.slice(7).split(',').map((f) => f.trim())};
    }
  }

  return {enabled: false};
}

export abstract class BaseCommand extends Command {
  static baseFlags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output JSON to stdout. Use with --jq for filtering.',
      default: false,
    }),
    jq: Flags.string({
      description: 'Filter JSON output with a jq expression (implies --json)',
    }),
    'api-key': Flags.string({description: 'Override API key'}),
    quiet: Flags.boolean({char: 'q', description: 'Suppress non-essential output'}),
  };

  private _parsedFlags?: Record<string, unknown>;
  private _api?: any;
  private _jsonMode?: {enabled: boolean; fields?: string[]};

  // Redirect human messages to stderr so stdout stays clean for data
  override log(message?: string, ...args: any[]): void {
    this.logToStderr(message, ...args);
  }

  protected async parseFlags(): Promise<Record<string, unknown>> {
    if (!this._parsedFlags) {
      const {flags} = await this.parse(this.constructor as any);
      this._parsedFlags = flags;
      // Parse --json with optional fields from raw argv
      this._jsonMode = parseJsonFlag(this.argv);
      // --jq implies --json
      if (flags.jq && !this._jsonMode.enabled) {
        this._jsonMode = {enabled: true};
      }
    }

    return this._parsedFlags;
  }

  protected async getApi(): Promise<any> {
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

    if (Array.isArray(data)) {
      const keys = data.length > 0 ? Object.keys(data[0]) : [];
      process.stdout.write(formatTable(data as Record<string, unknown>[], keys) + '\n');
    } else {
      process.stdout.write(formatKeyValue(data as Record<string, unknown>) + '\n');
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

    process.stdout.write(formatTable(items, columns) + '\n');
  }
}
