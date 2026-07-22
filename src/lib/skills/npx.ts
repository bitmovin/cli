import {spawn} from 'node:child_process';

const SKILLS_PACKAGE = 'skills@1.5.7';
const BITMOVIN_SKILLS_REPO = 'bitmovin/skills';

export type SkillsAddOptions = {
  skill?: string;
  /** multiple skills, emitted as repeated --skill flags; takes precedence over `skill` */
  skills?: string[];
  all?: boolean;
  agent?: string;
  ref?: string;
};

export type SkillsRemoveOptions = {
  skill: string;
  agent?: string;
};

export function buildSkillsListArgs(ref?: string): string[] {
  return baseAddArgs(ref, ['--list']);
}

export function buildSkillsAddArgs(options: SkillsAddOptions): string[] {
  const args = baseAddArgs(options.ref, ['--global', '--copy', '--yes']);
  const skills = options.all ? ['*'] : (options.skills ?? [options.skill ?? 'bitmovin']);
  for (const skill of skills) args.push('--skill', skill);
  appendAgents(args, options.agent);
  return args;
}

export function buildSkillsRemoveArgs(options: SkillsRemoveOptions): string[] {
  const args = ['--yes', SKILLS_PACKAGE, 'remove', options.skill, '--global', '--yes'];
  appendAgents(args, options.agent);
  return args;
}

export async function runSkills(args: string[]): Promise<void> {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {stdio: 'inherit'});
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`npx skills exited with code ${code ?? 'unknown'}`));
    });
  });
}

function baseAddArgs(ref: string | undefined, extra: string[]): string[] {
  const source = ref ? `${BITMOVIN_SKILLS_REPO}#${ref}` : BITMOVIN_SKILLS_REPO;
  return ['--yes', SKILLS_PACKAGE, 'add', source, ...extra];
}

function appendAgents(args: string[], agentFlag: string | undefined): void {
  if (!agentFlag) return;
  const agents = [...new Set(agentFlag.split(',').map(agent => agent.trim()).filter(Boolean))];
  if (agents.length === 0) throw new Error('No agents specified');
  for (const agent of agents) args.push('--agent', agent);
}
