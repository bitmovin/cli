import {Args, Flags} from '@oclif/core';
import chalk from 'chalk';
import {BaseCommand} from '../../../lib/base-command.js';
import {getTicket, sanitizeForTerminal, type SupportTicketComment} from '../../../lib/support-tickets.js';

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
    const detail = await getTicket(args.id, await this.requestScope());

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
      requester: detail.requester?.name,
      organization: detail.organization?.name ?? detail.organization?.id,
      comments: detail.comments?.length ?? 0,
    });

    for (const comment of detail.comments ?? []) {
      process.stdout.write('\n' + renderComment(comment, Boolean(flags['show-secrets'])) + '\n');
    }
  }
}

function renderComment(comment: SupportTicketComment, showSecrets: boolean): string {
  // Author and body are sanitized: anyone who can land a public comment controls
  // this text, and raw escape sequences could otherwise forge the "(Bitmovin)"
  // attribution below or rewrite the rendered conversation.
  const author = sanitizeForTerminal(comment.author?.name ?? 'unknown');
  const role = comment.author?.agent ? ' (Bitmovin)' : '';
  const header = chalk.bold(`${author}${role}`) + chalk.dim(comment.createdAt ? ` — ${comment.createdAt}` : '');
  const lines = [header, sanitizeForTerminal(comment.body ?? '')];

  for (const attachment of comment.attachments ?? []) {
    // The attachment URL is a capability: the API documents it as downloadable by
    // anyone holding the link, so it is masked like any other secret unless asked
    // for, matching `account info`.
    const location = showSecrets ? (attachment.url ?? '') : chalk.dim('[url hidden — pass --show-secrets]');
    lines.push(chalk.dim(`  attachment: ${attachment.fileName ?? attachment.id} `) + location);
  }

  return lines.join('\n');
}
