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
} from "../../effi-cli/src/lib/credentials.ts";
import { decodeJwtExp } from "../../effi-cli/src/lib/jwt.ts";

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
	/** Override the credentials reader; defaults to `effi-cli/credentials.ts`. */
	readCredentialsFn?: (
		profileName?: string,
	) => Promise<CredentialsShape | null>;
	/** Override the api-url resolver; defaults to `effi-cli/credentials.ts`. */
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
 * decode failure or if `sub` is missing/non-string.
 */
function decodeJwtSub(token: string): string | null {
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

export async function loadAuth(
	opts: LoadAuthOptions = {},
): Promise<AuthContext> {
	const now = opts.now ?? new Date();
	const readCredentialsFn = opts.readCredentialsFn ?? defaultReadCredentials;
	const getApiUrlFn = opts.getApiUrlFn ?? defaultGetApiUrl;

	const creds = await readCredentialsFn(opts.profileName);
	if (!creds) {
		throw new Error(
			"session-sync: no credentials. Run `effi auth login` to authenticate, then restart the daemon.",
		);
	}
	if (isTokenExpired(creds.access_token, now)) {
		throw new Error(
			"session-sync: dev-login token is expired. Run `effi auth login` to refresh, then restart the daemon.",
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
