import type {AgentTarget} from './agents.js';
import {parseAgents, resolveTargets} from './agents.js';
import type {InstalledSkill} from './install.js';

export function resolveRequiredTargets(agentFlag: string | undefined, exampleCommand: string): AgentTarget[] {
  const targets = resolveTargets(parseAgents(agentFlag));
  if (targets.length === 0) {
    throw new Error(`No supported AI assistant skill directory found.\n\nUse --agent to choose one explicitly, for example:\n  ${exampleCommand}`);
  }

  return targets;
}

export function formatSkillResult(action: string, dryRun: boolean, item: InstalledSkill): string {
  const dryRunVerb = action === 'Installed' ? 'install' : action === 'Removed' ? 'remove' : action.toLowerCase();
  const verb = dryRun ? `Would ${dryRunVerb}` : action;
  return `${verb} ${item.skill} for ${item.agent}: ${item.path}`;
}
