/**
 * Daemon username resolution (ENG-6040).
 *
 * Extracted from `cli.ts` so the pure function is testable without
 * dragging in the daemon's full transitive deps (zod, supabase-js, …).
 */
import dx from "../../dx/sdk.ts";

/**
 * Resolve the canonical username for this daemon process.
 *
 * Priority:
 *   1. `dx.resolveUser()` — the team's canonical identity (e.g., "lihu")
 *      derived from `.dx/config.json` aliases against env signals
 *      (USER/whoami/gitUserName/gitUserEmail).
 *   2. `env.USER` / `env.USERNAME` — POSIX/Windows fallback. In our cloud
 *      devcontainers this returns `vscode`, which is what shipped before
 *      ENG-6040 and what caused the `username` field to split across
 *      rows for the same auth user.
 *   3. `"unknown"` — sentinel for environments with neither.
 *
 * Falling back instead of throwing keeps the daemon bootable on machines
 * where `.dx/config.json` isn't reachable (a fresh box with the repo
 * cloned to an unusual cwd, a deployment context that doesn't ship
 * `.dx/`). The daemon is operational without dx; it just loses the
 * canonical-identity benefit until the config is in place.
 *
 * `dxResolveUser` is dependency-injected so the unit test doesn't need
 * a real `.dx/config.json` on disk.
 */
export function resolveDaemonUsername(
	env: NodeJS.ProcessEnv,
	dxResolveUser: () => string | null = dx.resolveUser,
): string {
	try {
		const resolved = dxResolveUser();
		if (resolved !== null && resolved.length > 0) return resolved;
	} catch {
		// dx.getContext() throws when .dx/config.json isn't reachable. That's
		// recoverable — fall through to the env fallback.
	}
	return env.USER ?? env.USERNAME ?? "unknown";
}
