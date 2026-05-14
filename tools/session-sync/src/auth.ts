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
			"session-sync: dev-login token is expired. Run `effi auth refresh` (or `effi auth login`) to refresh.",
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
