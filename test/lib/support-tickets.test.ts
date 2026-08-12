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
