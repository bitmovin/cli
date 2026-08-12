/**
 * Interactive confirmation for actions that cannot be undone.
 *
 * Kept separate from the commands so the prompt import stays lazy (matching
 * `agents setup`) and so tests can stub it without pulling in a TTY.
 */

/** Whether an interactive prompt can be shown at all. */
export function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Resolves to true only on an explicit yes; defaults to no. */
export async function confirmAction(message: string): Promise<boolean> {
  const {confirm} = await import('@inquirer/prompts');
  return confirm({message, default: false});
}
