import chalk from 'chalk';
import {BaseCommand} from '../../../lib/base-command.js';
import {loadConfig} from '../../../lib/config.js';
import {listOrganizations, toOrganizationRows} from '../../../lib/organizations.js';

export default class ConfigListOrganizations extends BaseCommand {
  static override description = 'List available organizations and optionally select one';

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  static override examples = [
    'bitmovin config list organizations',
    'bitmovin config list organizations --json',
    'bitmovin config list organizations --fields id,name --jq ".[].name"',
  ];

  async run(): Promise<void> {
    const config = loadConfig();
    const orgs = await listOrganizations(await this.getApi());
    // Sub-orgs come from the parentId of the flat listing — see
    // lib/organizations.ts for why the sub-organizations endpoint is avoided.
    const allOrgs = toOrganizationRows(orgs, config.tenantOrgId).map((row) => ({
      id: row.id,
      name: row.name,
      active: row.active,
      parent: row.parentId,
    }));

    if (await this.isJsonMode()) {
      await this.outputList(allOrgs, ['id', 'name', 'active', 'parent']);
      return;
    }

    if (allOrgs.length === 0) {
      this.log('No organizations found.');
      return;
    }

    const lines: string[] = [''];
    for (const org of allOrgs) {
      const marker = org.active ? chalk.green(' (active)') : '';
      if (org.parent) {
        lines.push(`    └─ ${chalk.dim(org.id)}  ${org.name}${marker}`);
      } else {
        lines.push(`  ${chalk.bold(org.id)}  ${org.name}${marker}`);
      }
    }

    lines.push('');
    lines.push(chalk.dim('Set active organization: bitmovin config set organization <id>'));
    process.stdout.write(lines.join('\n') + '\n');
  }
}
