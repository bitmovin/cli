import {Command, Flags} from '@oclif/core';
import {SUPPORTED_AGENTS} from '../../lib/skills/agents.js';
import {formatSkillResult, resolveRequiredTargets} from '../../lib/skills/commands.js';
import {removeSkill} from '../../lib/skills/install.js';
import {validateSkillName} from '../../lib/skills/source.js';

export default class SkillsRemove extends Command {
  static override description = 'Remove installed Bitmovin AI assistant skills';
  static override flags = {
    skill: Flags.string({char: 's', description: 'Skill to remove', required: true}),
    agent: Flags.string({char: 'a', description: `Comma-separated agents (${SUPPORTED_AGENTS.join(', ')})`}),
    'dry-run': Flags.boolean({description: 'Show what would be removed without deleting files'}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(SkillsRemove);
    validateSkillName(flags.skill);
    const targets = resolveRequiredTargets(flags.agent, `bitmovin skills remove --agent pi --skill ${flags.skill}`);
    const removed = await removeSkill(flags.skill, targets, flags['dry-run']);
    for (const item of removed) this.log(formatSkillResult('Removed', flags['dry-run'], item));
  }
}
