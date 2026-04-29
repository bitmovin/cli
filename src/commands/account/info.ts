import {Flags} from '@oclif/core';
import {BaseCommand} from '../../lib/base-command.js';

interface ApiKey {
  id?: string;
  value?: string;
  [key: string]: unknown;
}

interface AccountInfoData {
  apiKeys?: ApiKey[];
  intercomIdVerification?: string;
  [key: string]: unknown;
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return '***';
  return secret.slice(0, 4) + '…' + secret.slice(-4);
}

function redact(info: AccountInfoData): AccountInfoData {
  const result: AccountInfoData = {...info};
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
    const info = (await (await this.getApi()).account.information.get()) as AccountInfoData;
    const output = flags['show-secrets'] ? info : redact(info);
    await this.outputData(output);
  }
}
