import {closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeSync} from 'node:fs';
import {dirname} from 'node:path';

export interface MergeResult {
  status: 'written' | 'unchanged';
  /** true when the file did not exist before */
  created: boolean;
  backupPath?: string;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/** Deep-sets value at path, creating intermediate objects; leaves everything else untouched. */
export function setAtPath(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let node = obj;
  for (const key of path.slice(0, -1)) {
    const next = node[key];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      node[key] = {};
    }

    node = node[key] as Record<string, unknown>;
  }

  node[path.at(-1)!] = value;
}

export function getAtPath(obj: Record<string, unknown>, path: string[]): unknown {
  let node: unknown = obj;
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }

  return node;
}

/**
 * Merges `value` into the JSON file at `jsonPath`, preserving all unrelated
 * keys. Missing file starts from {}. A pre-existing file is backed up to
 * `<file>.bak` before being modified. Writes are atomic (tmp + rename); new
 * files are created with mode 0600, existing files keep their mode.
 * Throws (without touching the file) when the existing content is not valid JSON.
 */
export function mergeJsonFile(file: string, jsonPath: string[], value: unknown): MergeResult {
  const exists = existsSync(file);
  let data: Record<string, unknown> = {};
  if (exists) {
    const raw = readFileSync(file, 'utf-8');
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`${file} is not valid JSON — fix or remove it, then re-run`);
    }

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error(`${file} does not contain a JSON object — fix or remove it, then re-run`);
    }
  }

  if (deepEqual(getAtPath(data, jsonPath), value)) {
    return {status: 'unchanged', created: false};
  }

  setAtPath(data, jsonPath, value);

  let backupPath: string | undefined;
  if (exists) {
    backupPath = `${file}.bak`;
    copyFileSync(file, backupPath);
  }

  const mode = exists ? statSync(file).mode & 0o777 : 0o600;
  writeFileAtomic(file, JSON.stringify(data, null, 2) + '\n', mode);
  return {status: 'written', created: !exists, backupPath};
}

/** Same atomic tmp+rename pattern as lib/config.ts saveConfig. */
export function writeFileAtomic(file: string, content: string, mode: number): void {
  mkdirSync(dirname(file), {recursive: true});
  const tmpPath = `${file}.tmp.${process.pid}`;
  const fd = openSync(tmpPath, 'w', mode);
  try {
    writeSync(fd, content);
  } finally {
    closeSync(fd);
  }

  try {
    renameSync(tmpPath, file);
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // best-effort cleanup
    }

    throw err;
  }
}
