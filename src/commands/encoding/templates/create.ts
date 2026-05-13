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

interface ErrorResponse {
  developerMessage?: string;
  message?: string;
  requestId?: string;
  data?: {
    developerMessage?: string;
    message?: string;
    requestId?: string;
  };
}

interface ApiError extends Error {
  httpStatusCode: number;
  developerMessage: string;
  requestId?: string;
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
      const rawBodyText = await response.text();
      let developerMessage = rawBodyText;
      let requestId = response.headers?.get('X-Request-Id') ?? undefined;

      try {
        const parsed = JSON.parse(rawBodyText) as ErrorResponse;
        developerMessage =
          parsed.developerMessage ??
          parsed.message ??
          parsed.data?.developerMessage ??
          parsed.data?.message ??
          rawBodyText;
        requestId = requestId ?? parsed.requestId ?? parsed.data?.requestId;
      } catch {
        // leave developerMessage as raw response body
      }

      const error = new Error(`Failed to create template (${response.status}): ${developerMessage}`) as ApiError;
      error.httpStatusCode = response.status;
      error.developerMessage = developerMessage;
      if (requestId) error.requestId = requestId;
      throw error;
    }

    const json = (await response.json()) as CreateResponse;
    const result = json.data?.result ?? {};
    this.log(`Template created: ${result.id ?? '<unknown id>'}`);
    await this.outputData(result);
  }
}
