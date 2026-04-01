import {Args} from '@oclif/core';
import {Command} from '@oclif/core';
import {readFileSync} from 'node:fs';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import chalk from 'chalk';

const SCHEMA_URL =
  'https://raw.githubusercontent.com/bitmovin/bitmovin-api-sdk-examples/main/bitmovin-encoding-template.json';

export default class EncodingTemplateValidate extends Command {
  static override description = 'Validate a YAML template against the Bitmovin JSON schema';

  static override args = {
    file: Args.string({description: 'Path to YAML template file', required: true}),
  };

  async run(): Promise<void> {
    const {args} = await this.parse(EncodingTemplateValidate);
    const content = readFileSync(args.file, 'utf-8');

    let doc: unknown;
    try {
      doc = yaml.load(content);
    } catch {
      this.error('Invalid YAML syntax');
    }

    const schemaRes = await fetch(SCHEMA_URL);
    if (!schemaRes.ok) {
      this.error(`Failed to fetch schema: ${schemaRes.status}`);
    }

    const schema = await schemaRes.json();
    const ajv = new (Ajv as unknown as typeof Ajv.default)({allErrors: true, strict: false});
    const validate = ajv.compile(schema as object);
    const valid = validate(doc);

    if (valid) {
      this.log(chalk.green('Template is valid.'));
    } else {
      this.log(chalk.red('Validation errors:'));
      for (const err of validate.errors ?? []) {
        this.log(`  ${err.instancePath || '/'}: ${err.message}`);
      }

      this.exit(1);
    }
  }
}
