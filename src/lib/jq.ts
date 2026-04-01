import {execFileSync} from 'node:child_process';

export function applyJq(json: string, expression: string): string {
  try {
    return execFileSync('jq', [expression], {
      input: json,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trimEnd();
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error('jq is required for --jq. Install it: https://jqlang.github.io/jq/download/');
    }

    const stderr = error.stderr?.toString().trim();
    throw new Error(`jq error: ${stderr || error.message}`);
  }
}
