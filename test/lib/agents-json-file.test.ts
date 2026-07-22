import {existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {mergeJsonFile} from '../../src/lib/agents/json-file.js';

describe('mergeJsonFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bitmovin-agents-'));
  });

  afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
  });

  it('creates the file and parent directories with mode 0600', () => {
    const file = join(dir, 'nested', 'deep', 'mcp.json');
    const result = mergeJsonFile(file, ['mcpServers', 'bitmovin'], {url: 'https://mcp.bitmovin.com'});
    expect(result).toEqual({status: 'written', created: true, backupPath: undefined});
    expect(JSON.parse(readFileSync(file, 'utf-8'))).toEqual({mcpServers: {bitmovin: {url: 'https://mcp.bitmovin.com'}}});
    if (process.platform !== 'win32') {
      expect(statSync(file).mode & 0o777).toBe(0o600);
    }
  });

  it('preserves unrelated keys and creates a backup for pre-existing files', () => {
    const file = join(dir, 'settings.json');
    writeFileSync(file, JSON.stringify({theme: 'dark', mcpServers: {other: {url: 'https://other'}}}, null, 2));

    const result = mergeJsonFile(file, ['mcpServers', 'bitmovin'], {httpUrl: 'https://mcp.bitmovin.com'});
    expect(result.status).toBe('written');
    expect(result.created).toBe(false);
    expect(result.backupPath).toBe(`${file}.bak`);
    expect(existsSync(`${file}.bak`)).toBe(true);

    const data = JSON.parse(readFileSync(file, 'utf-8'));
    expect(data.theme).toBe('dark');
    expect(data.mcpServers.other).toEqual({url: 'https://other'});
    expect(data.mcpServers.bitmovin).toEqual({httpUrl: 'https://mcp.bitmovin.com'});
  });

  it('is a no-op when the value is already present', () => {
    const file = join(dir, 'mcp.json');
    mergeJsonFile(file, ['mcpServers', 'bitmovin'], {url: 'https://mcp.bitmovin.com', headers: {'x-api-key': 'k'}});
    const result = mergeJsonFile(file, ['mcpServers', 'bitmovin'], {url: 'https://mcp.bitmovin.com', headers: {'x-api-key': 'k'}});
    expect(result).toEqual({status: 'unchanged', created: false});
    expect(existsSync(`${file}.bak`)).toBe(false);
  });

  it('fails without touching a file that is not valid JSON', () => {
    const file = join(dir, 'broken.json');
    writeFileSync(file, '{not json');
    expect(() => mergeJsonFile(file, ['a'], 1)).toThrow(/not valid JSON/);
    expect(readFileSync(file, 'utf-8')).toBe('{not json');
    expect(existsSync(`${file}.bak`)).toBe(false);
  });

  it('fails on a file whose root is not an object', () => {
    const file = join(dir, 'array.json');
    writeFileSync(file, '[1, 2]');
    expect(() => mergeJsonFile(file, ['a'], 1)).toThrow(/JSON object/);
  });
});
