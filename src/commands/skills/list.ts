import {Command, Flags} from '@oclif/core';
import {buildSkillsListArgs, runSkills} from '../../lib/skills/npx.js';

export default class SkillsList extends Command {
  static override description = 'List available Bitmovin AI assistant skills';
  static override flags = {
    ref: Flags.string({description: 'Git ref to read skills from', hidden: true}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(SkillsList);
    await runSkills(buildSkillsListArgs(flags.ref));
  }
}
