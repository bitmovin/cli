import {Flags} from '@oclif/core';
import chalk from 'chalk';
import {BaseCommand} from '../../../lib/base-command.js';
import {loadConfig} from '../../../lib/config.js';
import {
  ORGANIZATION_COLUMNS,
  ROOT_ORGANIZATION,
  SUB_ORGANIZATION,
  listOrganizations,
  toOrganizationRows,
} from '../../../lib/organizations.js';

export default class AccountOrganizationsList extends BaseCommand {
  static override description =
    'List organizations visible to your credentials. Sub-organizations are listed under their parent, with type and parentId shown.';

  static override flags = {
    ...BaseCommand.baseFlags,
    parent: Flags.string({
      description: 'Show only the sub-organizations of this organization',
      helpValue: '<org-id>',
      exclusive: ['type'],
    }),
    type: Flags.string({
      description: 'Show only root organizations or only sub-organizations',
      options: ['root', 'sub'],
    }),
  };

  static override examples = [
    'bitmovin account organizations list',
    'bitmovin account organizations list --type sub',
    'bitmovin account organizations list --parent 8a7b6c5d-1234-5678-9abc-def012345678',
    'bitmovin account organizations list --json --jq ".[] | select(.type == \\"SUB_ORGANIZATION\\") | .id"',
  ];

  async run(): Promise<void> {
    const {flags} = await this.parse(AccountOrganizationsList);
    const config = loadConfig();
    const orgs = await listOrganizations(await this.getApi(), flags['api-key'] as string | undefined);
    const rows = toOrganizationRows(orgs, config.tenantOrgId);

    let selected = rows;
    if (flags.parent) {
      if (!rows.some((row) => row.id === flags.parent)) {
        this.error(
          `Organization ${flags.parent} is not visible to these credentials.\n` +
          '  Run `bitmovin account organizations list` to see the organizations you can access.',
          {exit: 2},
        );
      }

      selected = rows.filter((row) => row.parentId === flags.parent);
    } else if (flags.type) {
      // Filter on the same `type` value the table shows and the --jq example
      // selects on, not on parentId — an org the API types as SUB_ORGANIZATION
      // without a parentId would otherwise be filtered as a root while its own
      // type cell read SUB_ORGANIZATION.
      const wanted = flags.type === 'sub' ? SUB_ORGANIZATION : ROOT_ORGANIZATION;
      selected = rows.filter((row) => row.type === wanted);
    }

    await this.outputList(selected, ORGANIZATION_COLUMNS);

    if (!(await this.isJsonMode()) && !flags.quiet && selected.length > 0) {
      this.log('');
      this.log(chalk.dim('Set the default organization: bitmovin config set organization <id>'));
      this.log(chalk.dim('Target one for a single command:  --organization <id>'));
    }
  }
}
