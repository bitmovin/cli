import {readFileSync} from 'node:fs';
import {Args, Flags} from '@oclif/core';
import chalk from 'chalk';
import {BaseCommand} from '../../../lib/base-command.js';
import {canPrompt, confirmAction} from '../../../lib/confirm.js';
import {organizationFlag, resolveTenantOrgId} from '../../../lib/organizations.js';
import {
  type SupportTicketComment,
  abbreviate,
  addComment,
  getTicket,
  latestComment,
  sanitizeForTerminal,
  toHtmlBody,
  validateCommentBody,
} from '../../../lib/support-tickets.js';

export default class SupportTicketsComment extends BaseCommand {
  static override description =
    'Add a public comment to a support ticket. Prints the comment and asks for confirmation first — Bitmovin support sees it immediately and it cannot be withdrawn via the API.';

  static override args = {
    id: Args.string({description: 'Ticket case ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    organization: organizationFlag,
    body: Flags.string({description: 'Comment text (plain text is escaped and line breaks preserved)', exclusive: ['body-file']}),
    'body-file': Flags.string({description: 'Read the comment from a file', exclusive: ['body']}),
    html: Flags.boolean({description: 'Treat the comment as HTML and send it as-is', default: false}),
    yes: Flags.boolean({
      char: 'y',
      aliases: ['confirm'],
      description: 'Skip the confirmation prompt (required for non-interactive use)',
      default: false,
    }),
  };

  static override examples = [
    'bitmovin support tickets comment 123456 --body "Still reproducible on 8.150.0."',
    'bitmovin support tickets comment 123456 --body-file ./update.md',
    'bitmovin support tickets comment 123456 --body "Fixed, thanks." --yes',
  ];

  async run(): Promise<void> {
    const {args, flags} = await this.parse(SupportTicketsComment);
    const context = {
      tenantOrgId: resolveTenantOrgId(flags.organization),
      apiKey: flags['api-key'] as string | undefined,
    };

    const htmlBody = toHtmlBody(this.resolveBody(flags.body, flags['body-file']), flags.html);
    const problem = validateCommentBody(htmlBody);
    if (problem) this.error(problem, {exit: 2});

    // The API requires updatedStamp (the ticket state the author wrote against) for
    // collision protection; without it, it answers with a misleading
    // "1004 … Check your JSON syntax". Read it from the ticket so the caller never
    // has to supply it.
    //
    // The stamp is deliberately taken from THIS read, before the confirmation, and
    // the newest comment is shown in the preview below. That way the stamp
    // corresponds to the state the user actually saw: if support replies while the
    // user is deciding, the API rejects the post with a 409 instead of silently
    // accepting a reply written against stale information.
    const ticket = await getTicket(args.id, context);
    if (!ticket.modifiedAt) {
      this.error(
        `Ticket ${args.id} did not report a modifiedAt timestamp, which the API requires for comment collision protection.\n` +
        '  Retry in a moment; if it persists, comment via the Bitmovin dashboard.',
        {exit: 1},
      );
    }

    const jsonMode = await this.isJsonMode();
    process.stderr.write(this.renderPreview(args.id, ticket.subject, ticket.status, htmlBody, latestComment(ticket)));

    if (!flags.yes) {
      if (jsonMode || !canPrompt()) {
        this.error(
          'Adding a ticket comment requires confirmation.\n' +
          '  Bitmovin support sees the comment immediately and it cannot be withdrawn via the API.\n' +
          '  Re-run interactively, or pass --yes to confirm non-interactively.',
          {exit: 2},
        );
      }

      const proceed = await confirmAction(`Post this comment to ticket ${args.id}?`);
      if (!proceed) {
        this.log('Aborted. No comment was posted.');
        return;
      }
    }

    const result = await addComment(args.id, {htmlBody, updatedStamp: ticket.modifiedAt}, context);
    this.log(`Comment added to ticket ${result.caseId ?? args.id}.`);
    await this.outputData(result);
  }

  private resolveBody(body?: string, bodyFile?: string): string {
    if (body !== undefined) return body;

    if (bodyFile === undefined) {
      this.error('A comment body is required. Pass --body "<text>" or --body-file <path>.', {exit: 2});
    }

    try {
      return readFileSync(bodyFile, 'utf-8');
    } catch (err) {
      this.error(`Could not read --body-file ${bodyFile}: ${err instanceof Error ? err.message : String(err)}`, {exit: 2});
    }
  }

  private renderPreview(
    caseId: string,
    subject?: string,
    status?: string,
    htmlBody?: string,
    newest?: SupportTicketComment,
  ): string {
    const lines = [
      '',
      chalk.yellow.bold('This posts a PUBLIC comment on a real support ticket.'),
      chalk.yellow('Bitmovin support sees it immediately and it cannot be withdrawn via the API.'),
      '',
      chalk.bold('Ticket:  ') + `${caseId}${subject ? ` — ${subject}` : ''}${status ? chalk.dim(` [${status}]`) : ''}`,
    ];

    // Shown so the user is replying to the state the collision stamp was taken
    // from, rather than to whatever they last read in a browser.
    if (newest) {
      lines.push(
        chalk.bold('Latest comment: ') +
          chalk.dim(
            `${sanitizeForTerminal(newest.author?.name ?? 'unknown')}${newest.author?.agent ? ' (Bitmovin)' : ''}` +
            ` — ${newest.createdAt ?? 'unknown time'}`,
          ),
        abbreviate(sanitizeForTerminal(newest.body ?? ''), 300, 0),
      );
    }

    lines.push(chalk.bold('Your comment:'), abbreviate(htmlBody ?? ''), '');
    return lines.join('\n');
  }
}
