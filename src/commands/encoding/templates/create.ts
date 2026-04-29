import {Args} from '@oclif/core';
import {readFileSync} from 'node:fs';
import {BaseCommand} from '../../../lib/base-command.js';
import {API_BASE_URL, resolveAuth} from '../../../lib/client.js';

interface CreateResponse {
  data?: {
    result?: {
      id?: string;
      [key: string]: unknown;
    };
  };
}

export default class EncodingTemplateCreate extends BaseCommand {
  static override description =
    'Store an encoding template for reuse. The template name is taken from `metadata.name` in the YAML.';

  static override args = {
    file: Args.string({description: 'Path to YAML template file', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(EncodingTemplateCreate);
    const content = readFileSync(args.file, 'utf-8');
    await this.isJsonMode();

    const {apiKey, tenantOrgId} = resolveAuth(flags['api-key']);

    // The /encoding/templates endpoint expects a raw YAML body with
    // Content-Type: application/yaml. The SDK only sends application/json,
    // so we issue this request directly.
    const headers: Record<string, string> = {
      'X-Api-Key': apiKey,
      'X-Api-Client': '@bitmovin/cli',
      'Content-Type': 'application/yaml',
    };
    if (tenantOrgId) headers['X-Tenant-Org-Id'] = tenantOrgId;

    const response = await fetch(`${API_BASE_URL}/encoding/templates`, {
      method: 'POST',
      headers,
      body: content,
    });

    if (!response.ok) {
      let bodyText = await response.text();
      try {
        const parsed = JSON.parse(bodyText) as {data?: {message?: string; developerMessage?: string}};
        bodyText = parsed.data?.developerMessage ?? parsed.data?.message ?? bodyText;
      } catch {
        // leave bodyText as-is
      }

      this.error(`Failed to create template (${response.status}): ${bodyText}`);
    }

    const json = (await response.json()) as CreateResponse;
    const result = json.data?.result ?? {};
    this.log(`Template created: ${result.id ?? '<unknown id>'}`);
    await this.outputData(result);
  }
}
