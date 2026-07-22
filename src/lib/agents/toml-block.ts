import {appendFileSync, copyFileSync, existsSync, readFileSync, statSync} from 'node:fs';
import {parse as parseToml} from 'smol-toml';
import {writeFileAtomic, type MergeResult} from './json-file.js';

/**
 * Whether a TOML document already declares `table` (dotted path, e.g.
 * "mcp_servers.bitmovin"). Parses for real so commented-out blocks don't
 * false-positive. Throws when the document is not valid TOML.
 */
export function hasTomlTable(text: string, table: string): boolean {
  const doc = parseToml(text);
  let node: unknown = doc;
  for (const key of table.split('.')) {
    if (typeof node !== 'object' || node === null) return false;
    node = (node as Record<string, unknown>)[key];
  }

  return node !== undefined;
}

/**
 * Ensures `block` (a full `[table]` section) exists in the TOML file. When the
 * table is already present the file is left untouched. Otherwise the block is
 * appended as text — the file is never re-serialized, so user comments and
 * formatting survive. Pre-existing files are backed up to `<file>.bak`.
 */
export function ensureTomlBlock(file: string, table: string, block: string): MergeResult {
  const exists = existsSync(file);
  if (!exists) {
    writeFileAtomic(file, block, 0o600);
    return {status: 'written', created: true};
  }

  const text = readFileSync(file, 'utf-8');
  let present: boolean;
  try {
    present = hasTomlTable(text, table);
  } catch {
    throw new Error(`${file} is not valid TOML — fix it, then re-run`);
  }

  if (present) {
    return {status: 'unchanged', created: false};
  }

  const backupPath = `${file}.bak`;
  copyFileSync(file, backupPath);
  const mode = statSync(file).mode & 0o777;
  const separator = text.length === 0 || text.endsWith('\n\n') ? '' : (text.endsWith('\n') ? '\n' : '\n\n');
  appendFileSync(file, separator + block, {mode});
  return {status: 'written', created: false, backupPath};
}
