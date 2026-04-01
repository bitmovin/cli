import {describe, it, expect} from 'vitest';
import {applyJq} from '../../src/lib/jq.js';

describe('applyJq', () => {
  it('extracts a field from an object', () => {
    const result = applyJq('{"name": "test", "id": 1}', '.name');
    expect(result).toBe('"test"');
  });

  it('extracts fields from an array', () => {
    const json = JSON.stringify([{id: 1}, {id: 2}, {id: 3}]);
    const result = applyJq(json, '.[].id');
    expect(result).toBe('1\n2\n3');
  });

  it('filters array elements', () => {
    const json = JSON.stringify([{status: 'FINISHED'}, {status: 'ERROR'}, {status: 'FINISHED'}]);
    const result = applyJq(json, '[.[] | select(.status == "ERROR")]');
    expect(JSON.parse(result)).toEqual([{status: 'ERROR'}]);
  });

  it('picks specific fields', () => {
    const json = JSON.stringify([{id: 1, name: 'a', extra: 'x'}]);
    const result = applyJq(json, '[.[] | {id, name}]');
    expect(JSON.parse(result)).toEqual([{id: 1, name: 'a'}]);
  });

  it('throws on invalid jq expression', () => {
    expect(() => applyJq('{}', '.[[invalid')).toThrow('jq error');
  });
});
