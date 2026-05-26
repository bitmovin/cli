import chalk from 'chalk';
import {BaseCommand} from '../lib/base-command.js';
import {loadConfig, saveConfig} from '../lib/config.js';

export default class Logout extends BaseCommand {
  static override description = 'Sign out and forget the OAuth session.';

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  static override examples = [
    'bitmovin logout',
  ];

  async run(): Promise<void> {
    await this.parse(Logout);
    const config = loadConfig();
    if (!config.oauth) {
      this.log('No active OAuth session.');
      return;
    }

    const who = config.oauth.user?.email ?? config.oauth.user?.sub;
    delete config.oauth;
    saveConfig(config);
    this.log(chalk.green('Logged out.') + (who ? ` (${who})` : ''));
  }
}
