import {Flags} from '@oclif/core';

/**
 * Confirmation for actions that cannot be undone.
 *
 * The prompt import stays lazy (matching `agents setup`) and the policy lives here
 * rather than in the commands, so every destructive command shares one behaviour
 * instead of each inventing its own. `encoding jobs delete` and `encoding jobs stop`
 * can adopt {@link confirmDestructive} without a fourth variant.
 */

/** `--yes` / `-y` (alias `--confirm`) for any command guarded by {@link confirmDestructive}. */
export const yesFlag = Flags.boolean({
  char: 'y',
  aliases: ['confirm'],
  description: 'Skip the confirmation prompt (required for non-interactive use)',
  default: false,
});

/** Whether an interactive prompt can be shown at all. */
export function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Resolves to true only on an explicit yes; defaults to no. */
export async function confirmAction(message: string): Promise<boolean> {
  const {confirm} = await import('@inquirer/prompts');
  return confirm({message, default: false});
}

/**
 * The outcome of the gate.
 *
 * `unconfirmable` means we could not ask and were not told to proceed — the caller
 * must fail rather than act. Keeping that a distinct outcome (instead of `false`) is
 * deliberate: "the user said no" and "nobody could be asked" deserve different exit
 * codes, and collapsing them is how a scripted run ends up filing something silently.
 */
export type ConfirmOutcome = 'proceed' | 'declined' | 'unconfirmable';

/**
 * Decides whether a destructive action may proceed.
 *
 * Fails closed: without `--yes`, a non-TTY (either direction) or JSON mode yields
 * `unconfirmable`, never `proceed`.
 */
export async function confirmDestructive(options: {jsonMode: boolean; yes: boolean; question: string}): Promise<ConfirmOutcome> {
  if (options.yes) return 'proceed';
  if (options.jsonMode || !canPrompt()) return 'unconfirmable';
  return (await confirmAction(options.question)) ? 'proceed' : 'declined';
}
