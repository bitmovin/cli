import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import {existsSync, mkdirSync, readFileSync, writeFileSync, statSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import chalk from 'chalk';

const SCHEMA_URL =
  'https://raw.githubusercontent.com/bitmovin/bitmovin-api-sdk-examples/main/bitmovin-encoding-template.json';

const CACHE_DIR = join(homedir(), '.config', 'bitmovin');
const CACHE_FILE = join(CACHE_DIR, 'template-schema.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function loadSchema(): Promise<object> {
  // Check cache first
  if (existsSync(CACHE_FILE)) {
    try {
      const stat = statSync(CACHE_FILE);
      const age = Date.now() - stat.mtimeMs;
      if (age < CACHE_TTL_MS) {
        return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as object;
      }
    } catch {
      // Ignore cache read errors, fall through to fetch
    }
  }

  const schemaRes = await fetch(SCHEMA_URL);
  if (!schemaRes.ok) {
    // If fetch fails but we have a stale cache, use it
    if (existsSync(CACHE_FILE)) {
      return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as object;
    }

    throw new Error(`Failed to fetch schema: ${schemaRes.status}`);
  }

  const schema = await schemaRes.json();

  // Cache the schema
  try {
    mkdirSync(CACHE_DIR, {recursive: true});
    writeFileSync(CACHE_FILE, JSON.stringify(schema, null, 2));
  } catch {
    // Ignore cache write errors — validation can still proceed
  }

  return schema as object;
}

export default class EncodingTemplateValidate extends BaseCommand {
  static override description = 'Validate a YAML template against the Bitmovin JSON schema';

  static override args = {
    file: Args.string({description: 'Path to YAML template file', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
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

    const schema = await loadSchema();
    const ajv = new (Ajv as unknown as typeof Ajv.default)({allErrors: true, strict: false});
    const validate = ajv.compile(schema);
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
