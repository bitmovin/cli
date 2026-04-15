import chalk from 'chalk';
import {BaseCommand} from '../../../lib/base-command.js';
import {loadConfig, getProfile} from '../../../lib/config.js';

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
    const profile = getProfile(loadConfig());
    const result = await (await this.getApi()).account.organizations.list();
    const orgs = result.items ?? [];

    // Collect all orgs including sub-orgs for structured output
    const allOrgs: Record<string, unknown>[] = [];
    for (const org of orgs) {
      allOrgs.push({id: org.id, name: org.name, active: profile.tenantOrgId === org.id, parent: null});
      if (org.id) {
        try {
          const subOrgs = await (await this.getApi()).account.organizations.subOrganizations.list(org.id);
          for (const sub of (subOrgs.items ?? [])) {
            allOrgs.push({id: sub.id, name: sub.name, active: profile.tenantOrgId === sub.id, parent: org.id});
          }
        } catch {
          // Sub-organizations may not be accessible
        }
      }
    }

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
        lines.push(`    └─ ${chalk.dim(org.id as string)}  ${org.name ?? ''}${marker}`);
      } else {
        lines.push(`  ${chalk.bold(org.id as string)}  ${org.name ?? ''}${marker}`);
      }
    }

    lines.push('');
    lines.push(chalk.dim('Set active organization: bitmovin config set organization <id>'));
    process.stdout.write(lines.join('\n') + '\n');
  }
}
