import {Command} from '@oclif/core';
import {loadLocalCliSkill} from '../lib/skills/local.js';

export default class Skill extends Command {
  static override description = 'Output CLI reference as markdown (for AI assistants)';
  static override hidden = true;

  async run(): Promise<void> {
    const skill = await loadLocalCliSkill();
    const skillFile = skill.files.find(file => file.path === 'SKILL.md');
    if (!skillFile) throw new Error('Local CLI skill is missing SKILL.md');
    process.stdout.write(skillFile.content);
  }
}
