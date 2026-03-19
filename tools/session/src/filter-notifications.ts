/**
 * Filter task-notification turns from session output.
 *
 * When background agents complete in Claude Code, their results are delivered
 * as user turns containing `<task-notification>` XML tags. In long sessions,
 * these can number in the dozens and push real conversation content out of
 * view when using `--last N`.
 *
 * This module provides a pure filter function and a predicate for identifying
 * notification turns.
 */

import type { Turn } from "./types";

/**
 * Returns true if the turn contains a `<task-notification>` XML tag.
 *
 * Only matches the literal XML open tag — not casual mentions like
 * "I checked the task notification".
 */
export function isNotificationTurn(turn: Turn): boolean {
  return turn.text.includes("<task-notification>");
}

/**
 * Remove all task-notification turns from the array.
 *
 * Designed to be applied BEFORE windowing (--since-turn / --last) so that
 * `--last 20` returns 20 real turns, not 20 minus however many were notifications.
 */
export function filterNotifications(turns: Turn[]): Turn[] {
  return turns.filter((t) => !isNotificationTurn(t));
}
