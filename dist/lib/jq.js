import { execFileSync } from 'node:child_process';
export function applyJq(json, expression) {
    try {
        return execFileSync('jq', [expression], {
            input: json,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trimEnd();
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error('jq is required for --jq. Install it: https://jqlang.github.io/jq/download/');
        }
        const stderr = error.stderr?.toString().trim();
        throw new Error(`jq error: ${stderr || error.message}`);
    }
}
//# sourceMappingURL=jq.js.map