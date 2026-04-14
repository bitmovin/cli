import {execFileSync} from 'node:child_process';

export function applyJq(json: string, expression: string): string {
  try {
    return execFileSync('jq', [expression], {
      input: json,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trimEnd();
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException & {stderr?: Buffer | string};
    if (err.code === 'ENOENT') {
      throw new Error('jq is required for --jq. Install it: https://jqlang.github.io/jq/download/');
    }

    const stderr = err.stderr?.toString().trim();
    throw new Error(`jq error: ${stderr || err.message}`);
  }
}
