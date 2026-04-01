import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {formatJson, formatTable, formatKeyValue} from '../../src/lib/output.js';

describe('formatJson', () => {
  it('formats an object as JSON', () => {
    const result = formatJson({id: '123', name: 'test'});
    expect(JSON.parse(result)).toEqual({id: '123', name: 'test'});
  });

  it('formats an array as JSON', () => {
    const result = formatJson([{id: '1'}, {id: '2'}]);
    expect(JSON.parse(result)).toEqual([{id: '1'}, {id: '2'}]);
  });

  it('filters fields on an object', () => {
    const result = formatJson({id: '123', name: 'test', extra: 'drop'}, ['id', 'name']);
    expect(JSON.parse(result)).toEqual({id: '123', name: 'test'});
  });

  it('filters fields on an array', () => {
    const items = [{id: '1', name: 'a', extra: 'x'}, {id: '2', name: 'b', extra: 'y'}];
    const result = formatJson(items, ['id']);
    expect(JSON.parse(result)).toEqual([{id: '1'}, {id: '2'}]);
  });

  it('ignores missing fields', () => {
    const result = formatJson({id: '123'}, ['id', 'nonexistent']);
    expect(JSON.parse(result)).toEqual({id: '123'});
  });

  it('pretty-prints with 2-space indent', () => {
    const result = formatJson({a: 1});
    expect(result).toBe('{\n  "a": 1\n}');
  });
});

describe('formatTable', () => {
  const items = [
    {id: '1', name: 'Alpha', status: 'FINISHED'},
    {id: '2', name: 'Beta', status: 'ERROR'},
    {id: '3', name: 'Gamma', status: 'RUNNING'},
  ];

  it('returns "No results." for empty array when not using table', () => {
    expect(formatTable([], ['id'], false)).toBe('No results.');
  });

  it('outputs TSV when useTable=false', () => {
    const result = formatTable(items, ['id', 'name'], false);
    const lines = result.split('\n');
    expect(lines[0]).toBe('id\tname');
    expect(lines[1]).toBe('1\tAlpha');
    expect(lines[2]).toBe('2\tBeta');
    expect(lines[3]).toBe('3\tGamma');
  });

  it('only includes specified columns in TSV', () => {
    const result = formatTable(items, ['id'], false);
    const lines = result.split('\n');
    expect(lines[0]).toBe('id');
    expect(lines[1]).toBe('1');
  });

  it('renders a table with borders when useTable=true', () => {
    const result = formatTable(items, ['id', 'name'], true);
    expect(result).toContain('─');
    expect(result).toContain('Alpha');
    expect(result).toContain('Beta');
  });

  it('handles null/undefined values in TSV', () => {
    const result = formatTable([{id: '1', name: null}], ['id', 'name'], false);
    const lines = result.split('\n');
    expect(lines[1]).toBe('1\t');
  });
});

describe('formatKeyValue', () => {
  it('outputs key-value pairs as TSV when useTable=false', () => {
    const result = formatKeyValue({id: '123', name: 'test'}, false);
    expect(result).toContain('id\t123');
    expect(result).toContain('name\ttest');
  });

  it('renders a table when useTable=true', () => {
    const result = formatKeyValue({id: '123', name: 'test'}, true);
    expect(result).toContain('123');
    expect(result).toContain('test');
    expect(result).toContain('─');
  });

  it('skips null and undefined values', () => {
    const result = formatKeyValue({id: '123', gone: null, missing: undefined, name: 'test'}, false);
    expect(result).not.toContain('gone');
    expect(result).not.toContain('missing');
  });
});
