import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {SkillPayload} from './install.js';

export const LOCAL_CLI_SKILL_NAME = 'bitmovin-cli';

export async function loadLocalCliSkill(): Promise<SkillPayload> {
  const skillPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../skills/bitmovin-cli/SKILL.md');
  return {
    name: LOCAL_CLI_SKILL_NAME,
    files: [{path: 'SKILL.md', content: await fs.readFile(skillPath, 'utf8')}],
  };
}
