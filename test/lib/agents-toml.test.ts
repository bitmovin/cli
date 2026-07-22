import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {ensureTomlBlock, hasTomlTable} from '../../src/lib/agents/toml-block.js';
import {buildCodexTomlBlock} from '../../src/lib/agents/mcp.js';

const TABLE = 'mcp_servers.bitmovin';

describe('hasTomlTable', () => {
  it('finds an existing table', () => {
    expect(hasTomlTable('[mcp_servers.bitmovin]\nurl = "https://mcp.bitmovin.com"\n', TABLE)).toBe(true);
  });

  it('does not false-positive on commented-out tables', () => {
    expect(hasTomlTable('# [mcp_servers.bitmovin]\n# url = "..."\nmodel = "gpt-5"\n', TABLE)).toBe(false);
  });

  it('ignores unrelated tables', () => {
    expect(hasTomlTable('[mcp_servers.other]\nurl = "https://other"\n', TABLE)).toBe(false);
  });
});

describe('ensureTomlBlock', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bitmovin-toml-'));
  });

  afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
  });

  it('creates the file when missing', () => {
    const file = join(dir, 'config.toml');
    const block = buildCodexTomlBlock('my-key');
    const result = ensureTomlBlock(file, TABLE, block);
    expect(result).toEqual({status: 'written', created: true});
    expect(readFileSync(file, 'utf-8')).toBe(block);
  });

  it('appends without re-serializing, preserving comments, and backs up', () => {
    const file = join(dir, 'config.toml');
    const existing = '# my precious comment\nmodel = "gpt-5"\n';
    writeFileSync(file, existing);

    const block = buildCodexTomlBlock('my-key');
    const result = ensureTomlBlock(file, TABLE, block);
    expect(result.status).toBe('written');
    expect(result.backupPath).toBe(`${file}.bak`);
    expect(readFileSync(`${file}.bak`, 'utf-8')).toBe(existing);

    const content = readFileSync(file, 'utf-8');
    expect(content).toContain('# my precious comment');
    expect(content).toContain('model = "gpt-5"');
    expect(content).toContain('[mcp_servers.bitmovin]');
    expect(content).toContain('http_headers = { "x-api-key" = "my-key" }');
    expect(hasTomlTable(content, TABLE)).toBe(true);
  });

  it('is a no-op when the table already exists', () => {
    const file = join(dir, 'config.toml');
    writeFileSync(file, '[mcp_servers.bitmovin]\nurl = "https://custom"\n');
    const result = ensureTomlBlock(file, TABLE, buildCodexTomlBlock('my-key'));
    expect(result).toEqual({status: 'unchanged', created: false});
    // Existing user configuration must not be overwritten
    expect(readFileSync(file, 'utf-8')).toContain('https://custom');
    expect(existsSync(`${file}.bak`)).toBe(false);
  });

  it('fails without touching a file that is not valid TOML', () => {
    const file = join(dir, 'config.toml');
    writeFileSync(file, '= broken =');
    expect(() => ensureTomlBlock(file, TABLE, buildCodexTomlBlock('k'))).toThrow(/not valid TOML/);
    expect(readFileSync(file, 'utf-8')).toBe('= broken =');
  });
});
