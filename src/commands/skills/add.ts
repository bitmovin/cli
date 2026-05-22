import {Command, Flags} from '@oclif/core';
import {buildSkillsAddArgs, runSkills} from '../../lib/skills/npx.js';

export default class SkillsAdd extends Command {
  static override description = 'Install Bitmovin AI assistant skills';
  static override flags = {
    skill: Flags.string({char: 's', description: 'Skill to install', default: 'bitmovin'}),
    all: Flags.boolean({description: 'Install all available skills'}),
    agent: Flags.string({char: 'a', description: 'Comma-separated agents supported by npx skills (for example: pi, claude-code, codex, gemini-cli)'}),
    ref: Flags.string({description: 'Git ref to read skills from', hidden: true}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(SkillsAdd);
    await runSkills(buildSkillsAddArgs({
      skill: flags.skill,
      all: flags.all,
      agent: flags.agent,
      ref: flags.ref,
    }));
  }
}
