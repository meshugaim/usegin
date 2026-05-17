/**
 * Auth helpers for the session-sync daemon (AC 22 — startup auth check).
 *
 * Reads the dev-login token from the Effi CLI's profile-aware credentials
 * store, decodes the JWT for the `sub` claim, and surfaces a clear error
 * if the token is missing or expired (the daemon's main entrypoint is
 * expected to log + exit, not crash-loop, on these failures).
 *
 * I/O is dependency-injected (`readCredentialsFn`, `getApiUrlFn`) so the
 * unit tests don't touch the real `~/.effi/` directory or the JWT lib.
 */

import {
	getApiUrl as defaultGetApiUrl,
	readCredentials as defaultReadCredentials,
} from "../../lib/auth/credentials.ts";
import { decodeJwtExp } from "../../lib/auth/jwt.ts";
import { ensureFreshToken as defaultEnsureFreshToken } from "../../lib/auth/token-refresh.ts";

/**
 * Refresh the token when fewer than this many seconds remain. Matches
 * the buffer used inside `ensureFreshToken` itself — we duplicate the
 * check here so we skip the disk read entirely on the hot path.
 */
const REFRESH_BUFFER_SECONDS = 5 * 60;

export interface AuthContext {
	/** The dev-login JWT — sent as `Authorization: Bearer <token>`. */
	token: string;
	/** Next.js base URL, e.g. `http://localhost:63000`. */
	apiUrl: string;
	/** auth.users.id, extracted from the JWT `sub` claim. */
	userId: string;
}

interface CredentialsShape {
	access_token: string;
	refresh_token: string;
	email: string;
	api_url: string;
}

export interface LoadAuthOptions {
	/** Effi CLI profile name (defaults to active/current). */
	profileName?: string;
	/** Now-clock — injected for tests, defaults to `new Date()`. */
	now?: Date;
	/** Override the credentials reader; defaults to `tools/lib/auth/credentials.ts`. */
	readCredentialsFn?: (
		profileName?: string,
	) => Promise<CredentialsShape | null>;
	/** Override the api-url resolver; defaults to `tools/lib/auth/credentials.ts`. */
	getApiUrlFn?: (profileName?: string) => Promise<string>;
}

/**
 * True when the JWT's `exp` claim is at-or-before `now`. Malformed tokens or
 * tokens missing the claim are treated as expired (fail-closed: better to
 * tell the user "your session expired, re-auth" than to send a junk token).
 */
export function isTokenExpired(token: string, now: Date): boolean {
	const exp = decodeJwtExp(token);
	if (exp === null) return true;
	const nowSeconds = Math.floor(now.getTime() / 1000);
	return exp <= nowSeconds;
}

/**
 * Decode the `sub` claim (user UUID) from a JWT body. Returns null on any
 * decode failure or if `sub` is missing/non-string. Used by both
 * `loadAuth` (startup) and `refreshAuthIfNeeded` (rotation).
 */
export function decodeJwtSub(token: string): string | null {
	try {
		const part = token.split(".")[1];
		if (!part) return null;
		const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
		const payload = JSON.parse(atob(b64)) as { sub?: unknown };
		return typeof payload.sub === "string" && payload.sub.length > 0
			? payload.sub
			: null;
	} catch {
		return null;
	}
}

export interface RefreshAuthOptions {
	/** Profile to read/write — must match what `loadAuth` was called with. */
	profileName?: string;
	/** Now-clock — injected for tests. */
	now?: Date;
	/**
	 * Override the refresh primitive; defaults to `ensureFreshToken` from
	 * `tools/lib/auth/token-refresh.ts`. The override receives the api-url
	 * + an options bag with `profileName` so credentials I/O stays scoped
	 * to the daemon's profile.
	 */
	refreshFn?: (
		apiUrl: string,
		opts: { profileName?: string },
	) => Promise<string>;
}

/**
 * Keep the daemon's `AuthContext` fresh across the JWT's ~1h lifetime.
 *
 * Hot-path contract: if the current token has more than `REFRESH_BUFFER_SECONDS`
 * remaining, returns the input context unchanged (no I/O). Otherwise calls
 * the refresh primitive — which reads/writes the profile's credentials.json
 * and rotates against Supabase — then re-derives `userId` from the new token's
 * `sub` claim.
 *
 * If the refresh succeeds but the new token is unchanged (already-fresh path
 * inside `ensureFreshToken`), we still re-decode `sub` so a caller mutating a
 * shared context stays consistent.
 *
 * Refresh failures (revoked refresh_token, network blip, supabase outage)
 * propagate so the caller can decide whether to skip-and-retry or surface.
 * For the daemon the policy is skip-and-retry — see `cli.ts:fireSync`.
 */
export async function refreshAuthIfNeeded(
	auth: AuthContext,
	opts: RefreshAuthOptions = {},
): Promise<AuthContext> {
	const now = opts.now ?? new Date();
	const exp = decodeJwtExp(auth.token);
	const nowSec = Math.floor(now.getTime() / 1000);
	if (exp !== null && exp - nowSec > REFRESH_BUFFER_SECONDS) {
		return auth;
	}
	const refreshFn = opts.refreshFn ?? defaultEnsureFreshToken;
	const newToken = await refreshFn(auth.apiUrl, {
		profileName: opts.profileName,
	});
	if (newToken === auth.token) return auth;
	const sub = decodeJwtSub(newToken);
	if (!sub) {
		throw new Error(
			"session-sync: refreshed token is missing `sub` claim — refusing to use.",
		);
	}
	return { token: newToken, apiUrl: auth.apiUrl, userId: sub };
}

export interface LoadAuthWithRefreshOptions extends LoadAuthOptions {
	/**
	 * Override the refresh primitive; defaults to `ensureFreshToken` from
	 * `tools/lib/auth/token-refresh.ts`. Same shape as
	 * `RefreshAuthOptions.refreshFn`.
	 */
	refreshFn?: (
		apiUrl: string,
		opts: { profileName?: string },
	) => Promise<string>;
}

/**
 * Sentinel substring that uniquely identifies the "access token is past
 * its `exp` but the refresh_token may still be good" error thrown by
 * `loadAuth`. We match on this exact phrase rather than catching every
 * loadAuth throw — missing credentials and a malformed JWT (`sub`
 * missing) are NOT recoverable via refresh, and a blanket retry would
 * waste a refresh API call (and hide a true bug) for those cases.
 *
 * Used as the catch-sentinel in `loadAuthWithRefresh` below; interpolated
 * into the throw site in `loadAuth` so the constant is the single source
 * of truth (no compiler-invisible lockstep).
 */
const EXPIRED_TOKEN_ERROR_SENTINEL = "dev-login token is expired";

/**
 * Tagged error thrown by `loadAuthWithRefresh` when the refresh attempt
 * itself fails (not when the initial `loadAuth` fails for any reason).
 *
 * Callers branch on `err instanceof RefreshFailedError` to classify the
 * boot-time failure as `source: "refresh"` for `diagnoseErrorClass`:
 *
 *   - `source: "loadAuth"`  → initial probe failed (missing creds, no `sub`,
 *                             or expired access_token with refresh attempt
 *                             never reached).
 *   - `source: "refresh"`   → access_token was expired, refresh attempt ran
 *                             and ALSO failed (invalid_grant, network blip).
 *
 * Today both paths classify identically inside `diagnoseErrorClass`, but
 * the distinction is load-bearing for ENG-6034 (loud notification on
 * `expired_refresh_token`, quiet retry on `network`). Wrapping the original
 * error here makes the boot path supply the truthful source so future
 * `diagnoseErrorClass` branches actually fire.
 *
 * The original error is preserved on `cause` so the upstream message
 * (e.g. invalid_grant detail) reaches `needs-auth.flag.errorMessage` for
 * a human grepping logs.
 */
export class RefreshFailedError extends Error {
	override readonly cause: Error;
	constructor(cause: Error) {
		super(cause.message);
		this.cause = cause;
		this.name = "RefreshFailedError";
	}
}

/**
 * Boot-path variant of `loadAuth` with one-shot auto-refresh (ENG-6035).
 *
 * Try `loadAuth`. On success → return. On the specific
 * "dev-login token is expired" error (and only that one — see the
 * sentinel comment above), resolve the api-url, call the refresh
 * primitive against the on-disk refresh_token, then retry `loadAuth`.
 *
 * Why this exists: the daemon often boots into a long-paused
 * devcontainer where the ~1h JWT has lapsed but the refresh_token is
 * still good. The old boot path threw straight into `needs-auth`,
 * stranding the daemon until a human ran `effi auth refresh && pm2
 * restart session-sync`. With this helper, the daemon does the
 * refresh itself on boot — matching what `effi auth refresh` would
 * do manually.
 *
 * On refresh failure (invalid_grant, network blip): the refresh error
 * is wrapped in `RefreshFailedError` with the original error preserved
 * on `.cause` (and `super(cause.message)` so `(err as Error).message`
 * still surfaces the upstream message). The caller branches on
 * `instanceof RefreshFailedError` to feed `source: "refresh"` into
 * `diagnoseErrorClass`, so ENG-6034's `expired_refresh_token` vs
 * `network` distinction can fire. The upstream message lands in
 * `needs-auth.flag.errorMessage` for a human grepping logs.
 *
 * Note on the duplicate refresh primitive: `refreshAuthIfNeeded` (this
 * file) and `ensureFreshToken` (`tools/lib/auth/token-refresh.ts`)
 * share intent but differ in input — the former takes an AuthContext,
 * the latter reads creds from disk. This helper needs the latter shape
 * because there is no AuthContext yet (loadAuth blew up before
 * producing one). Unifying them is out of scope here and tracked under
 * ENG-6036 (filed under parent ENG-5989).
 */
export async function loadAuthWithRefresh(
	opts: LoadAuthWithRefreshOptions = {},
): Promise<AuthContext> {
	try {
		return await loadAuth(opts);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (!message.includes(EXPIRED_TOKEN_ERROR_SENTINEL)) {
			throw err;
		}
		// Access token expired — try refresh against on-disk refresh_token.
		const refreshFn = opts.refreshFn ?? defaultEnsureFreshToken;
		const getApiUrlFn = opts.getApiUrlFn ?? defaultGetApiUrl;
		const apiUrl = await getApiUrlFn(opts.profileName);
		// Refresh failures are wrapped in RefreshFailedError so the caller
		// (cli.ts boot path) can branch on `instanceof` and classify via
		// diagnoseErrorClass({source:'refresh', ...}). The original error's
		// message is preserved on `.cause` (and via super(cause.message)) so
		// the upstream message reaches `needs-auth.flag.errorMessage`.
		try {
			await refreshFn(apiUrl, { profileName: opts.profileName });
		} catch (refreshErr) {
			const cause =
				refreshErr instanceof Error
					? refreshErr
					: new Error(String(refreshErr));
			throw new RefreshFailedError(cause);
		}
		// Refresh wrote fresh creds to disk; retry the load. Override the
		// api-url resolver to return the already-resolved value so we don't
		// re-do the I/O (and the disk read happens through `readCredentialsFn`
		// once more, which is the actual point of the retry).
		return await loadAuth({ ...opts, getApiUrlFn: async () => apiUrl });
	}
}

export async function loadAuth(
	opts: LoadAuthOptions = {},
): Promise<AuthContext> {
	const now = opts.now ?? new Date();
	const readCredentialsFn = opts.readCredentialsFn ?? defaultReadCredentials;
	const getApiUrlFn = opts.getApiUrlFn ?? defaultGetApiUrl;

	const creds = await readCredentialsFn(opts.profileName);
	if (!creds) {
		throw new Error(
			"session-sync: no credentials. Run `effi auth login` to authenticate.",
		);
	}
	if (isTokenExpired(creds.access_token, now)) {
		throw new Error(
			`session-sync: ${EXPIRED_TOKEN_ERROR_SENTINEL}. Run \`effi auth refresh\` (or \`effi auth login\`) to refresh.`,
		);
	}
	const sub = decodeJwtSub(creds.access_token);
	if (!sub) {
		throw new Error(
			"session-sync: dev-login token is missing `sub` claim. Run `effi auth login` to refresh.",
		);
	}
	const apiUrl = await getApiUrlFn(opts.profileName);
	return { token: creds.access_token, apiUrl, userId: sub };
}
