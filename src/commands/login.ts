import {Flags} from '@oclif/core';
import chalk from 'chalk';
import {BaseCommand} from '../lib/base-command.js';
import {loadConfig, saveConfig} from '../lib/config.js';
import {runLoginFlow} from '../lib/oauth.js';

export default class Login extends BaseCommand {
  static override description = 'Authenticate with Bitmovin via OAuth (PKCE, browser-based).';

  static override flags = {
    ...BaseCommand.baseFlags,
    'print-url': Flags.boolean({
      description: 'Print the authorize URL instead of opening a browser (useful over SSH).',
      default: false,
    }),
  };

  static override examples = [
    'bitmovin login',
    'bitmovin login --print-url',
  ];

  async run(): Promise<void> {
    const {flags} = await this.parse(Login);

    const existing = loadConfig().oauth;
    if (existing?.accessToken) {
      this.log(chalk.dim(`Replacing existing session${existing.user?.email ? ` for ${existing.user.email}` : ''}.`));
    }

    const printUrl = flags['print-url'] as boolean;
    const session = await runLoginFlow({
      noOpenBrowser: printUrl,
      onAuthorizeUrl: (url) => {
        if (printUrl) {
          this.log('Open this URL in your browser to authenticate:');
        } else {
          this.log('Opening browser to authenticate. If it does not open, visit:');
        }

        this.log('  ' + url);
      },
    });

    const config = loadConfig();
    config.oauth = session;
    saveConfig(config);

    const who = session.user?.email ?? session.user?.sub;
    this.log(chalk.green('Logged in.') + (who ? ` (${who})` : ''));
  }
}
