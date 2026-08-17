import {Flags} from '@oclif/core';
import chalk from 'chalk';
import {BaseCommand} from '../../../lib/base-command.js';
import {confirmDestructive, yesFlag} from '../../../lib/confirm.js';
import {sanitizeForTerminal} from '../../../lib/sanitize.js';
import {
  MAX_BODY_LENGTH,
  TICKET_CATEGORIES,
  abbreviate,
  buildCreateTicketPayload,
  createTicket,
  createTicketFlags,
  resolveBodyInput,
  validateCreateTicketPayload,
} from '../../../lib/support-tickets.js';

export default class SupportTicketsCreate extends BaseCommand {
  static override description =
    'File a support ticket with Bitmovin support. Prints the payload and asks for confirmation first — the ticket is real and cannot be withdrawn via the API.';

  static override flags = {
    ...BaseCommand.baseFlags,
    ...BaseCommand.tenantOrgFlag,
    body: Flags.string({description: 'Ticket body (what happened, what you expected)', exclusive: ['body-file']}),
    'body-file': Flags.string({description: 'Read the ticket body from a file ("-" is not supported)', exclusive: ['body']}),
    category: Flags.string({description: 'Product the ticket is about', options: [...TICKET_CATEGORIES], required: true}),
    // The remaining fields come from CREATE_TICKET_FIELDS, so the flags, their
    // accepted values, and the payload keys cannot drift apart.
    ...createTicketFlags(),
    yes: yesFlag,
  };

  static override examples = [
    'bitmovin support tickets create --category encoding --subject "Encoding fails" --body "Encoding abc fails at 40%."',
    'bitmovin support tickets create --category player --body-file ./report.md --license LICENSE_KEY --page-url https://example.com',
    'bitmovin support tickets create --category other --body "..." --organization SUB_ORG_ID --yes',
  ];

  async run(): Promise<void> {
    const {flags} = await this.parse(SupportTicketsCreate);
    const scope = await this.requestScope();

    const resolved = resolveBodyInput({
      body: flags.body,
      bodyFile: flags['body-file'],
      what: 'ticket body',
      maxLength: MAX_BODY_LENGTH,
    });
    if ('problem' in resolved) this.error(resolved.problem, {exit: 2});

    const payload = buildCreateTicketPayload({...flags, body: resolved.text}, scope.tenantOrgId);

    const problem = validateCreateTicketPayload(payload);
    if (problem) this.error(problem, {exit: 2});

    // Always previewed, and always to stderr: it is a warning, not command output.
    // Writing it in JSON mode too means a scripted `--json --yes` create still
    // leaves a record of what was filed and against which organization, without
    // polluting the JSON on stdout.
    const jsonMode = await this.isJsonMode();
    process.stderr.write(this.renderPreview(payload, scope.tenantOrgId, jsonMode));

    const outcome = await confirmDestructive({jsonMode, yes: flags.yes, question: 'File this support ticket with Bitmovin support?'});
    if (outcome === 'unconfirmable') {
      this.error(
        'Creating a support ticket requires confirmation.\n' +
        '  This files a real ticket that Bitmovin support engineers see and that cannot be withdrawn via the API.\n' +
        '  Re-run interactively, or pass --yes to confirm non-interactively.',
        {exit: 2},
      );
    }

    if (outcome === 'declined') {
      this.log('Aborted. No ticket was created.');
      return;
    }

    const result = await createTicket(payload, scope);
    this.log(`Support ticket created: ${result.id ?? '(no id returned)'}`);
    await this.outputData(result);
  }

  private renderPreview(payload: Record<string, unknown>, tenantOrgId?: string, jsonMode = false): string {
    // The body is shown head-and-tail so the warning and the organization stay on
    // screen for a long --body-file, while still showing what is actually sent.
    const {body, ...rest} = payload as {body?: string} & Record<string, unknown>;
    const lines = [
      '',
      chalk.yellow.bold('This files a REAL support ticket with Bitmovin support.'),
      chalk.yellow('Support engineers will see it, and it cannot be withdrawn via the API.'),
      '',
      chalk.bold('Organization: ') + (tenantOrgId ?? chalk.dim('(the organization of your credentials)')),
      chalk.bold('Fields:'),
      JSON.stringify(rest, null, 2),
      chalk.bold(`Body (${body?.length ?? 0} characters):`),
      // Sanitized even though it is the user's own input: a --body-file they did not
      // author (a pasted terminal log, an agent-generated report) can carry escape
      // sequences, and this text is printed directly above the irreversible-action
      // warning and the y/N prompt it could repaint.
      sanitizeForTerminal(abbreviate(body ?? '')),
      '',
    ];
    if (jsonMode) lines.push(chalk.dim('(payload echoed to stderr; ticket result follows on stdout)'), '');
    return lines.join('\n');
  }
}
