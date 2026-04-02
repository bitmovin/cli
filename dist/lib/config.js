import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const CONFIG_DIR = join(homedir(), '.config', 'bitmovin');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
export function loadConfig() {
    if (!existsSync(CONFIG_FILE))
        return {};
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
}
export function saveConfig(config) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}
export function getConfigPath() {
    return CONFIG_FILE;
}
//# sourceMappingURL=config.js.map