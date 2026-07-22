import {describe, expect, it} from 'vitest';
import {buildSetupPlan, type PlanInput} from '../../src/lib/agents/planner.js';
import {renderPlan} from '../../src/lib/agents/render.js';
import type {DetectionMap} from '../../src/lib/agents/detect.js';

const KEY = 'secret-api-key-123';

function detection(overrides: Partial<DetectionMap> = {}): DetectionMap {
  return {
    'claude-code': {installed: true, via: 'bin', binPath: '/usr/local/bin/claude'},
    codex: {installed: true, via: 'config-dir'},
    'gemini-cli': {installed: true, via: 'bin', binPath: '/usr/local/bin/gemini'},
    cursor: {installed: true, via: 'config-dir'},
    pi: {installed: true, via: 'bin', binPath: '/usr/local/bin/pi'},
    ...overrides,
  };
}

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    home: '/home/user',
    agents: ['claude-code'],
    include: {skills: true, plugins: true, mcp: true},
    apiKey: KEY,
    claudePlugins: ['bitmovin'],
    skills: {all: false, names: ['bitmovin']},
    detection: detection(),
    ...overrides,
  };
}

describe('buildSetupPlan', () => {
  it('plans marketplace, plugin install, and MCP for claude-code', () => {
    const plan = buildSetupPlan(input());
    expect(plan.map(step => step.id)).toEqual(['claude-code:marketplace', 'claude-code:plugin:bitmovin', 'claude-code:mcp']);

    const [marketplace, plugin, mcp] = plan;
    expect(marketplace.action).toMatchObject({
      type: 'exec',
      bin: '/usr/local/bin/claude',
      args: ['plugin', 'marketplace', 'add', 'bitmovin/skills'],
      tolerateAlready: true,
    });
    expect(plugin.action).toMatchObject({
      type: 'exec',
      args: ['plugin', 'install', 'bitmovin@bitmovin'],
      tolerateAlready: true,
    });
    expect(mcp.action).toMatchObject({
      type: 'exec',
      args: ['mcp', 'add', '--transport', 'http', '--scope', 'user', '--header', `x-api-key: ${KEY}`, 'bitmovin', 'https://mcp.bitmovin.com'],
      probe: {args: ['mcp', 'get', 'bitmovin']},
    });
    // The header arg carrying the key must be marked for redaction
    const action = mcp.action as {args: string[]; redact: number[]};
    expect(action.redact).toEqual([action.args.indexOf(`x-api-key: ${KEY}`)]);
  });

  it('plans npx-skills and a TOML block for codex', () => {
    const plan = buildSetupPlan(input({agents: ['codex']}));
    expect(plan.map(step => step.id)).toEqual(['codex:skills', 'codex:mcp']);
    expect(plan[0].action).toEqual({
      type: 'npx-skills',
      args: ['--yes', 'skills@1.5.7', 'add', 'bitmovin/skills', '--global', '--copy', '--yes', '--skill', 'bitmovin', '--agent', 'codex'],
    });
    expect(plan[1].action).toMatchObject({
      type: 'ensure-toml-block',
      file: '/home/user/.codex/config.toml',
      table: 'mcp_servers.bitmovin',
    });
    const block = (plan[1].action as {block: string}).block;
    expect(block).toContain('[mcp_servers.bitmovin]');
    expect(block).toContain('url = "https://mcp.bitmovin.com"');
    expect(block).toContain(`http_headers = { "x-api-key" = "${KEY}" }`);
  });

  it('plans JSON merges for cursor and gemini-cli with their respective shapes', () => {
    const plan = buildSetupPlan(input({agents: ['cursor', 'gemini-cli'], include: {skills: false, plugins: false, mcp: true}}));
    expect(plan.map(step => step.id)).toEqual(['cursor:mcp', 'gemini-cli:mcp']);
    expect(plan[0].action).toEqual({
      type: 'merge-json',
      file: '/home/user/.cursor/mcp.json',
      jsonPath: ['mcpServers', 'bitmovin'],
      value: {url: 'https://mcp.bitmovin.com', headers: {'x-api-key': KEY}},
    });
    expect(plan[1].action).toEqual({
      type: 'merge-json',
      file: '/home/user/.gemini/settings.json',
      jsonPath: ['mcpServers', 'bitmovin'],
      value: {httpUrl: 'https://mcp.bitmovin.com', headers: {'x-api-key': KEY}},
    });
  });

  it('emits skip steps for unsupported combinations (pi MCP)', () => {
    const plan = buildSetupPlan(input({agents: ['pi']}));
    expect(plan.map(step => step.id)).toEqual(['pi:skills', 'pi:mcp']);
    expect(plan[1].action).toMatchObject({type: 'skip', reason: expect.stringContaining('not supported')});
  });

  it('skips everything for an undetected agent with a forcing hint', () => {
    const plan = buildSetupPlan(input({agents: ['cursor'], detection: detection({cursor: {installed: false, via: 'none'}})}));
    expect(plan).toHaveLength(2); // skills + mcp
    for (const step of plan) {
      expect(step.action).toMatchObject({type: 'skip', reason: expect.stringContaining('--agent cursor')});
    }
  });

  it('skips claude-code steps when only the config dir was found', () => {
    const plan = buildSetupPlan(input({detection: detection({'claude-code': {installed: true, via: 'config-dir'}})}));
    expect(plan.map(step => step.action.type)).toEqual(['skip', 'skip']);
    for (const step of plan) {
      expect((step.action as {reason: string}).reason).toContain('CLI is not on PATH');
    }
  });

  it('drops component categories that are excluded', () => {
    const plan = buildSetupPlan(input({agents: ['codex'], include: {skills: true, plugins: true, mcp: false}}));
    expect(plan.map(step => step.id)).toEqual(['codex:skills']);
  });

  it('skips MCP steps when no API key is available', () => {
    const plan = buildSetupPlan(input({agents: ['codex'], apiKey: undefined}));
    expect(plan[1].action).toMatchObject({type: 'skip', reason: expect.stringContaining('no API key')});
  });

  it('installs all skills and multiple plugins when requested', () => {
    const plan = buildSetupPlan(input({
      agents: ['claude-code', 'codex'],
      claudePlugins: ['bitmovin', 'bitmovin-player-web'],
      skills: {all: true, names: []},
      include: {skills: true, plugins: true, mcp: false},
    }));
    expect(plan.map(step => step.id)).toEqual([
      'claude-code:marketplace',
      'claude-code:plugin:bitmovin',
      'claude-code:plugin:bitmovin-player-web',
      'codex:skills',
    ]);
    expect((plan[3].action as {args: string[]}).args).toContain('*');
  });

  it('never leaks the API key into rendered plans', () => {
    const plan = buildSetupPlan(input({agents: ['claude-code', 'codex', 'cursor', 'gemini-cli']}));
    const rendered = renderPlan(plan, KEY);
    expect(rendered).not.toContain(KEY);
    expect(rendered).toContain('x-api-key: ***');
  });
});
