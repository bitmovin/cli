import {Args} from '@oclif/core';
import chalk from 'chalk';
import {BaseCommand} from '../../../lib/base-command.js';
import {organizationFlag, resolveTenantOrgId} from '../../../lib/organizations.js';
import {getTicket, type SupportTicketComment} from '../../../lib/support-tickets.js';

export default class SupportTicketsGet extends BaseCommand {
  static override description = 'Show a support ticket including its public comment conversation';

  static override args = {
    id: Args.string({description: 'Ticket case ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    organization: organizationFlag,
  };

  static override examples = [
    'bitmovin support tickets get 123456',
    'bitmovin support tickets get 123456 --organization 8a7b6c5d-1234-5678-9abc-def012345678',
    'bitmovin support tickets get 123456 --json --jq ".comments[-1].body"',
  ];

  async run(): Promise<void> {
    const {args, flags} = await this.parse(SupportTicketsGet);
    const detail = await getTicket(args.id, {
      tenantOrgId: resolveTenantOrgId(flags.organization),
      apiKey: flags['api-key'] as string | undefined,
    });

    if (await this.isJsonMode()) {
      await this.outputData(detail);
      return;
    }

    await this.outputData({
      caseId: detail.caseId,
      subject: detail.subject,
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
      process.stdout.write('\n' + renderComment(comment) + '\n');
    }
  }
}

function renderComment(comment: SupportTicketComment): string {
  const author = comment.author?.name ?? 'unknown';
  const role = comment.author?.agent ? ' (Bitmovin)' : '';
  const header = chalk.bold(`${author}${role}`) + chalk.dim(comment.createdAt ? ` — ${comment.createdAt}` : '');
  const lines = [header, comment.body ?? ''];

  for (const attachment of comment.attachments ?? []) {
    lines.push(chalk.dim(`  attachment: ${attachment.fileName ?? attachment.id} ${attachment.url ?? ''}`.trimEnd()));
  }

  return lines.join('\n');
}
