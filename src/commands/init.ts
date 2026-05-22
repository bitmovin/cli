import {Command, Flags} from '@oclif/core';
import {SUPPORTED_AGENTS} from '../lib/skills/agents.js';
import {resolveRequiredTargets, formatSkillResult} from '../lib/skills/commands.js';
import {installPayload} from '../lib/skills/install.js';
import {loadLocalCliSkill} from '../lib/skills/local.js';

export default class Init extends Command {
  static override description = 'Install the local Bitmovin CLI AI assistant skill';
  static override flags = {
    agent: Flags.string({char: 'a', description: `Comma-separated agents (${SUPPORTED_AGENTS.join(', ')})`}),
    'dry-run': Flags.boolean({description: 'Show what would be installed without writing files'}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(Init);
    const targets = resolveRequiredTargets(flags.agent, 'bitmovin init --agent pi');
    const installed = await installPayload(await loadLocalCliSkill(), targets, flags['dry-run']);
    for (const item of installed) this.log(formatSkillResult('Installed', flags['dry-run'], item));
  }
}
