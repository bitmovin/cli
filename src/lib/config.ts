import {chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

export interface OAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
  user?: {email?: string; sub?: string};
}

export interface CliConfig {
  apiKey?: string;
  tenantOrgId?: string;
  defaultRegion?: string;
  oauth?: OAuthSession;
}

const CONFIG_DIR = join(homedir(), '.config', 'bitmovin');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function loadConfig(): CliConfig {
  if (!existsSync(CONFIG_FILE)) return {};
  return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as CliConfig;
}

export function saveConfig(config: CliConfig): void {
  mkdirSync(CONFIG_DIR, {recursive: true});
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
  try {
    chmodSync(CONFIG_FILE, 0o600);
  } catch {
    // chmod is best-effort (e.g. Windows); ignore failures
  }
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
