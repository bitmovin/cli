import {closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync} from 'node:fs';
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

/**
 * Atomically writes the config file with mode 0600. The file is created in a
 * sibling temp path with the restrictive mode applied at open time (avoids a
 * TOCTOU window where a fresh file briefly has 0644 before chmod tightens it),
 * then renamed into place. On Windows the mode bits are effectively ignored,
 * which matches the platform's NTFS-ACL-based model.
 */
export function saveConfig(config: CliConfig): void {
  mkdirSync(CONFIG_DIR, {recursive: true});

  const tmpPath = `${CONFIG_FILE}.tmp.${process.pid}`;
  const payload = JSON.stringify(config, null, 2) + '\n';
  // O_WRONLY | O_CREAT | O_TRUNC, mode 0600 applied atomically at create time.
  const fd = openSync(tmpPath, 'w', 0o600);
  try {
    writeSync(fd, payload);
  } finally {
    closeSync(fd);
  }

  try {
    renameSync(tmpPath, CONFIG_FILE);
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // best-effort cleanup
    }

    throw err;
  }
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
