import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { getClient } from './client.js';
import { formatJson, formatTable, formatKeyValue, isTTY } from './output.js';
import { applyJq } from './jq.js';
import { loadConfig } from './config.js';
export class BaseCommand extends Command {
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
        'api-key': Flags.string({ description: 'Override API key' }),
        quiet: Flags.boolean({ char: 'q', description: 'Suppress non-essential output' }),
    };
    _parsedFlags;
    _api;
    _jsonMode;
    /**
     * Status/info messages. Goes to stderr in JSON mode so stdout stays clean.
     * Goes to stdout in interactive mode so users see it normally.
     */
    log(message, ...args) {
        if (this._jsonMode?.enabled) {
            this.logToStderr(message, ...args);
        }
        else {
            // Default oclif behavior: stdout
            super.log(message, ...args);
        }
    }
    async catch(err) {
        // Handle Bitmovin API errors
        if (err.httpStatusCode) {
            const config = loadConfig();
            const lines = [];
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
                    }
                    else {
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
                    }
                    else if (err.message) {
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
                    ...(err.requestId && { requestId: err.requestId }),
                }, null, 2) + '\n');
            }
            else {
                process.stderr.write(lines.join('\n') + '\n');
            }
            this.exit(1);
            return;
        }
        // Fall back to default error handling
        throw err;
    }
    async parseFlags() {
        if (!this._parsedFlags) {
            const { flags } = await this.parse(this.constructor);
            this._parsedFlags = flags;
            const fieldsStr = flags.fields;
            const fields = fieldsStr ? fieldsStr.split(',').map((f) => f.trim()) : undefined;
            const enabled = Boolean(flags.json || flags.jq || fields);
            this._jsonMode = { enabled, fields };
        }
        return this._parsedFlags;
    }
    async getApi() {
        if (!this._api) {
            const flags = await this.parseFlags();
            this._api = getClient(flags['api-key']);
        }
        return this._api;
    }
    async isJsonMode() {
        await this.parseFlags();
        return this._jsonMode.enabled;
    }
    /** Whether to render rich tables (TTY or --format table) */
    async useTable() {
        const flags = await this.parseFlags();
        if (flags.format === 'table')
            return true;
        return isTTY();
    }
    async writeJson(data) {
        const flags = await this.parseFlags();
        const fields = this._jsonMode.fields;
        let json = formatJson(data, fields);
        if (flags.jq) {
            json = applyJq(json, flags.jq);
        }
        process.stdout.write(json + '\n');
    }
    /**
     * Output structured data. In --json mode writes JSON to stdout.
     * Otherwise renders a key-value table for objects, columnar table for arrays.
     */
    async outputData(data) {
        if (await this.isJsonMode()) {
            await this.writeJson(data);
            return;
        }
        const table = await this.useTable();
        if (Array.isArray(data)) {
            const keys = data.length > 0 ? Object.keys(data[0]) : [];
            process.stdout.write(formatTable(data, keys, table) + '\n');
        }
        else {
            process.stdout.write(formatKeyValue(data, table) + '\n');
        }
    }
    /**
     * Output a list of items. In --json mode writes full objects as JSON.
     * In table mode, only shows the specified columns.
     */
    async outputList(items, columns) {
        if (await this.isJsonMode()) {
            await this.writeJson(items);
            return;
        }
        const table = await this.useTable();
        process.stdout.write(formatTable(items, columns, table) + '\n');
    }
}
//# sourceMappingURL=base-command.js.map