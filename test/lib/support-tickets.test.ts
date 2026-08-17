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

  it('accepts the spacing normalizeSort accepts, so a spaced sort is not spuriously rejected', () => {
    // The validator used to split without trimming while the normalizer trimmed, so
    // `--sort "createdAt:DESC, modifiedAt:ASC"` failed on ' modifiedAt:ASC' even
    // though the value that would have been sent was perfectly valid.
    expect(validateSort('createdAt:DESC, modifiedAt:ASC')).toBeUndefined();
    expect(validateSort(' createdAt:desc ')).toBeUndefined();
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

describe('CREATE_TICKET_FIELDS', () => {
  it('maps every flag to its API payload key', async () => {
    // The table is the single source of truth for the flags AND the payload keys, so
    // without this a key could be renamed (`subject` -> `title`) or an entry deleted
    // and nothing would notice: the field would simply stop reaching the API. The
    // assertion is exhaustive on purpose — a new field must be added here too.
    const {CREATE_TICKET_FIELDS, buildCreateTicketPayload} = await import('../../src/lib/support-tickets.js');

    const flags = Object.fromEntries(
      CREATE_TICKET_FIELDS.map((field) => [
        field.flag,
        'type' in field && field.type === 'boolean' ? true : 'values' in field ? Object.keys(field.values)[0] : `v-${field.flag}`,
      ]),
    );

    const payload = buildCreateTicketPayload({...flags, body: 'b', category: 'encoding'}, 'org-1');

    expect(payload).toEqual({
      body: 'b',
      category: 'encoding',
      organizationId: 'org-1',
      subject: 'v-subject',
      priority: 'v-priority',
      severity: 'v-severity',
      platform: 'v-platform',
      sdkVersion: 'v-sdk-version',
      encodingId: 'v-encoding-id',
      license: 'v-license',
      pageUrl: 'v-page-url',
      allowFileAccess: true,
      inputUrl: 'v-input-url',
      requestType: 'technical_question',
      referenceId: 'v-reference-id',
      reproducibleWithSampleApp: 'player_sample_app_yes',
      reproducibleReliably: 'reprod_yes',
      osDetails: 'v-os-details',
      deviceDetails: 'v-device-details',
      geoRestrictionCountry: 'v-geo-restriction-country',
    });
  });

  it('exposes an oclif flag for every field, with the documented choices', async () => {
    const {CREATE_TICKET_FIELDS, createTicketFlags} = await import('../../src/lib/support-tickets.js');
    const flags = createTicketFlags();

    expect(Object.keys(flags).sort()).toEqual(CREATE_TICKET_FIELDS.map((f) => f.flag).sort());
    // A value-mapped field must restrict its input, or an unmapped value reaches
    // buildCreateTicketPayload and becomes `undefined` in the payload.
    expect((flags['request-type'] as {options?: string[]}).options).toEqual(['technical-question', 'unexpected-behaviour', 'feature-suggestion', 'additional-assistance']);
    expect((flags['allow-file-access'] as {type?: string}).type).toBe('boolean');
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

describe('normalizeSort', () => {
  it('uppercases the direction so the API honours it', async () => {
    const {normalizeSort} = await import('../../src/lib/support-tickets.js');
    // validateSort accepts a lowercase direction case-insensitively, so sending it
    // raw would pass validation and then be silently ignored by the API.
    expect(normalizeSort('createdAt:desc')).toBe('createdAt:DESC');
    expect(normalizeSort('createdAt')).toBe('createdAt');
    expect(normalizeSort(' createdAt:asc , modifiedAt:desc ')).toBe('createdAt:ASC,modifiedAt:DESC');
  });
});

describe('latestComment', () => {
  it('picks the newest comment, which is the state the collision stamp matches', async () => {
    const {latestComment} = await import('../../src/lib/support-tickets.js');
    const ticket = {
      comments: [
        {id: 1, body: 'first', createdAt: '2026-08-01T10:00:00.000Z'},
        {id: 3, body: 'newest', createdAt: '2026-08-03T10:00:00.000Z'},
        {id: 2, body: 'middle', createdAt: '2026-08-02T10:00:00.000Z'},
      ],
    };

    expect(latestComment(ticket)?.id).toBe(3);
    expect(latestComment({comments: []})).toBeUndefined();
    expect(latestComment({})).toBeUndefined();
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

describe('redactAttachmentUrls', () => {
  it('replaces every attachment URL with the placeholder', async () => {
    const {redactAttachmentUrls, HIDDEN_ATTACHMENT_URL} = await import('../../src/lib/support-tickets.js');
    const detail = {
      caseId: 1,
      comments: [
        {id: 1, attachments: [{id: 7, fileName: 'crash.log', url: 'https://files.example.com/crash.log?token=SECRET'}]},
        {id: 2, body: 'no attachments'},
      ],
    };

    const redacted = redactAttachmentUrls(detail);

    expect(JSON.stringify(redacted)).not.toContain('token=SECRET');
    // Kept as a placeholder, not deleted: a JSON consumer can still see there is a
    // URL to ask for with --show-secrets.
    expect(redacted.comments?.[0].attachments?.[0]).toMatchObject({fileName: 'crash.log', url: HIDDEN_ATTACHMENT_URL});
    expect(redacted.comments?.[1]).toEqual({id: 2, body: 'no attachments'});
    // The caller keeps the original to print when --show-secrets is passed.
    expect(detail.comments[0].attachments[0].url).toContain('token=SECRET');
  });

  it('leaves an attachment without a URL untouched', async () => {
    const {redactAttachmentUrls} = await import('../../src/lib/support-tickets.js');
    const redacted = redactAttachmentUrls({comments: [{id: 1, attachments: [{id: 7, fileName: 'crash.log'}]}]});
    expect(redacted.comments?.[0].attachments?.[0]).toEqual({id: 7, fileName: 'crash.log'});
  });
});

describe('resolveBodyInput', () => {
  it('reads --body-file and applies the same bound as --body', async () => {
    // Shared by create and comment: while each command had its own copy, only create
    // bounded the file path, so a huge --body-file reached the comment confirmation.
    const {mkdtempSync, writeFileSync} = await import('node:fs');
    const {tmpdir} = await import('node:os');
    const {join} = await import('node:path');
    const {resolveBodyInput} = await import('../../src/lib/support-tickets.js');

    const dir = mkdtempSync(join(tmpdir(), 'bitmovin-cli-body-'));
    const file = join(dir, 'body.md');
    writeFileSync(file, 'from file');

    expect(resolveBodyInput({bodyFile: file, what: 'comment body', maxLength: 100})).toEqual({text: 'from file'});

    const tooLong = resolveBodyInput({bodyFile: file, what: 'comment body', maxLength: 3});
    expect('problem' in tooLong && tooLong.problem).toContain(`--body-file ${file} is 9 characters`);
  });

  it('names the missing input and the unreadable file', async () => {
    const {resolveBodyInput} = await import('../../src/lib/support-tickets.js');

    const missing = resolveBodyInput({what: 'ticket body', maxLength: 100});
    expect('problem' in missing && missing.problem).toContain('A ticket body is required');

    const unreadable = resolveBodyInput({bodyFile: '/nope/does-not-exist.md', what: 'ticket body', maxLength: 100});
    expect('problem' in unreadable && unreadable.problem).toContain('Could not read --body-file');
  });

  it('bounds --body too, so a shell-inlined log cannot scroll the confirmation away', async () => {
    const {resolveBodyInput} = await import('../../src/lib/support-tickets.js');
    const problem = resolveBodyInput({body: 'x'.repeat(20), what: 'ticket body', maxLength: 10});
    expect('problem' in problem && problem.problem).toContain('--body is 20 characters');
  });
});

describe('abbreviate', () => {
  it('reports how much it omitted rather than silently truncating', async () => {
    const {abbreviate} = await import('../../src/lib/support-tickets.js');
    expect(abbreviate('x'.repeat(50), 10, 5)).toContain('35 characters omitted');
    expect(abbreviate('short', 10, 5)).toBe('short');
  });

  it('keeps the head and the tail, nothing in between', async () => {
    const {abbreviate} = await import('../../src/lib/support-tickets.js');
    const text = 'H'.repeat(10) + 'M'.repeat(30) + 'T'.repeat(5);

    const result = abbreviate(text, 10, 5);
    expect(result.startsWith('H'.repeat(10))).toBe(true);
    expect(result.endsWith('T'.repeat(5))).toBe(true);
    expect(result).not.toContain('M');
  });

  it('is head-only with tailChars 0, and actually bounded', async () => {
    // slice(-0) is slice(0) — the whole string. The naive one-liner printed the
    // entire text while labelling it truncated, which is worse than not truncating
    // at all: the confirmation warning scrolls away AND the label lies.
    const {abbreviate} = await import('../../src/lib/support-tickets.js');
    const result = abbreviate('x'.repeat(5000), 300, 0);

    expect(result.length).toBeLessThan(400);
    expect(result).toContain('4700 characters omitted');
  });
});
