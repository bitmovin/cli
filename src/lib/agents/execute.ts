import {spawn} from 'node:child_process';
import {mergeJsonFile, type MergeResult} from './json-file.js';
import {ensureTomlBlock} from './toml-block.js';
import type {SetupStep, StepAction} from './planner.js';

export interface StepResult {
  status: 'ok' | 'skipped' | 'failed';
  detail?: string;
}

const ALREADY_PATTERN = /already (exists|installed|added|configured)/i;

interface ExecOutcome {
  code: number;
  output: string;
}

function runCaptured(bin: string, args: string[]): Promise<ExecOutcome> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', code => resolve({code: code ?? 1, output}));
  });
}

function outputTail(output: string, lines = 4): string {
  return output.trim().split('\n').slice(-lines).join('\n').trim();
}

export async function executeStep(step: SetupStep): Promise<StepResult> {
  try {
    return await dispatch(step.action);
  } catch (err) {
    return {status: 'failed', detail: err instanceof Error ? err.message : String(err)};
  }
}

async function dispatch(action: StepAction): Promise<StepResult> {
  switch (action.type) {
    case 'skip':
      return {status: 'skipped', detail: action.reason};

    case 'exec': {
      if (action.probe) {
        const probe = await runCaptured(action.bin, action.probe.args);
        if (probe.code === 0) {
          return {status: 'skipped', detail: 'already configured'};
        }
      }

      const result = await runCaptured(action.bin, action.args);
      if (result.code === 0) return {status: 'ok'};
      if (action.tolerateAlready && ALREADY_PATTERN.test(result.output)) {
        return {status: 'skipped', detail: 'already configured'};
      }

      return {status: 'failed', detail: outputTail(result.output) || `exited with code ${result.code}`};
    }

    case 'npx-skills': {
      const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const result = await runCaptured(command, action.args);
      if (result.code === 0) return {status: 'ok'};
      return {status: 'failed', detail: outputTail(result.output) || `npx skills exited with code ${result.code}`};
    }

    case 'merge-json':
      return fromMergeResult(mergeJsonFile(action.file, action.jsonPath, action.value), action.file);

    case 'ensure-toml-block':
      return fromMergeResult(ensureTomlBlock(action.file, action.table, action.block), action.file);
  }
}

function fromMergeResult(result: MergeResult, file: string): StepResult {
  if (result.status === 'unchanged') return {status: 'skipped', detail: 'already configured'};
  const detail = result.created ? `created ${file}` : `updated ${file}${result.backupPath ? ` (backup: ${result.backupPath})` : ''}`;
  return {status: 'ok', detail};
}
