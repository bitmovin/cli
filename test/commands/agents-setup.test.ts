import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {SetupStep} from '../../src/lib/agents/planner.js';

vi.mock('../../src/lib/config.js', () => {
  let store: Record<string, any> = {};
  return {
    loadConfig: () => ({...store}),
    saveConfig: (config: any) => {
      store = {...config};
    },
    getConfigPath: () => '/mock/.config/bitmovin/config.json',
    _reset: () => {
      store = {};
    },
    _getStore: () => store,
  };
});

vi.mock('../../src/lib/agents/detect.js', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/lib/agents/detect.js')>();
  return {
    ...original,
    detectAgents: vi.fn(() => ({
      'claude-code': {installed: true, via: 'bin', binPath: '/mock/bin/claude'},
      codex: {installed: true, via: 'config-dir'},
      'gemini-cli': {installed: false, via: 'none'},
      cursor: {installed: false, via: 'none'},
      pi: {installed: false, via: 'none'},
    })),
  };
});

vi.mock('../../src/lib/agents/execute.js', () => ({
  executeStep: vi.fn(async () => ({status: 'ok'})),
}));

const configMock = await import('../../src/lib/config.js') as any;
const {detectAgents} = await import('../../src/lib/agents/detect.js');
const {executeStep} = await import('../../src/lib/agents/execute.js');
const executeStepMock = vi.mocked(executeStep);

const KEY = 'secret-key-abc-123';

function captureOutput(): {output: () => string; restore: () => void} {
  let captured = '';
  const stdoutMock = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  });
  const stderrMock = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  });
  const logMock = vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
    captured += args.join(' ') + '\n';
  });
  return {
    output: () => captured,
    restore: () => {
      stdoutMock.mockRestore();
      stderrMock.mockRestore();
      logMock.mockRestore();
    },
  };
}

async function runSetup(argv: string[]): Promise<void> {
  const {default: AgentsSetup} = await import('../../src/commands/agents/setup.js');
  await AgentsSetup.run(argv);
}

describe('agents setup', () => {
  const savedApiKeyEnv = process.env.BITMOVIN_API_KEY;

  beforeEach(() => {
    configMock._reset();
    executeStepMock.mockClear();
    executeStepMock.mockImplementation(async () => ({status: 'ok'}));
    vi.mocked(detectAgents).mockClear();
    delete process.env.BITMOVIN_API_KEY;
  });

  afterEach(() => {
    if (savedApiKeyEnv === undefined) delete process.env.BITMOVIN_API_KEY;
    else process.env.BITMOVIN_API_KEY = savedApiKeyEnv;
  });

  it('executes the planned steps for --agent codex --yes', async () => {
    const cap = captureOutput();
    await runSetup(['--agent', 'codex', '--yes', '--api-key', KEY]);
    cap.restore();

    const steps = executeStepMock.mock.calls.map(call => (call[0] as SetupStep).id);
    expect(steps).toEqual(['codex:skills', 'codex:mcp']);
    expect(cap.output()).toContain('2 done');
    expect(cap.output()).not.toContain(KEY);
  });

  it('sets up all detected agents with --all-agents', async () => {
    const cap = captureOutput();
    await runSetup(['--all-agents', '--yes', '--api-key', KEY]);
    cap.restore();

    const steps = executeStepMock.mock.calls.map(call => (call[0] as SetupStep).id);
    expect(steps).toEqual([
      'claude-code:marketplace',
      'claude-code:plugin:bitmovin',
      'claude-code:mcp',
      'codex:skills',
      'codex:mcp',
    ]);
  });

  it('does not execute anything in --dry-run and never prints the key', async () => {
    const cap = captureOutput();
    await runSetup(['--dry-run', '--api-key', KEY]);
    cap.restore();

    expect(executeStepMock).not.toHaveBeenCalled();
    expect(cap.output()).toContain('Dry run');
    expect(cap.output()).toContain('x-api-key: ***');
    expect(cap.output()).not.toContain(KEY);
  });

  it('keeps running remaining steps after a failure and exits 1', async () => {
    executeStepMock.mockImplementation(async (step: SetupStep) =>
      step.id === 'codex:skills' ? {status: 'failed', detail: 'boom'} : {status: 'ok'},
    );

    const cap = captureOutput();
    await expect(runSetup(['--agent', 'codex', '--yes', '--api-key', KEY])).rejects.toMatchObject({oclif: {exit: 1}});
    cap.restore();

    expect(executeStepMock.mock.calls.map(call => (call[0] as SetupStep).id)).toEqual(['codex:skills', 'codex:mcp']);
    expect(cap.output()).toContain('1 failed');
  });

  it('requires --agent or --all-agents when non-interactive', async () => {
    const cap = captureOutput();
    await expect(runSetup(['--yes'])).rejects.toThrow(/--agent/);
    cap.restore();
    expect(executeStepMock).not.toHaveBeenCalled();
  });

  it('requires an API key for MCP setup when non-interactive', async () => {
    const cap = captureOutput();
    await expect(runSetup(['--agent', 'codex', '--yes'])).rejects.toThrow(/API key/);
    cap.restore();
    expect(executeStepMock).not.toHaveBeenCalled();
  });

  it('proceeds without a key when MCP is disabled', async () => {
    const cap = captureOutput();
    await runSetup(['--agent', 'codex', '--yes', '--no-mcp']);
    cap.restore();
    expect(executeStepMock.mock.calls.map(call => (call[0] as SetupStep).id)).toEqual(['codex:skills']);
  });

  it('uses the API key from the config store', async () => {
    configMock.saveConfig({apiKey: KEY});
    const cap = captureOutput();
    await runSetup(['--agent', 'codex', '--yes']);
    cap.restore();
    expect(executeStepMock.mock.calls.map(call => (call[0] as SetupStep).id)).toEqual(['codex:skills', 'codex:mcp']);
    expect(cap.output()).not.toContain(KEY);
  });

  it('emits skip results for undetected agents that were forced', async () => {
    const cap = captureOutput();
    await runSetup(['--agent', 'pi', '--yes', '--api-key', KEY]);
    cap.restore();

    const steps = executeStepMock.mock.calls.map(call => (call[0] as SetupStep));
    expect(steps.map(step => step.id)).toEqual(['pi:skills', 'pi:mcp']);
    // pi MCP is unsupported → planner emits a skip action, executor reports skipped
    expect(steps[1].action.type).toBe('skip');
  });

  it('outputs a machine-readable plan and results in --json mode', async () => {
    const cap = captureOutput();
    await runSetup(['--agent', 'codex', '--yes', '--api-key', KEY, '--json']);
    cap.restore();

    const jsonStart = cap.output().indexOf('{');
    const parsed = JSON.parse(cap.output().slice(jsonStart));
    expect(parsed.plan.map((step: any) => step.id)).toEqual(['codex:skills', 'codex:mcp']);
    expect(parsed.results).toEqual([
      {id: 'codex:skills', status: 'ok'},
      {id: 'codex:mcp', status: 'ok'},
    ]);
    expect(cap.output()).not.toContain(KEY);
  });
});
