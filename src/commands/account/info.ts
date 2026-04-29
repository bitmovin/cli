import {Flags} from '@oclif/core';
import {AccountInformation} from '@bitmovin/api-sdk';
import chalk from 'chalk';
import {BaseCommand} from '../../lib/base-command.js';
import {maskSecret} from '../../lib/secrets.js';

// Allowlist-style: any new secret-bearing field added to AccountInformation
// must be redacted here explicitly. Fields not listed below pass through
// unmodified.
function redact(info: AccountInformation): AccountInformation {
  const result: AccountInformation = {...info};
  if (Array.isArray(result.apiKeys)) {
    result.apiKeys = result.apiKeys.map((key) => ({
      ...key,
      value: typeof key.value === 'string' ? maskSecret(key.value) : key.value,
    }));
  }

  if (typeof result.intercomIdVerification === 'string') {
    result.intercomIdVerification = maskSecret(result.intercomIdVerification);
  }

  return result;
}

export default class AccountInfo extends BaseCommand {
  static override description = 'Show account information. Secrets (API key values) are masked by default.';

  static override flags = {
    ...BaseCommand.baseFlags,
    'show-secrets': Flags.boolean({
      description: 'Show full API key values and other secrets in plaintext',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(AccountInfo);
    const info = await (await this.getApi()).account.information.get();
    if (flags['show-secrets']) {
      process.stderr.write(chalk.yellow('Warning: --show-secrets prints secrets in plaintext. Avoid sharing terminal output, logs, or recordings.\n'));
    }

    const output = flags['show-secrets'] ? info : redact(info);
    await this.outputData(output);
  }
}
