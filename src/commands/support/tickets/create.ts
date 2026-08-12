import {readFileSync} from 'node:fs';
import {Flags} from '@oclif/core';
import chalk from 'chalk';
import {BaseCommand} from '../../../lib/base-command.js';
import {canPrompt, confirmAction} from '../../../lib/confirm.js';
import {organizationFlag, resolveTenantOrgId} from '../../../lib/organizations.js';
import {
  REPRODUCIBLE_RELIABLY,
  REPRODUCIBLE_WITH_SAMPLE_APP,
  REQUEST_TYPES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  MAX_BODY_LENGTH,
  TICKET_SEVERITIES,
  abbreviate,
  buildCreateTicketPayload,
  createTicket,
  validateCreateTicketPayload,
  type CreateTicketFlags,
} from '../../../lib/support-tickets.js';

export default class SupportTicketsCreate extends BaseCommand {
  static override description =
    'File a support ticket with Bitmovin support. Prints the payload and asks for confirmation first — the ticket is real and cannot be withdrawn via the API.';

  static override flags = {
    ...BaseCommand.baseFlags,
    organization: organizationFlag,
    body: Flags.string({description: 'Ticket body (what happened, what you expected)', exclusive: ['body-file']}),
    'body-file': Flags.string({description: 'Read the ticket body from a file ("-" is not supported)', exclusive: ['body']}),
    category: Flags.string({description: 'Product the ticket is about', options: [...TICKET_CATEGORIES], required: true}),
    subject: Flags.string({description: 'Ticket subject'}),
    priority: Flags.string({description: 'Ticket priority', options: [...TICKET_PRIORITIES]}),
    severity: Flags.string({description: 'Ticket severity', options: [...TICKET_SEVERITIES]}),
    platform: Flags.string({description: 'Affected platform (e.g. web, android, ios, roku)'}),
    'sdk-version': Flags.string({description: 'SDK / player version in use'}),
    'encoding-id': Flags.string({description: 'Affected encoding ID (requires --category encoding)'}),
    license: Flags.string({description: 'Affected license key (requires --category player or analytics)'}),
    'page-url': Flags.string({description: 'URL where the issue reproduces (requires --category player or analytics)'}),
    'allow-file-access': Flags.boolean({description: 'Allow Bitmovin support to access the referenced files'}),
    'input-url': Flags.string({description: 'Input / stream URL involved'}),
    'request-type': Flags.string({description: 'Kind of request', options: Object.keys(REQUEST_TYPES)}),
    'reference-id': Flags.string({description: 'Your own reference (e.g. internal ticket id)'}),
    'reproducible-with-sample-app': Flags.string({
      description: 'Whether the issue reproduces in the Bitmovin sample app',
      options: Object.keys(REPRODUCIBLE_WITH_SAMPLE_APP),
    }),
    'reproducible-reliably': Flags.string({
      description: 'Whether the issue reproduces reliably',
      options: Object.keys(REPRODUCIBLE_RELIABLY),
    }),
    'os-details': Flags.string({description: 'Operating system details'}),
    'device-details': Flags.string({description: 'Device details'}),
    'geo-restriction-country': Flags.string({description: 'Country the issue is restricted to'}),
    yes: Flags.boolean({
      char: 'y',
      aliases: ['confirm'],
      description: 'Skip the confirmation prompt (required for non-interactive use)',
      default: false,
    }),
  };

  static override examples = [
    'bitmovin support tickets create --category encoding --subject "Encoding fails" --body "Encoding abc fails at 40%."',
    'bitmovin support tickets create --category player --body-file ./report.md --license LICENSE_KEY --page-url https://example.com',
    'bitmovin support tickets create --category other --body "..." --organization SUB_ORG_ID --yes',
  ];

  async run(): Promise<void> {
    const {flags} = await this.parse(SupportTicketsCreate);

    const body = this.resolveBody(flags.body, flags['body-file']);
    const tenantOrgId = resolveTenantOrgId(flags.organization);
    const payload = buildCreateTicketPayload({...flags, body} as CreateTicketFlags, tenantOrgId);

    const problem = validateCreateTicketPayload(payload);
    if (problem) this.error(problem, {exit: 2});

    // Always previewed, and always to stderr: it is a warning, not command output.
    // Writing it in JSON mode too means a scripted `--json --yes` create still
    // leaves a record of what was filed and against which organization, without
    // polluting the JSON on stdout.
    const jsonMode = await this.isJsonMode();
    process.stderr.write(this.renderPreview(payload, tenantOrgId, jsonMode));

    if (!flags.yes) {
      if (jsonMode || !canPrompt()) {
        this.error(
          'Creating a support ticket requires confirmation.\n' +
          '  This files a real ticket that Bitmovin support engineers see and that cannot be withdrawn via the API.\n' +
          '  Re-run interactively, or pass --yes to confirm non-interactively.',
          {exit: 2},
        );
      }

      const proceed = await confirmAction('File this support ticket with Bitmovin support?');
      if (!proceed) {
        this.log('Aborted. No ticket was created.');
        return;
      }
    }

    const result = await createTicket(payload, {tenantOrgId, apiKey: flags['api-key'] as string | undefined});
    this.log(`Support ticket created: ${result.id ?? '(no id returned)'}`);
    await this.outputData(result);
  }

  private resolveBody(body?: string, bodyFile?: string): string {
    if (body !== undefined) return body;

    if (bodyFile === undefined) {
      this.error('A ticket body is required. Pass --body "<text>" or --body-file <path>.', {exit: 2});
    }

    let contents: string;
    try {
      contents = readFileSync(bodyFile, 'utf-8');
    } catch (err) {
      this.error(`Could not read --body-file ${bodyFile}: ${err instanceof Error ? err.message : String(err)}`, {exit: 2});
    }

    // Bounded because the whole file is transmitted into a ticket that cannot be
    // withdrawn via the API, and because an enormous body scrolls the warning
    // above off screen — degrading the confirmation exactly when it matters most.
    if (contents.length > MAX_BODY_LENGTH) {
      this.error(
        `--body-file ${bodyFile} is ${contents.length} characters; the maximum is ${MAX_BODY_LENGTH}.\n` +
        '  Attach large files to the ticket in the dashboard instead of inlining them.',
        {exit: 2},
      );
    }

    return contents;
  }

  private renderPreview(payload: Record<string, unknown>, tenantOrgId?: string, jsonMode = false): string {
    // The body is shown head-and-tail so the warning and the organization stay on
    // screen for a long --body-file, while still showing what is actually sent.
    const {body, ...rest} = payload as {body?: string} & Record<string, unknown>;
    const shown = JSON.stringify(rest, null, 2);
    const lines = [
      '',
      chalk.yellow.bold('This files a REAL support ticket with Bitmovin support.'),
      chalk.yellow('Support engineers will see it, and it cannot be withdrawn via the API.'),
      '',
      chalk.bold('Organization: ') + (tenantOrgId ?? chalk.dim('(the organization of your credentials)')),
      chalk.bold('Fields:'),
      shown,
      chalk.bold(`Body (${body?.length ?? 0} characters):`),
      abbreviate(body ?? ''),
      '',
    ];
    if (jsonMode) lines.push(chalk.dim('(payload echoed to stderr; ticket result follows on stdout)'), '');
    return lines.join('\n');
  }
}
