import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export const SUPPORTED_AGENTS = ['pi', 'claude', 'codex', 'gemini'] as const;
export type Agent = typeof SUPPORTED_AGENTS[number];

const DEFAULT_SKILL_DIRS: Record<Agent, string> = {
  pi: '~/.pi/agent/skills',
  claude: '~/.claude/skills',
  codex: '~/.codex/skills',
  gemini: '~/.gemini/skills',
};

export type SkillDirOverrides = Partial<Record<Agent, string>>;

export type AgentTarget = {
  agent: Agent;
  skillsDir: string;
};

export function parseAgents(value?: string): Agent[] | undefined {
  if (value === undefined) return undefined;
  const agents = [...new Set(value.split(',').map(agent => agent.trim()).filter(Boolean))];
  if (agents.length === 0) {
    throw new Error('No agents specified');
  }

  for (const agent of agents) {
    if (!isAgent(agent)) {
      throw new Error(`Unsupported agent: ${agent}. Supported agents: ${SUPPORTED_AGENTS.join(', ')}`);
    }
  }

  return agents as Agent[];
}

export function resolveTargets(agents?: Agent[], overrides: SkillDirOverrides = {}): AgentTarget[] {
  if (agents?.length) {
    return agents.map(agent => ({agent, skillsDir: getSkillsDir(agent, overrides)}));
  }

  return SUPPORTED_AGENTS
    .map(agent => ({agent, skillsDir: getSkillsDir(agent, overrides)}))
    .filter(target => isDirectory(target.skillsDir));
}

export function getSkillsDir(agent: Agent, overrides: SkillDirOverrides = {}): string {
  return overrides[agent] ? path.resolve(overrides[agent]) : expandHome(DEFAULT_SKILL_DIRS[agent]);
}

function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function isAgent(value: string): value is Agent {
  return (SUPPORTED_AGENTS as readonly string[]).includes(value);
}

function expandHome(value: string): string {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}
