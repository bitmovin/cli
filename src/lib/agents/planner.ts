import {join} from 'node:path';
import {buildSkillsAddArgs} from '../skills/npx.js';
import {buildCodexTomlBlock, claudeMcpAddArgs, claudeMcpProbeArgs, cursorMcpEntry, geminiMcpEntry} from './mcp.js';
import {AGENTS, CLAUDE_MARKETPLACE_NAME, CLAUDE_MARKETPLACE_REPO, type AgentId} from './registry.js';
import type {DetectionMap} from './detect.js';

export type StepAction =
  | {
    type: 'exec';
    bin: string;
    args: string[];
    /** arg indices to mask when rendering */
    redact?: number[];
    /** ran before the main command; exit 0 means "already configured" → skip */
    probe?: {args: string[]};
    /** non-zero exit with output matching /already .../ counts as skipped */
    tolerateAlready?: boolean;
  }
  | {type: 'npx-skills'; args: string[]}
  | {type: 'merge-json'; file: string; jsonPath: string[]; value: unknown}
  | {type: 'ensure-toml-block'; file: string; table: string; block: string}
  | {type: 'skip'; reason: string};

export interface SetupStep {
  id: string;
  agent: AgentId;
  category: 'skills' | 'plugins' | 'mcp';
  title: string;
  action: StepAction;
}

export interface PlanInput {
  /** injected for testability; os.homedir() in production */
  home: string;
  agents: AgentId[];
  include: {skills: boolean; plugins: boolean; mcp: boolean};
  apiKey?: string;
  claudePlugins: string[];
  skills: {all: boolean; names: string[]};
  detection: DetectionMap;
}

export function buildSetupPlan(input: PlanInput): SetupStep[] {
  const steps: SetupStep[] = [];

  for (const agentId of input.agents) {
    const spec = AGENTS[agentId];
    const detection = input.detection[agentId];
    const skip = (category: SetupStep['category'], title: string, reason: string): void => {
      steps.push({id: `${agentId}:${category}`, agent: agentId, category, title, action: {type: 'skip', reason}});
    };

    const wantsPlugins = input.include.plugins && spec.skills.method === 'claude-plugins';
    const wantsSkills = input.include.skills && spec.skills.method !== 'claude-plugins';
    const wantsMcp = input.include.mcp;

    if (!detection.installed) {
      const reason = `${spec.label} not detected (no \`${spec.bin}\` on PATH, no ${spec.configDirs.map(dir => `~/${dir}`).join(' or ')}) — use --agent ${agentId} to force`;
      if (wantsPlugins) skip('plugins', `${spec.label}: install Bitmovin plugins`, reason);
      if (wantsSkills) skip('skills', `${spec.label}: install Bitmovin skills`, reason);
      if (wantsMcp) skip('mcp', `${spec.label}: connect Bitmovin MCP server`, reason);
      continue;
    }

    // claude-code steps shell out to the claude binary; config-dir detection is not enough.
    const claudeBinMissing = (spec.skills.method === 'claude-plugins' || spec.mcp.method === 'claude-cli') && !detection.binPath;
    const claudeBinMissingReason = `${spec.label} config found but the \`${spec.bin}\` CLI is not on PATH — install it and re-run`;

    if (wantsPlugins) {
      if (claudeBinMissing) {
        skip('plugins', `${spec.label}: install Bitmovin plugins`, claudeBinMissingReason);
      } else {
        steps.push({
          id: `${agentId}:marketplace`,
          agent: agentId,
          category: 'plugins',
          title: `${spec.label}: add the ${CLAUDE_MARKETPLACE_REPO} plugin marketplace`,
          action: {
            type: 'exec',
            bin: detection.binPath!,
            args: ['plugin', 'marketplace', 'add', CLAUDE_MARKETPLACE_REPO],
            tolerateAlready: true,
          },
        });
        for (const plugin of input.claudePlugins) {
          steps.push({
            id: `${agentId}:plugin:${plugin}`,
            agent: agentId,
            category: 'plugins',
            title: `${spec.label}: install the ${plugin} plugin`,
            action: {
              type: 'exec',
              bin: detection.binPath!,
              args: ['plugin', 'install', `${plugin}@${CLAUDE_MARKETPLACE_NAME}`],
              tolerateAlready: true,
            },
          });
        }
      }
    }

    if (wantsSkills && spec.skills.method === 'npx-skills') {
      steps.push({
        id: `${agentId}:skills`,
        agent: agentId,
        category: 'skills',
        title: `${spec.label}: install Bitmovin skills (${input.skills.all ? 'all' : input.skills.names.join(', ')})`,
        action: {
          type: 'npx-skills',
          args: buildSkillsAddArgs({
            all: input.skills.all,
            skills: input.skills.all ? undefined : input.skills.names,
            agent: spec.skills.installerAgentId,
          }),
        },
      });
    }

    if (wantsMcp) {
      const title = `${spec.label}: connect the Bitmovin MCP server`;
      if (spec.mcp.method === 'unsupported') {
        skip('mcp', title, spec.mcp.reason);
      } else if (input.apiKey === undefined) {
        skip('mcp', title, 'no API key available — provide --api-key, set BITMOVIN_API_KEY, or run `bitmovin config set api-key`');
      } else if (spec.mcp.method === 'claude-cli') {
        if (claudeBinMissing) {
          skip('mcp', title, claudeBinMissingReason);
        } else {
          const {args, redact} = claudeMcpAddArgs(input.apiKey);
          steps.push({
            id: `${agentId}:mcp`,
            agent: agentId,
            category: 'mcp',
            title,
            action: {type: 'exec', bin: detection.binPath!, args, redact, probe: {args: claudeMcpProbeArgs()}},
          });
        }
      } else if (spec.mcp.method === 'toml-block') {
        steps.push({
          id: `${agentId}:mcp`,
          agent: agentId,
          category: 'mcp',
          title,
          action: {
            type: 'ensure-toml-block',
            file: join(input.home, spec.mcp.relPath),
            table: spec.mcp.table,
            block: buildCodexTomlBlock(input.apiKey),
          },
        });
      } else {
        steps.push({
          id: `${agentId}:mcp`,
          agent: agentId,
          category: 'mcp',
          title,
          action: {
            type: 'merge-json',
            file: join(input.home, spec.mcp.relPath),
            jsonPath: spec.mcp.jsonPath,
            value: spec.mcp.shape === 'gemini' ? geminiMcpEntry(input.apiKey) : cursorMcpEntry(input.apiKey),
          },
        });
      }
    }
  }

  return steps;
}
