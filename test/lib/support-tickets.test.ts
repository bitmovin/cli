import {describe, it, expect} from 'vitest';
import {
  MAX_COMMENT_LENGTH,
  buildCreateTicketPayload,
  toHtmlBody,
  validateCommentBody,
  validateCreateTicketPayload,
  validateEnumFilter,
  validatePagination,
  validateSearchText,
  validateSort,
  TICKET_STATUSES,
  type CreateTicketFlags,
} from '../../src/lib/support-tickets.js';

describe('validatePagination', () => {
  it('accepts an offset on a page boundary', () => {
    expect(validatePagination(25, 0)).toBeUndefined();
    expect(validatePagination(25, 50)).toBeUndefined();
  });

  it('rejects an offset that is not a multiple of the limit', () => {
    const problem = validatePagination(25, 30);
    expect(problem).toContain('must be 0 or a multiple of --limit');
    expect(problem).toContain('--offset 25');
  });

  it('rejects out-of-range limits and negative offsets', () => {
    expect(validatePagination(0, 0)).toContain('--limit');
    expect(validatePagination(101, 0)).toContain('--limit');
    expect(validatePagination(25, -1)).toContain('--offset');
  });
});

describe('validateSearchText', () => {
  it('accepts letters, digits and spaces', () => {
    expect(validateSearchText('encoding fails 42')).toBeUndefined();
  });

  it('rejects punctuation and overlong input', () => {
    expect(validateSearchText('encoding-fails')).toContain('letters, digits, and spaces');
    expect(validateSearchText('a'.repeat(101))).toContain('100 characters');
  });
});

describe('validateSort', () => {
  it('accepts documented fields and directions', () => {
    expect(validateSort('createdAt:DESC')).toBeUndefined();
    expect(validateSort('modifiedAt')).toBeUndefined();
    expect(validateSort('createdAt:ASC,modifiedAt:DESC')).toBeUndefined();
  });

  it('rejects unknown fields and directions', () => {
    expect(validateSort('subject:ASC')).toContain('--sort must be');
    expect(validateSort('createdAt:SIDEWAYS')).toContain('ASC or DESC');
  });
});

describe('validateEnumFilter', () => {
  it('accepts comma-separated values case-insensitively', () => {
    expect(validateEnumFilter('--status', 'open,PENDING', TICKET_STATUSES)).toBeUndefined();
  });

  it('names the offending values', () => {
    const problem = validateEnumFilter('--status', 'open,exploded', TICKET_STATUSES);
    expect(problem).toContain("'exploded'");
    expect(problem).not.toContain("'open'");
  });
});

describe('buildCreateTicketPayload', () => {
  const base = {body: 'It broke.', category: 'encoding'} as CreateTicketFlags;

  it('keeps organizationId in sync with the targeted organization', () => {
    expect(buildCreateTicketPayload(base, 'org-7').organizationId).toBe('org-7');
  });

  it('omits organizationId when no organization is targeted', () => {
    expect(buildCreateTicketPayload(base)).toEqual({body: 'It broke.', category: 'encoding'});
  });

  it('maps friendly flag values onto the API field values', () => {
    const payload = buildCreateTicketPayload(
      {
        ...base,
        'request-type': 'unexpected-behaviour',
        'reproducible-with-sample-app': 'didnt-try',
        'reproducible-reliably': 'sometimes',
        'sdk-version': '1.2.3',
        'allow-file-access': true,
      },
      undefined,
    );

    expect(payload).toMatchObject({
      requestType: 'unexpected_behaviour',
      reproducibleWithSampleApp: 'player_sample_app_didnt_try',
      reproducibleReliably: 'reprod_sometimes',
      sdkVersion: '1.2.3',
      allowFileAccess: true,
    });
  });
});

describe('validateCreateTicketPayload', () => {
  it('accepts a minimal payload', () => {
    expect(validateCreateTicketPayload({body: 'x', category: 'other'})).toBeUndefined();
  });

  it('rejects an empty body', () => {
    expect(validateCreateTicketPayload({body: '   ', category: 'other'})).toContain('must not be empty');
  });

  it('enforces the category gating of encodingId, license and pageUrl', () => {
    expect(validateCreateTicketPayload({body: 'x', category: 'player', encodingId: 'e-1'})).toContain('--encoding-id requires');
    expect(validateCreateTicketPayload({body: 'x', category: 'encoding', license: 'l-1'})).toContain('--license requires');
    expect(validateCreateTicketPayload({body: 'x', category: 'encoding', pageUrl: 'https://x'})).toContain('--page-url requires');
    expect(validateCreateTicketPayload({body: 'x', category: 'analytics', license: 'l-1', pageUrl: 'https://x'})).toBeUndefined();
    expect(validateCreateTicketPayload({body: 'x', category: 'encoding', encodingId: 'e-1'})).toBeUndefined();
  });
});

describe('toHtmlBody', () => {
  it('escapes plain text and keeps line breaks', () => {
    expect(toHtmlBody('a < b & c\nsecond line', false)).toBe('a &lt; b &amp; c<br>\nsecond line');
  });

  it('passes HTML through untouched when asked to', () => {
    expect(toHtmlBody('<p>hi</p>', true)).toBe('<p>hi</p>');
  });
});

describe('validateCommentBody', () => {
  it('rejects blank and oversized bodies', () => {
    expect(validateCommentBody('  ')).toContain('must not be empty');
    expect(validateCommentBody('a'.repeat(MAX_COMMENT_LENGTH + 1))).toContain('65536');
    expect(validateCommentBody('ok')).toBeUndefined();
  });
});

describe('validatePagination offset guidance', () => {
  it('rejects an offset below the limit — the case the server floors back to page 1', async () => {
    const {validatePagination} = await import('../../src/lib/support-tickets.js');
    expect(validatePagination(25, 10)).toContain('multiple of --limit');
  });

  it('suggests the page containing the requested item, never a later one', async () => {
    const {validatePagination} = await import('../../src/lib/support-tickets.js');
    // Item 41 lives on the page starting at offset 25; suggesting 50 would skip 26-50.
    expect(validatePagination(25, 40)).toContain('--offset 25');
    expect(validatePagination(25, 10)).toContain('--offset 0');
  });
});

describe('normalizeEnumFilter', () => {
  it('strips the spaces the API does not tolerate', async () => {
    const {normalizeEnumFilter} = await import('../../src/lib/support-tickets.js');
    // The API splits on ',' and uppercases without trimming, so ' pending' is invalid
    // there even though validation accepts it here.
    expect(normalizeEnumFilter('open, pending')).toBe('open,pending');
    expect(normalizeEnumFilter(' solved ')).toBe('solved');
  });
});

describe('category gating for --allow-file-access', () => {
  it('rejects it outside --category encoding, because the API silently drops it', async () => {
    const {validateCreateTicketPayload} = await import('../../src/lib/support-tickets.js');
    expect(validateCreateTicketPayload({body: 'x', category: 'player', allowFileAccess: true})).toContain(
      '--allow-file-access requires',
    );
    expect(validateCreateTicketPayload({body: 'x', category: 'encoding', allowFileAccess: true})).toBeUndefined();
  });
});

describe('sanitizeForTerminal', () => {
  it('strips escape sequences that could forge the agent attribution', async () => {
    const {sanitizeForTerminal} = await import('../../src/lib/support-tickets.js');
    // ESC [ 2 K clears the line, letting a comment overwrite the header above it
    // and impersonate a Bitmovin agent reply.
    expect(sanitizeForTerminal('safe\u001B[2Kforged (Bitmovin)')).toBe('safe[2Kforged (Bitmovin)');
    expect(sanitizeForTerminal('a\u0000b\u007Fc')).toBe('abc');
  });

  it('keeps tabs and newlines so real comment text survives', async () => {
    const {sanitizeForTerminal} = await import('../../src/lib/support-tickets.js');
    expect(sanitizeForTerminal('line1\nline2\tend')).toBe('line1\nline2\tend');
  });
});

describe('abbreviate', () => {
  it('reports how much it omitted rather than silently truncating', async () => {
    const {abbreviate} = await import('../../src/lib/support-tickets.js');
    expect(abbreviate('x'.repeat(50), 10, 5)).toContain('35 characters omitted');
    expect(abbreviate('short', 10, 5)).toBe('short');
  });
});
