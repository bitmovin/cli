import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

export interface ProfileConfig {
  apiKey?: string;
  tenantOrgId?: string;
  defaultRegion?: string;
}

// Backward-compat alias — existing code that imports CliConfig continues to work
export type CliConfig = ProfileConfig;

export interface FullConfig {
  activeProfile: string;
  profiles: Record<string, ProfileConfig>;
}

const CONFIG_DIR = join(homedir(), '.config', 'bitmovin');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Load the full configuration, migrating legacy flat configs on the fly.
 * A legacy config ({"apiKey":"...","tenantOrgId":"..."}) is transparently
 * mapped to a single "default" profile so existing setups keep working.
 */
export function loadConfig(): FullConfig {
  if (!existsSync(CONFIG_FILE)) {
    return {activeProfile: 'default', profiles: {default: {}}};
  }

  const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Record<string, unknown>;

  // New format: has a 'profiles' key
  if (raw.profiles && typeof raw.profiles === 'object') {
    return {
      activeProfile: typeof raw.activeProfile === 'string' ? raw.activeProfile : 'default',
      profiles: raw.profiles as Record<string, ProfileConfig>,
    };
  }

  // Legacy flat format — migrate top-level keys into the default profile and rewrite immediately
  const profile: ProfileConfig = {};
  if (typeof raw.apiKey === 'string') profile.apiKey = raw.apiKey;
  if (typeof raw.tenantOrgId === 'string') profile.tenantOrgId = raw.tenantOrgId;
  if (typeof raw.defaultRegion === 'string') profile.defaultRegion = raw.defaultRegion;
  const migrated: FullConfig = {activeProfile: 'default', profiles: {default: profile}};
  saveConfig(migrated);
  return migrated;
}

/**
 * Get the config for a named profile (defaults to the active profile).
 */
export function getProfile(config: FullConfig, profileName?: string): ProfileConfig {
  const name = profileName ?? config.activeProfile;
  return config.profiles[name] ?? {};
}

export function saveConfig(full: FullConfig): void {
  mkdirSync(CONFIG_DIR, {recursive: true});
  writeFileSync(CONFIG_FILE, JSON.stringify(full, null, 2) + '\n');
}

export function setActiveProfile(name: string): void {
  const full = loadConfig();
  if (!full.profiles[name]) {
    throw new Error(
      `Profile '${name}' does not exist.\n` +
      `Create it first: bitmovin config set api-key <key> --profile ${name}`,
    );
  }

  full.activeProfile = name;
  saveConfig(full);
}

export function listProfiles(): Array<{name: string; active: boolean; config: ProfileConfig}> {
  const full = loadConfig();
  return Object.entries(full.profiles).map(([name, config]) => ({
    name,
    active: name === full.activeProfile,
    config,
  }));
}

export function deleteProfile(name: string): void {
  if (name === 'default') {
    throw new Error("Cannot delete the 'default' profile.");
  }

  const full = loadConfig();
  if (!full.profiles[name]) {
    throw new Error(`Profile '${name}' does not exist.`);
  }

  delete full.profiles[name];
  if (full.activeProfile === name) {
    full.activeProfile = 'default';
  }

  saveConfig(full);
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
