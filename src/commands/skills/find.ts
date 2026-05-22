import {Command, Args, Flags} from '@oclif/core';
import {loadSkills, searchSkills} from '../../lib/skills/catalog.js';

export default class SkillsFind extends Command {
  static override description = 'Search available Bitmovin AI assistant skills';
  static override args = {
    query: Args.string({required: true, description: 'Search query'}),
  };
  static override flags = {
    ref: Flags.string({description: 'Git ref to read skills from', hidden: true}),
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(SkillsFind);
    const skills = searchSkills(await loadSkills(flags.ref), args.query);
    for (const skill of skills) this.log(`${skill.name}\t${skill.description}`);
  }
}
