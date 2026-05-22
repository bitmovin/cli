import {Command, Flags} from '@oclif/core';
import {withSkillsArchive} from '../../lib/skills/archive.js';
import {discoverSkills, findSkill} from '../../lib/skills/catalog.js';
import {SUPPORTED_AGENTS} from '../../lib/skills/agents.js';
import {formatSkillResult, resolveRequiredTargets} from '../../lib/skills/commands.js';
import {installPayload, loadSkillPayloadsFromArchive} from '../../lib/skills/install.js';
import {getRef} from '../../lib/skills/source.js';

export default class SkillsAdd extends Command {
  static override description = 'Install Bitmovin AI assistant skills';
  static override flags = {
    skill: Flags.string({char: 's', description: 'Skill to install', default: 'bitmovin'}),
    all: Flags.boolean({description: 'Install all available skills'}),
    agent: Flags.string({char: 'a', description: `Comma-separated agents (${SUPPORTED_AGENTS.join(', ')})`}),
    'dry-run': Flags.boolean({description: 'Show what would be installed without writing files'}),
    ref: Flags.string({description: 'Git ref to read skills from', hidden: true}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(SkillsAdd);
    const targets = resolveRequiredTargets(flags.agent, `bitmovin skills add --agent pi --skill ${flags.skill}`);

    await withSkillsArchive(getRef(flags.ref), async archiveRoot => {
      const skills = await discoverSkills(archiveRoot);
      const selected = flags.all ? skills : [findSkill(skills, flags.skill)];
      const payloads = await loadSkillPayloadsFromArchive(archiveRoot, selected);
      for (const payload of payloads) {
        const installed = await installPayload(payload, targets, flags['dry-run']);
        for (const item of installed) this.log(formatSkillResult('Installed', flags['dry-run'], item));
      }
    });
  }
}
