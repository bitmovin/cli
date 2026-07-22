import type {SetupStep, StepAction} from './planner.js';

/** One-line human rendering of what a step will do, with the API key masked. */
export function renderAction(action: StepAction, apiKey?: string): string {
  const text = describe(action);
  return apiKey ? text.split(apiKey).join('***') : text;
}

function describe(action: StepAction): string {
  switch (action.type) {
    case 'skip':
      return `skipped — ${action.reason}`;
    case 'exec': {
      const args = action.args.map((arg, index) => (action.redact?.includes(index) ? maskArg(arg) : arg));
      return `run: ${baseName(action.bin)} ${args.join(' ')}`;
    }

    case 'npx-skills':
      return `run: npx ${action.args.join(' ')}`;
    case 'merge-json':
      return `write ${action.file} (${action.jsonPath.join('.')})`;
    case 'ensure-toml-block':
      return `append [${action.table}] to ${action.file}`;
  }
}

/** Masks the value part of a "Header: value" arg, or the whole arg. */
function maskArg(arg: string): string {
  const colon = arg.indexOf(':');
  return colon === -1 ? '***' : `${arg.slice(0, colon)}: ***`;
}

function baseName(bin: string): string {
  const parts = bin.split(/[/\\]/);
  return parts.at(-1) ?? bin;
}

export function renderPlan(steps: SetupStep[], apiKey?: string): string {
  const lines: string[] = [];
  let currentAgent = '';
  for (const step of steps) {
    if (step.agent !== currentAgent) {
      if (lines.length > 0) lines.push('');
      lines.push(`${step.agent}:`);
      currentAgent = step.agent;
    }

    lines.push(`  ${step.title}`);
    lines.push(`    ${renderAction(step.action, apiKey)}`);
  }

  return lines.join('\n');
}
