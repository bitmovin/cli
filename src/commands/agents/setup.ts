import {homedir} from 'node:os';
import {Flags} from '@oclif/core';
import chalk from 'chalk';
import {BaseCommand} from '../../lib/base-command.js';
import {loadConfig, saveConfig, getConfigPath} from '../../lib/config.js';
import {resolveApiKey} from '../../lib/api-key.js';
import {AGENTS, AGENT_IDS, DEFAULT_CLAUDE_PLUGIN, DEFAULT_SKILL, type AgentId} from '../../lib/agents/registry.js';
import {detectAgents, type DetectionMap} from '../../lib/agents/detect.js';
import {buildSetupPlan, type SetupStep} from '../../lib/agents/planner.js';
import {executeStep, type StepResult} from '../../lib/agents/execute.js';
import {renderAction, renderPlan} from '../../lib/agents/render.js';

const DASHBOARD_ACCOUNT_URL = 'https://dashboard.bitmovin.com/account';

export default class AgentsSetup extends BaseCommand {
  static override description = 'Set up AI coding agents with Bitmovin skills, plugins, and the MCP server';

  static override examples = [
    'bitmovin agents setup',
    'bitmovin agents setup --all-agents --yes',
    'bitmovin agents setup --agent claude-code --agent cursor --yes',
    'bitmovin agents setup --agent codex --no-skills --yes',
    'bitmovin agents setup --dry-run',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
    agent: Flags.string({
      char: 'a',
      description: 'Agent to set up (repeatable); forces setup even when the agent is not detected',
      multiple: true,
      options: AGENT_IDS,
      exclusive: ['all-agents'],
    }),
    'all-agents': Flags.boolean({description: 'Set up all detected agents'}),
    skills: Flags.boolean({description: 'Install Bitmovin skills', default: true, allowNo: true}),
    mcp: Flags.boolean({description: 'Connect the Bitmovin MCP server', default: true, allowNo: true}),
    plugins: Flags.boolean({description: 'Install Claude Code plugins (claude-code only)', default: true, allowNo: true}),
    skill: Flags.string({description: 'Skill to install (repeatable)', multiple: true, exclusive: ['all-skills']}),
    'all-skills': Flags.boolean({description: 'Install all available skills'}),
    plugin: Flags.string({description: 'Claude Code plugin to install (repeatable)', multiple: true}),
    yes: Flags.boolean({char: 'y', description: 'Skip all prompts (requires --agent or --all-agents)'}),
    'dry-run': Flags.boolean({description: 'Show what would be done without changing anything'}),
  };

  async run(): Promise<void> {
    const {flags, metadata} = await this.parse(AgentsSetup);
    const jsonMode = await this.isJsonMode();
    const dryRun = Boolean(flags['dry-run']);
    const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) && !flags.yes && !dryRun && !jsonMode;

    const detection = detectAgents((flags.agent ?? []) as AgentId[]);
    const detected = AGENT_IDS.filter(id => detection[id].installed);

    const agents = await this.selectAgents(flags, detection, detected, {interactive, dryRun});
    if (agents.length === 0) {
      this.error('No agents selected.', {exit: 2});
    }

    const componentFlagsGiven = ['skills', 'mcp', 'plugins'].some(name => metadata.flags?.[name]?.setFromDefault === false);
    let include = {skills: flags.skills, mcp: flags.mcp, plugins: flags.plugins};
    if (interactive && !componentFlagsGiven) {
      include = await this.promptComponents(include, agents.includes('claude-code'));
    }

    let apiKey = resolveApiKey(loadConfig(), flags['api-key'] as string | undefined).value;
    if (include.mcp && apiKey === undefined) {
      if (interactive) {
        const answer = await this.promptApiKey();
        if (answer === undefined) {
          include = {...include, mcp: false};
          this.log(chalk.dim('Skipping MCP setup.'));
        } else {
          apiKey = answer;
        }
      } else if (!dryRun) {
        this.error(
          'Connecting the MCP server requires an API key.\n' +
          '  Provide --api-key, set BITMOVIN_API_KEY, or run `bitmovin config set api-key <key>`.\n' +
          `  Get an API key at ${DASHBOARD_ACCOUNT_URL}\n` +
          '  Or pass --no-mcp to skip MCP setup.',
          {exit: 2},
        );
      }
    }

    const plan = buildSetupPlan({
      home: homedir(),
      agents,
      include,
      apiKey,
      claudePlugins: dedupe(flags.plugin ?? [DEFAULT_CLAUDE_PLUGIN]),
      skills: {all: Boolean(flags['all-skills']), names: dedupe(flags.skill ?? [DEFAULT_SKILL])},
      detection,
    });

    if (plan.length === 0) {
      this.log('Nothing to do.');
      return;
    }

    if (dryRun) {
      if (jsonMode) {
        await this.outputData({dryRun: true, plan: plan.map(step => serializeStep(step, apiKey))});
      } else {
        this.log(chalk.bold('Dry run — no changes will be made:\n'));
        this.log(renderPlan(plan, apiKey));
      }

      return;
    }

    if (interactive) {
      this.log('');
      this.log(renderPlan(plan, apiKey));
      this.log('');
      const {confirm} = await import('@inquirer/prompts');
      const proceed = await confirm({message: `Run ${plan.filter(step => step.action.type !== 'skip').length} step(s)?`, default: true});
      if (!proceed) {
        this.log('Aborted.');
        return;
      }
    }

    const results = await this.executePlan(plan, apiKey, {jsonMode, quiet: Boolean(flags.quiet)});

    if (jsonMode) {
      await this.outputData({
        plan: plan.map(step => serializeStep(step, apiKey)),
        results: results.map((result, index) => ({id: plan[index].id, ...result, detail: redact(result.detail, apiKey)})),
      });
    } else {
      this.printSummary(results);
    }

    if (results.some(result => result.status === 'failed')) {
      this.exit(1);
    }
  }

  private async selectAgents(
    flags: {agent?: string[]; 'all-agents'?: boolean},
    detection: DetectionMap,
    detected: AgentId[],
    mode: {interactive: boolean; dryRun: boolean},
  ): Promise<AgentId[]> {
    if (flags.agent?.length) return dedupe(flags.agent) as AgentId[];

    if (flags['all-agents'] || mode.dryRun) {
      if (detected.length === 0) {
        this.error('No AI coding agents detected on this machine.', {exit: 2});
      }

      return detected;
    }

    if (!mode.interactive) {
      const hint = detected.length > 0
        ? `Detected agents: ${detected.join(', ')}\n  Example: bitmovin agents setup --all-agents --yes`
        : 'No agents were detected; use --agent <id> to force setup.';
      this.error(`Specify --agent <id> or --all-agents when running non-interactively.\n  ${hint}`, {exit: 2});
    }

    const {checkbox} = await import('@inquirer/prompts');
    const selected = await checkbox<AgentId>({
      message: 'Which agents should be set up?',
      choices: AGENT_IDS.map(id => ({
        name: detection[id].installed ? AGENTS[id].label : `${AGENTS[id].label} (not detected — will attempt anyway)`,
        value: id,
        checked: detection[id].installed,
      })),
    });

    // Selecting an undetected agent in the wizard is an explicit choice, same as --agent.
    for (const id of selected) {
      if (!detection[id].installed) detection[id] = {installed: true, via: 'forced'};
    }

    return selected;
  }

  private async promptComponents(
    defaults: {skills: boolean; mcp: boolean; plugins: boolean},
    hasClaudeCode: boolean,
  ): Promise<{skills: boolean; mcp: boolean; plugins: boolean}> {
    const {checkbox} = await import('@inquirer/prompts');
    const choices = [
      {name: 'Skills (AI assistant instructions)', value: 'skills', checked: defaults.skills},
      {name: 'MCP server (live access to Bitmovin APIs)', value: 'mcp', checked: defaults.mcp},
      ...(hasClaudeCode ? [{name: 'Claude Code plugins (skills via the plugin marketplace)', value: 'plugins', checked: defaults.plugins}] : []),
    ];
    const selected = await checkbox<string>({message: 'What should be set up?', choices});
    return {
      skills: selected.includes('skills'),
      mcp: selected.includes('mcp'),
      plugins: hasClaudeCode ? selected.includes('plugins') : defaults.plugins,
    };
  }

  /** Returns the API key, or undefined when the user chooses to skip MCP setup. */
  private async promptApiKey(): Promise<string | undefined> {
    const {confirm, password, select} = await import('@inquirer/prompts');
    this.log('Connecting the MCP server requires a Bitmovin API key.');
    const choice = await select<string>({
      message: 'No API key found — how do you want to proceed?',
      choices: [
        {name: 'Paste an API key', value: 'paste'},
        {name: `Open ${DASHBOARD_ACCOUNT_URL} to get one, then paste it`, value: 'open'},
        {name: 'Skip MCP setup', value: 'skip'},
      ],
    });
    if (choice === 'skip') return undefined;
    if (choice === 'open') {
      const {default: open} = await import('open');
      await open(DASHBOARD_ACCOUNT_URL);
    }

    const key = (await password({message: 'Bitmovin API key:', mask: '*'})).trim();
    if (!key) return undefined;

    const save = await confirm({message: `Save this key to ${getConfigPath()}?`, default: true});
    if (save) {
      saveConfig({...loadConfig(), apiKey: key});
    }

    return key;
  }

  private async executePlan(
    plan: SetupStep[],
    apiKey: string | undefined,
    output: {jsonMode: boolean; quiet: boolean},
  ): Promise<StepResult[]> {
    const showProgress = !output.jsonMode && !output.quiet;
    const useSpinner = showProgress && Boolean(process.stderr.isTTY);
    const results: StepResult[] = [];

    for (const step of plan) {
      let spinner: {succeed: (text: string) => void; warn: (text: string) => void; fail: (text: string) => void} | undefined;
      if (useSpinner) {
        const {default: ora} = await import('ora');
        spinner = ora(step.title).start();
      }

      const result = await executeStep(step);
      results.push(result);

      const detail = redact(result.detail, apiKey);
      const line = detail ? `${step.title} — ${detail}` : step.title;
      if (spinner) {
        if (result.status === 'ok') spinner.succeed(line);
        else if (result.status === 'skipped') spinner.warn(chalk.dim(line));
        else spinner.fail(chalk.red(line));
      } else if (showProgress) {
        const mark = result.status === 'ok' ? chalk.green('✓') : (result.status === 'skipped' ? chalk.yellow('↷') : chalk.red('✗'));
        this.log(`${mark} ${line}`);
      }
    }

    return results;
  }

  private printSummary(results: StepResult[]): void {
    const count = (status: StepResult['status']): number => results.filter(result => result.status === status).length;
    const parts = [
      chalk.green(`${count('ok')} done`),
      ...(count('skipped') > 0 ? [chalk.yellow(`${count('skipped')} skipped`)] : []),
      ...(count('failed') > 0 ? [chalk.red(`${count('failed')} failed`)] : []),
    ];
    this.log('');
    this.log(parts.join(', '));
  }
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function redact(text: string | undefined, apiKey: string | undefined): string | undefined {
  if (text === undefined || apiKey === undefined || apiKey === '') return text;
  return text.split(apiKey).join('***');
}

function serializeStep(step: SetupStep, apiKey: string | undefined): Record<string, unknown> {
  return {
    id: step.id,
    agent: step.agent,
    category: step.category,
    title: step.title,
    action: renderAction(step.action, apiKey),
  };
}
