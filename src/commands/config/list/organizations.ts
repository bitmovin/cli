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
    const scope = await this.requestScope();
    const orgs = await listOrganizations(scope.apiKey);
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

    // Indent only when the parent is actually in this listing. `toOrganizationRows`
    // emits a sub-org whose parent is invisible to the credential at top level (so
    // nothing is hidden), and indenting on `parent` alone would nest it under
    // whichever unrelated root happened to precede it — asserting a relationship
    // that does not exist.
    const visible = new Set(allOrgs.map((org) => org.id));
    const lines: string[] = [''];
    for (const org of allOrgs) {
      const marker = org.active ? chalk.green(' (active)') : '';
      if (org.parent && visible.has(org.parent)) {
        lines.push(`    └─ ${chalk.dim(org.id)}  ${org.name}${marker}`);
      } else {
        const orphan = org.parent ? chalk.dim(`  (sub-org of ${org.parent}, not visible to these credentials)`) : '';
        lines.push(`  ${chalk.bold(org.id)}  ${org.name}${marker}${orphan}`);
      }
    }

    lines.push('');
    lines.push(chalk.dim('Set active organization: bitmovin config set organization <id>'));
    process.stdout.write(lines.join('\n') + '\n');
  }
}
