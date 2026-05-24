/**
 * The "stop billing" mechanic — snapshot a box, then delete its server — in one
 * place so `box down` (interactive) and `box watch` (the auto-down daemon) take
 * the EXACT same path. Centralising it means a forgotten-box auto-down is
 * byte-for-byte the action a human would run, and the load-bearing guarantee
 * lives once: if the snapshot fails we do NOT delete the server (never lose state
 * to a half-finished teardown).
 *
 * IO (it shells out via {@link runHcloud}, streaming progress with `inherit`), so
 * it's validated live rather than unit-tested; the callers' pure decision logic
 * (confirmation, lease/TTL) is what carries the tests.
 */

import { buildSnapshotArgs, runHcloud } from "./hcloud";
import { snapshotSelector } from "./config";

export interface DownResult {
  ok: boolean;
  /** Present on failure — a one-line, user-facing reason. */
  error?: string;
  /** The failing hcloud exit code, so a caller can propagate it. */
  code?: number;
}

/**
 * Snapshot `name` (capturing the built devcontainer image + repo), then delete
 * the server. Returns `{ ok: true }` on success, or `{ ok: false, error, code }`
 * if either step fails. On snapshot failure the server is left untouched (still
 * billing) — surfaced in the error so the caller can tell the user.
 */
export function snapshotAndDeleteServer(name: string): DownResult {
  console.error(`Snapshotting '${name}' (captures the built devcontainer image + repo) ...`);
  const snap = runHcloud(
    buildSnapshotArgs({
      name,
      description: `${name} ${new Date().toISOString().replace(/\.\d+Z$/, "Z")}`,
      label: snapshotSelector(name),
    }),
    { inherit: true },
  );
  if (snap.code !== 0) {
    return { ok: false, code: snap.code, error: `snapshot failed (exit ${snap.code}); NOT deleting the server.` };
  }

  console.error("Deleting server (snapshot is kept) ...");
  const del = runHcloud(["server", "delete", name], { inherit: true });
  if (del.code !== 0) {
    return {
      ok: false,
      code: del.code,
      error: `server delete failed (exit ${del.code}). The snapshot was created; the server still exists and is billing.`,
    };
  }

  return { ok: true };
}
