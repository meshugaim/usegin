/**
 * Push-lease renew core — pure. No IO.
 *
 * The in-container renew daemon (`box renew`, slice 3 of the push-lease bake)
 * runs INSIDE a work box. Each pass it checks whether Claude is actively working
 * (a recent JSONL write under ~/.claude/projects) and, if so, pushes a lease
 * renewal to the mgmt box's lease server (`lease-server.ts`). When work stops,
 * it stops renewing; the mgmt reaper (`box watch`) then downs the idle box.
 *
 * This module is the pure middle — the activity gate and the URL builder — so the
 * two load-bearing decisions are exhaustively unit-testable with no fs and no
 * socket. The thin IO (glob the JSONL mtimes, `fetch` the URL, loop) lives in
 * `commands/renew.ts`.
 *
 * The activity model mirrors `tools/bin/ona-keep-alive-while-claude-working`:
 * a JSONL write within the buffer window = a live session. We swap that script's
 * gitpod keep-alive for a curl to the mgmt lease server.
 */

/**
 * True if any JSONL mtime is within `bufferMs` of `now` — i.e. a session wrote
 * recently enough to count as active. Pure: (mtimes, now, bufferMs) → boolean.
 *
 * Boundary is inclusive (`age === bufferMs` → active), matching
 * `decideLeaseAction`'s inclusive deadlines: the edge of the window still counts,
 * biasing toward keeping a borderline-active box alive rather than letting it die
 * one tick early (the false-down we lean against everywhere in this subsystem).
 *
 * An empty list → false (no sessions → nothing to keep alive). A future mtime
 * (clock skew, age < 0) is trivially within any non-negative buffer, so it counts
 * as active — the safe direction.
 */
export function hasRecentActivity(
  mtimes: Date[],
  now: Date,
  bufferMs: number,
): boolean {
  const nowMs = now.getTime();
  return mtimes.some((m) => nowMs - m.getTime() <= bufferMs);
}

/**
 * Build the lease-renew URL the daemon curls:
 *   `http://<mgmtName>:<port>/lease/renew?box=<encoded>`
 * Pure: opts → string. The box name is `encodeURIComponent`-encoded so a name
 * with spaces or reserved characters round-trips through the server's
 * `parseLeaseRequest` (which reads + trims the `box` query param) intact.
 */
export function buildRenewUrl(opts: {
  mgmtName: string;
  port: number;
  box: string;
}): string {
  return `http://${opts.mgmtName}:${opts.port}/lease/renew?box=${encodeURIComponent(opts.box)}`;
}
