export type AgentId = 'claude-code' | 'codex' | 'gemini-cli' | 'cursor' | 'pi';

export type SkillsMethod =
  | {method: 'npx-skills'; installerAgentId: string}
  | {method: 'claude-plugins'}
  | {method: 'unsupported'; reason: string};

export type McpMethod =
  | {method: 'claude-cli'}
  | {method: 'toml-block'; relPath: string; table: string}
  | {method: 'json-file'; relPath: string; jsonPath: string[]; shape: 'cursor' | 'gemini'}
  | {method: 'unsupported'; reason: string};

export interface AgentSpec {
  id: AgentId;
  label: string;
  /** Binary probed on PATH to detect the agent. */
  bin: string;
  /** Config directories (relative to home) that also count as "installed". */
  configDirs: string[];
  skills: SkillsMethod;
  mcp: McpMethod;
}

export const MCP_SERVER_NAME = 'bitmovin';
export const CLAUDE_MARKETPLACE_REPO = 'bitmovin/skills';
export const CLAUDE_MARKETPLACE_NAME = 'bitmovin';
export const DEFAULT_CLAUDE_PLUGIN = 'bitmovin';
export const DEFAULT_SKILL = 'bitmovin';

export const AGENTS: Record<AgentId, AgentSpec> = {
  'claude-code': {
    id: 'claude-code',
    label: 'Claude Code',
    bin: 'claude',
    configDirs: ['.claude'],
    // Skills are delivered through the plugin marketplace so they stay
    // updatable; the npx-skills copy route is reserved for other agents.
    skills: {method: 'claude-plugins'},
    mcp: {method: 'claude-cli'},
  },
  codex: {
    id: 'codex',
    label: 'Codex',
    bin: 'codex',
    configDirs: ['.codex'],
    skills: {method: 'npx-skills', installerAgentId: 'codex'},
    // `codex mcp add` only supports stdio servers; remote HTTP servers with
    // headers must be declared in config.toml.
    mcp: {method: 'toml-block', relPath: '.codex/config.toml', table: `mcp_servers.${MCP_SERVER_NAME}`},
  },
  'gemini-cli': {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    bin: 'gemini',
    configDirs: ['.gemini'],
    skills: {method: 'npx-skills', installerAgentId: 'gemini-cli'},
    mcp: {method: 'json-file', relPath: '.gemini/settings.json', jsonPath: ['mcpServers', MCP_SERVER_NAME], shape: 'gemini'},
  },
  cursor: {
    id: 'cursor',
    label: 'Cursor',
    bin: 'cursor',
    configDirs: ['.cursor'],
    skills: {method: 'npx-skills', installerAgentId: 'cursor'},
    mcp: {method: 'json-file', relPath: '.cursor/mcp.json', jsonPath: ['mcpServers', MCP_SERVER_NAME], shape: 'cursor'},
  },
  pi: {
    id: 'pi',
    label: 'Pi',
    bin: 'pi',
    configDirs: ['.pi'],
    skills: {method: 'npx-skills', installerAgentId: 'pi'},
    mcp: {method: 'unsupported', reason: 'Pi MCP configuration is not supported yet'},
  },
};

export const AGENT_IDS = Object.keys(AGENTS) as AgentId[];
