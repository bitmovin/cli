import {Args, Flags} from '@oclif/core';
import chalk from 'chalk';
import {BaseCommand} from '../../../lib/base-command.js';
import {
  type SupportTicketComment,
  getTicket,
  redactAttachmentUrls,
  sanitizeForTerminal,
} from '../../../lib/support-tickets.js';

export default class SupportTicketsGet extends BaseCommand {
  static override description = 'Show a support ticket including its public comment conversation';

  static override args = {
    id: Args.string({description: 'Ticket case ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    ...BaseCommand.tenantOrgFlag,
    'show-secrets': Flags.boolean({
      description: 'Show attachment download URLs, which grant access to the file to anyone holding the link',
      default: false,
    }),
  };

  static override examples = [
    'bitmovin support tickets get 123456',
    'bitmovin support tickets get 123456 --organization 8a7b6c5d-1234-5678-9abc-def012345678',
    'bitmovin support tickets get 123456 --json --jq ".comments[-1].body"',
  ];

  async run(): Promise<void> {
    const {args, flags} = await this.parse(SupportTicketsGet);
    const fetched = await getTicket(args.id, await this.requestScope());

    // Redacted once, before either output path: the attachment URL is a capability,
    // and masking it only while rendering the human view left `--json` (and the --jq
    // example) handing every download link to whatever reads the output.
    const detail = flags['show-secrets'] ? fetched : redactAttachmentUrls(fetched);

    if (await this.isJsonMode()) {
      await this.outputData(detail);
      return;
    }

    await this.outputData({
      caseId: detail.caseId,
      subject: sanitizeForTerminal(detail.subject ?? ''),
      status: detail.status,
      category: detail.category,
      priority: detail.priority,
      severity: detail.severity,
      createdAt: detail.createdAt,
      modifiedAt: detail.modifiedAt,
      requester: sanitizeForTerminal(detail.requester?.name ?? ''),
      organization: sanitizeForTerminal(detail.organization?.name ?? detail.organization?.id ?? ''),
      comments: detail.comments?.length ?? 0,
    });

    for (const comment of detail.comments ?? []) {
      process.stdout.write('\n' + renderComment(comment) + '\n');
    }
  }
}

function renderComment(comment: SupportTicketComment): string {
  // Author and body are sanitized: anyone who can land a public comment controls
  // this text, and raw escape sequences could otherwise forge the "(Bitmovin)"
  // attribution below or rewrite the rendered conversation.
  const author = sanitizeForTerminal(comment.author?.name ?? 'unknown');
  const role = comment.author?.agent ? ' (Bitmovin)' : '';
  const header = chalk.bold(`${author}${role}`) + chalk.dim(comment.createdAt ? ` — ${comment.createdAt}` : '');
  const lines = [header, sanitizeForTerminal(comment.body ?? '')];

  for (const attachment of comment.attachments ?? []) {
    // The URL is either the real one (--show-secrets) or the placeholder the
    // redaction left behind; the file name is chosen by whoever uploaded it, so it
    // is sanitized like the rest of the conversation.
    const name = sanitizeForTerminal(String(attachment.fileName ?? attachment.id ?? ''));
    lines.push(chalk.dim(`  attachment: ${name} `) + (attachment.url ?? ''));
  }

  return lines.join('\n');
}
