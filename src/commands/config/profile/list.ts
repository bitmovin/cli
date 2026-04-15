import chalk from 'chalk';
import {BaseCommand} from '../../../lib/base-command.js';
import {listProfiles} from '../../../lib/config.js';

export default class ConfigProfileList extends BaseCommand {
  static override description = 'List all configuration profiles';

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  static override examples = [
    'bitmovin config profile list',
    'bitmovin config profile list --json',
  ];

  async run(): Promise<void> {
    const profiles = listProfiles();

    if (await this.isJsonMode()) {
      await this.outputList(
        profiles.map(p => ({
          name: p.name,
          active: p.active,
          apiKey: p.config.apiKey ? p.config.apiKey.slice(0, 8) + '...' : null,
          tenantOrgId: p.config.tenantOrgId ?? null,
          defaultRegion: p.config.defaultRegion ?? null,
        })),
        ['name', 'active', 'apiKey', 'tenantOrgId', 'defaultRegion'],
      );
      return;
    }

    if (profiles.length === 0) {
      this.log('No profiles configured.');
      return;
    }

    const lines: string[] = [''];
    for (const p of profiles) {
      const activeMarker = p.active ? chalk.green(' (active)') : '';
      const keyStr = p.config.apiKey
        ? chalk.dim(p.config.apiKey.slice(0, 8) + '...')
        : chalk.dim('no api key');
      const orgStr = p.config.tenantOrgId ? chalk.dim(`  org: ${p.config.tenantOrgId}`) : '';
      lines.push(`  ${chalk.bold(p.name)}${activeMarker}  ${keyStr}${orgStr}`);
    }

    lines.push('');
    lines.push(chalk.dim('Switch profile: bitmovin config profile use <name>'));
    process.stdout.write(lines.join('\n') + '\n');
  }
}
