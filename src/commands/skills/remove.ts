import {Command, Flags} from '@oclif/core';
import {buildSkillsRemoveArgs, runSkills} from '../../lib/skills/npx.js';

export default class SkillsRemove extends Command {
  static override description = 'Remove installed Bitmovin AI assistant skills';
  static override flags = {
    skill: Flags.string({char: 's', description: 'Skill to remove', required: true}),
    agent: Flags.string({char: 'a', description: 'Comma-separated agents supported by npx skills (for example: pi, claude-code, codex, gemini-cli)'}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(SkillsRemove);
    await runSkills(buildSkillsRemoveArgs({skill: flags.skill, agent: flags.agent}));
  }
}
