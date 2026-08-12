import {Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import {organizationFlag, resolveTenantOrgId} from '../../../lib/organizations.js';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_SEVERITIES,
  TICKET_SORT_FIELDS,
  TICKET_STATUSES,
  listTickets,
  validateEnumFilter,
  validatePagination,
  validateSearchText,
  validateSort,
} from '../../../lib/support-tickets.js';

const COLUMNS = ['caseId', 'subject', 'status', 'category', 'priority', 'severity', 'createdAt'];

export default class SupportTicketsList extends BaseCommand {
  static override description = 'List support tickets of the active organization';

  static override flags = {
    ...BaseCommand.baseFlags,
    organization: organizationFlag,
    limit: Flags.integer({description: 'Max results (1-100)', default: 25}),
    offset: Flags.integer({description: 'Offset for pagination; must be 0 or a multiple of --limit', default: 0}),
    status: Flags.string({description: `Filter by status, comma-separated (${TICKET_STATUSES.join(', ')})`}),
    category: Flags.string({description: `Filter by category, comma-separated (${TICKET_CATEGORIES.join(', ')})`}),
    priority: Flags.string({description: `Filter by priority, comma-separated (${TICKET_PRIORITIES.join(', ')})`}),
    severity: Flags.string({description: `Filter by severity, comma-separated (${TICKET_SEVERITIES.join(', ')})`}),
    search: Flags.string({description: 'Full-text search (max 100 chars; letters, digits and spaces only)'}),
    sort: Flags.string({description: `Sort order, e.g. createdAt:DESC (fields: ${TICKET_SORT_FIELDS.join(', ')})`}),
  };

  static override examples = [
    'bitmovin support tickets list',
    'bitmovin support tickets list --status open,pending --sort modifiedAt:DESC',
    'bitmovin support tickets list --limit 50 --offset 50',
    'bitmovin support tickets list --organization 8a7b6c5d-1234-5678-9abc-def012345678',
    'bitmovin support tickets list --json --jq ".[].caseId"',
  ];

  async run(): Promise<void> {
    const {flags} = await this.parse(SupportTicketsList);

    const problem =
      validatePagination(flags.limit, flags.offset) ??
      (flags.search === undefined ? undefined : validateSearchText(flags.search)) ??
      (flags.sort === undefined ? undefined : validateSort(flags.sort)) ??
      (flags.status === undefined ? undefined : validateEnumFilter('--status', flags.status, TICKET_STATUSES)) ??
      (flags.category === undefined ? undefined : validateEnumFilter('--category', flags.category, TICKET_CATEGORIES)) ??
      (flags.priority === undefined ? undefined : validateEnumFilter('--priority', flags.priority, TICKET_PRIORITIES)) ??
      (flags.severity === undefined ? undefined : validateEnumFilter('--severity', flags.severity, TICKET_SEVERITIES));

    if (problem) this.error(problem, {exit: 2});

    const page = await listTickets(
      {
        limit: flags.limit,
        offset: flags.offset,
        status: flags.status,
        category: flags.category,
        priority: flags.priority,
        severity: flags.severity,
        searchText: flags.search,
        sort: flags.sort,
      },
      {tenantOrgId: resolveTenantOrgId(flags.organization), apiKey: flags['api-key'] as string | undefined},
    );

    const items = page.items ?? [];
    await this.outputList(items, COLUMNS);

    if (!flags.quiet && items.length > 0 && page.totalCount !== undefined) {
      this.log(`Showing ${flags.offset + 1}-${flags.offset + items.length} of ${page.totalCount}.`);
    }
  }
}
