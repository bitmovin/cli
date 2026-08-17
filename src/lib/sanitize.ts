/**
 * Terminal safety for text the CLI did not author.
 *
 * Its own module because it is not a support-ticket concern: API-supplied text
 * reaches the terminal from several places (ticket subjects and comment bodies,
 * organization names, the API's own error messages), and the sanitizer has to sit
 * where all of them can reach it — including `output.ts`, which is the boundary every
 * rendered table cell passes through.
 */

/**
 * Strips control and escape sequences before printing API-supplied text.
 *
 * Much of that text is attacker-influenceable: anyone who can land a public ticket
 * comment (the requester, a CC'd party) controls it, a sub-organization's owner
 * chooses its name, and an API error message can reflect submitted content. The API
 * sanitizes HTML but not C0/ANSI, so raw output would let that text rewrite what the
 * CLI already printed — forging the "(Bitmovin)" agent attribution a reader relies
 * on, or repainting a confirmation warning.
 */
export function sanitizeForTerminal(text: string): string {
  // CRLF is normalized first so a Windows-authored comment keeps its line breaks, and
  // every remaining carriage return is then stripped along with the other controls.
  // A lone \r returns the cursor to column 0, so "real text\r        misleading text"
  // overwrites what was already printed — the same rewriting this function exists to
  // prevent. Only tab and newline are kept.
  return text
    .replaceAll('\r\n', '\n')
    /* eslint-disable-next-line no-control-regex -- stripping control characters is the point */
    .replaceAll(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '');
}
