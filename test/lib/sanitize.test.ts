import {describe, it, expect} from 'vitest';

describe('sanitizeForTerminal', () => {
  it('strips escape sequences that could forge the agent attribution', async () => {
    const {sanitizeForTerminal} = await import('../../src/lib/sanitize.js');
    // ESC [ 2 K clears the line, letting a comment overwrite the header above it
    // and impersonate a Bitmovin agent reply.
    expect(sanitizeForTerminal('safe\u001B[2Kforged (Bitmovin)')).toBe('safe[2Kforged (Bitmovin)');
    expect(sanitizeForTerminal('a\u0000b\u007Fc')).toBe('abc');
  });

  it('keeps tabs and newlines so real comment text survives', async () => {
    const {sanitizeForTerminal} = await import('../../src/lib/sanitize.js');
    expect(sanitizeForTerminal('line1\nline2\tend')).toBe('line1\nline2\tend');
  });

  it('drops a lone carriage return, which would otherwise overwrite the printed line', async () => {
    const {sanitizeForTerminal} = await import('../../src/lib/sanitize.js');
    // \r returns the cursor to column 0, so the second half would overwrite the
    // first on screen — the same rewriting the escape stripping exists to prevent.
    expect(sanitizeForTerminal('real text\r        misleading text')).toBe('real text        misleading text');
  });

  it('keeps CRLF line breaks as newlines rather than eating them', async () => {
    const {sanitizeForTerminal} = await import('../../src/lib/sanitize.js');
    expect(sanitizeForTerminal('line1\r\nline2')).toBe('line1\nline2');
  });
});
