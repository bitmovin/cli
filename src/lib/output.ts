import Table from 'cli-table3';
import chalk from 'chalk';
import {sanitizeForTerminal} from './sanitize.js';

export function isTTY(): boolean {
  return Boolean(process.stdout.isTTY);
}

export function formatJson(data: unknown, fields?: string[]): string {
  if (fields && fields.length > 0) {
    if (Array.isArray(data)) {
      return JSON.stringify(data.map((item) => pickFields(item, fields)), null, 2);
    }

    return JSON.stringify(pickFields(data as Record<string, unknown>, fields), null, 2);
  }

  return JSON.stringify(data, null, 2);
}

function pickFields(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in obj) result[field] = obj[field];
  }

  return result;
}

export function formatTable(items: Record<string, unknown>[], columns: string[], useTable: boolean): string {
  if (items.length === 0) return useTable ? chalk.dim('No results.') : 'No results.';

  const summarized = items.map((item) => {
    const result: Record<string, unknown> = {};
    for (const col of columns) result[col] = item[col];
    return result;
  });

  if (!useTable) {
    const header = columns.join('\t');
    const rows = summarized.map((item) => columns.map((c) => formatCellPlain(item[c])).join('\t'));
    return [header, ...rows].join('\n');
  }

  const table = new Table({
    head: columns.map((k) => chalk.bold(k)),
    style: {head: [], border: []},
  });

  for (const item of summarized) {
    table.push(columns.map((k) => colorizeCell(k, item[k])));
  }

  return table.toString();
}

export function formatKeyValue(obj: Record<string, unknown>, useTable: boolean): string {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null);

  if (!useTable) {
    return entries.map(([k, v]) => `${k}\t${formatCellPlain(v)}`).join('\n');
  }

  const table = new Table({style: {head: [], border: []}});
  for (const [key, value] of entries) {
    table.push({[chalk.bold(key)]: colorizeCell(key, value)});
  }

  return table.toString();
}

// Colorize known values during table rendering
function colorizeCell(column: string, value: unknown): string {
  const str = formatCellRaw(value);
  if (column === 'status') return colorizeStatus(str);
  return str;
}

export function colorizeStatus(status: string): string {
  switch (status?.toUpperCase()) {
    case 'FINISHED':
      return chalk.green(status);
    case 'ERROR':
    case 'TRANSFER_ERROR':
      return chalk.red(status);
    case 'RUNNING':
      return chalk.blue(status);
    case 'QUEUED':
    case 'CREATED':
      return chalk.yellow(status);
    default:
      return status;
  }
}

/**
 * Every human-readable cell goes through here, which makes it the boundary where
 * API-supplied text crosses into the terminal — so this is where escape sequences are
 * stripped, rather than at each individual print site.
 *
 * Wrapping fields by hand at the call site left anything new (an organization name, a
 * field of a REST endpoint added later) unsafe until someone remembered to do it, with
 * nothing forcing the choice. Sanitizing here makes rendering safe by default;
 * commands that build their own strings outside the table still wrap explicitly.
 *
 * The CLI's own decoration is unaffected: `colorizeCell` applies chalk to the string
 * *returned* from here, and `JSON.stringify` already escapes control characters in a
 * nested object, so only plain scalars need the pass.
 */
function formatCellRaw(value: unknown): string {
  if (value === null || value === undefined) return chalk.dim('-');
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return sanitizeForTerminal(String(value));
}

function formatCellPlain(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return sanitizeForTerminal(String(value));
}

export function printStatus(status: string): string {
  if (!isTTY()) return status;
  return colorizeStatus(status);
}
