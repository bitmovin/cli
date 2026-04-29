import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import {existsSync, mkdirSync, readFileSync, writeFileSync, statSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import yaml from 'js-yaml';
import {Ajv2020} from 'ajv/dist/2020.js';
import chalk from 'chalk';

const SCHEMA_URL =
  'https://raw.githubusercontent.com/bitmovin/bitmovin-api-sdk-examples/main/bitmovin-encoding-template.json';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCachePaths(): {dir: string; file: string} {
  const dir = join(homedir(), '.config', 'bitmovin');
  return {dir, file: join(dir, 'template-schema.json')};
}

async function loadSchema(): Promise<object> {
  const {dir: cacheDir, file: cacheFile} = getCachePaths();

  // Check cache first
  if (existsSync(cacheFile)) {
    try {
      const stat = statSync(cacheFile);
      const age = Date.now() - stat.mtimeMs;
      if (age < CACHE_TTL_MS) {
        return JSON.parse(readFileSync(cacheFile, 'utf-8')) as object;
      }
    } catch {
      // Ignore cache read errors, fall through to fetch
    }
  }

  const schemaRes = await fetch(SCHEMA_URL);
  if (!schemaRes.ok) {
    // If fetch fails but we have a stale cache, use it
    if (existsSync(cacheFile)) {
      return JSON.parse(readFileSync(cacheFile, 'utf-8')) as object;
    }

    throw new Error(`Failed to fetch schema: ${schemaRes.status}`);
  }

  const schema = await schemaRes.json();

  // Cache the schema
  try {
    mkdirSync(cacheDir, {recursive: true});
    writeFileSync(cacheFile, JSON.stringify(schema, null, 2));
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
    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      // Suppress "unknown format" noise for OpenAPI-flavored format hints
      // (e.g. "double", "int32") that aren't part of JSON Schema validation.
      logger: false,
    });
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
