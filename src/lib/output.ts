import Table from 'cli-table3';
import chalk from 'chalk';

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

function colorizeStatus(status: string): string {
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

function formatCellRaw(value: unknown): string {
  if (value === null || value === undefined) return chalk.dim('-');
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatCellPlain(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function printStatus(status: string): string {
  if (!isTTY()) return status;
  return colorizeStatus(status);
}
