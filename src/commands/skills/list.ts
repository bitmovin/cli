import {Command, Flags} from '@oclif/core';
import {loadSkills} from '../../lib/skills/catalog.js';

export default class SkillsList extends Command {
  static override description = 'List available Bitmovin AI assistant skills';
  static override flags = {
    long: Flags.boolean({char: 'l', description: 'Show descriptions and tags'}),
    ref: Flags.string({description: 'Git ref to read skills from', hidden: true}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(SkillsList);
    const skills = await loadSkills(flags.ref);

    for (const skill of skills) {
      if (flags.long) {
        this.log(`${skill.name}\n  ${skill.description}${skill.tags?.length ? `\n  Tags: ${skill.tags.join(', ')}` : ''}`);
      } else {
        this.log(`${skill.name}\t${skill.description}`);
      }
    }
  }
}
