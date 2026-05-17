import { describe, expect, test } from "bun:test";
import type { AuthContext } from "../src/auth.ts";
import {
	isTokenExpired,
	loadAuth,
	loadAuthWithRefresh,
	refreshAuthIfNeeded,
	RefreshFailedError,
} from "../src/auth.ts";

/**
 * Build a fake JWT with a given payload. Header/signature are unused; only
 * the payload body is decoded by `decodeJwtExp`.
 */
function makeJwt(payload: Record<string, unknown>): string {
	const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const body = btoa(JSON.stringify(payload));
	return `${header}.${body}.fake-sig`;
}

describe("isTokenExpired", () => {
	test("returns true when exp < now (seconds)", () => {
		const now = new Date("2026-05-08T12:00:00.000Z");
		const exp = Math.floor(now.getTime() / 1000) - 60;
		const jwt = makeJwt({ sub: "u", exp });
		expect(isTokenExpired(jwt, now)).toBe(true);
	});

	test("returns false when exp > now (seconds)", () => {
		const now = new Date("2026-05-08T12:00:00.000Z");
		const exp = Math.floor(now.getTime() / 1000) + 60;
		const jwt = makeJwt({ sub: "u", exp });
		expect(isTokenExpired(jwt, now)).toBe(false);
	});

	test("treats exp === now as expired (boundary closed)", () => {
		const now = new Date("2026-05-08T12:00:00.000Z");
		const exp = Math.floor(now.getTime() / 1000);
		const jwt = makeJwt({ sub: "u", exp });
		expect(isTokenExpired(jwt, now)).toBe(true);
	});

	test("malformed token treated as expired (fail-closed)", () => {
		expect(isTokenExpired("not-a-jwt", new Date())).toBe(true);
	});

	test("missing exp claim treated as expired (fail-closed)", () => {
		const jwt = makeJwt({ sub: "u" });
		expect(isTokenExpired(jwt, new Date())).toBe(true);
	});
});

describe("loadAuth", () => {
	const now = new Date("2026-05-08T12:00:00.000Z");
	const futureExp = Math.floor(now.getTime() / 1000) + 3600;
	const pastExp = Math.floor(now.getTime() / 1000) - 60;

	test("returns AuthContext from injected reader + apiUrl", async () => {
		const token = makeJwt({ sub: "user-uuid-123", exp: futureExp });
		const ctx = await loadAuth({
			now,
			readCredentialsFn: async () => ({
				access_token: token,
				refresh_token: "r",
				email: "x@y.z",
				api_url: "http://localhost:63000",
			}),
			getApiUrlFn: async () => "http://localhost:63000",
		});
		expect(ctx).toEqual({
			token,
			apiUrl: "http://localhost:63000",
			userId: "user-uuid-123",
		});
	});

	test("throws clear error on missing credentials", async () => {
		await expect(
			loadAuth({
				now,
				readCredentialsFn: async () => null,
				getApiUrlFn: async () => "http://localhost:63000",
			}),
		).rejects.toThrow(/no credentials/i);
	});

	test("throws clear error on expired token", async () => {
		const token = makeJwt({ sub: "u", exp: pastExp });
		await expect(
			loadAuth({
				now,
				readCredentialsFn: async () => ({
					access_token: token,
					refresh_token: "r",
					email: "x@y.z",
					api_url: "http://localhost:63000",
				}),
				getApiUrlFn: async () => "http://localhost:63000",
			}),
		).rejects.toThrow(/expired/i);
	});

	test("throws when JWT has no `sub` claim", async () => {
		const token = makeJwt({ exp: futureExp });
		await expect(
			loadAuth({
				now,
				readCredentialsFn: async () => ({
					access_token: token,
					refresh_token: "r",
					email: "x@y.z",
					api_url: "http://localhost:63000",
				}),
				getApiUrlFn: async () => "http://localhost:63000",
			}),
		).rejects.toThrow(/sub/i);
	});

	test("passes profileName through to readers", async () => {
		const token = makeJwt({ sub: "user-uuid-123", exp: futureExp });
		const seen: string[] = [];
		await loadAuth({
			profileName: "agent-dev",
			now,
			readCredentialsFn: async (name) => {
				seen.push(`creds:${name ?? "<undef>"}`);
				return {
					access_token: token,
					refresh_token: "r",
					email: "x@y.z",
					api_url: "http://localhost:63000",
				};
			},
			getApiUrlFn: async (name) => {
				seen.push(`url:${name ?? "<undef>"}`);
				return "http://localhost:63000";
			},
		});
		expect(seen).toEqual(["creds:agent-dev", "url:agent-dev"]);
	});
});

describe("refreshAuthIfNeeded", () => {
	const now = new Date("2026-05-08T12:00:00.000Z");
	const nowSec = Math.floor(now.getTime() / 1000);

	function authCtx(token: string): AuthContext {
		return {
			token,
			apiUrl: "http://localhost:63000",
			userId: "user-uuid-123",
		};
	}

	test("returns same context when token has >5min remaining", async () => {
		const token = makeJwt({ sub: "user-uuid-123", exp: nowSec + 3600 });
		const calls: string[] = [];
		const result = await refreshAuthIfNeeded(authCtx(token), {
			now,
			refreshFn: async (url, opts) => {
				calls.push(`${url}|${opts?.profileName ?? "<undef>"}`);
				return "should-not-be-called";
			},
		});
		expect(result.token).toBe(token);
		expect(calls).toEqual([]);
	});

	test("refreshes when token is within 5min buffer", async () => {
		const stale = makeJwt({ sub: "user-uuid-123", exp: nowSec + 60 });
		const freshSub = "refreshed-user-uuid";
		const fresh = makeJwt({ sub: freshSub, exp: nowSec + 3600 });
		const calls: Array<{ url: string; profile: string | undefined }> = [];
		const result = await refreshAuthIfNeeded(authCtx(stale), {
			now,
			profileName: "local",
			refreshFn: async (url, opts) => {
				calls.push({ url, profile: opts?.profileName });
				return fresh;
			},
		});
		expect(result.token).toBe(fresh);
		expect(result.userId).toBe(freshSub);
		expect(result.apiUrl).toBe("http://localhost:63000");
		expect(calls).toEqual([
			{ url: "http://localhost:63000", profile: "local" },
		]);
	});

	test("refreshes when token is already expired", async () => {
		const expired = makeJwt({ sub: "user-uuid-123", exp: nowSec - 60 });
		const fresh = makeJwt({ sub: "user-uuid-123", exp: nowSec + 3600 });
		const result = await refreshAuthIfNeeded(authCtx(expired), {
			now,
			refreshFn: async () => fresh,
		});
		expect(result.token).toBe(fresh);
	});

	test("refreshes when token has no decodable exp claim (fail-closed)", async () => {
		const fresh = makeJwt({ sub: "user-uuid-123", exp: nowSec + 3600 });
		const result = await refreshAuthIfNeeded(authCtx("not-a-jwt"), {
			now,
			refreshFn: async () => fresh,
		});
		expect(result.token).toBe(fresh);
	});

	test("throws when refreshed token has no `sub` claim", async () => {
		const stale = makeJwt({ sub: "user-uuid-123", exp: nowSec + 60 });
		const fresh = makeJwt({ exp: nowSec + 3600 });
		await expect(
			refreshAuthIfNeeded(authCtx(stale), {
				now,
				refreshFn: async () => fresh,
			}),
		).rejects.toThrow(/sub/i);
	});

	test("propagates refreshFn errors so caller can decide", async () => {
		const stale = makeJwt({ sub: "user-uuid-123", exp: nowSec + 60 });
		await expect(
			refreshAuthIfNeeded(authCtx(stale), {
				now,
				refreshFn: async () => {
					throw new Error("Session expired. Run 'effi auth login' to refresh.");
				},
			}),
		).rejects.toThrow(/effi auth login/);
	});
});

/**
 * loadAuthWithRefresh (ENG-6035)
 *
 * Boot-path helper: try `loadAuth`; if it throws specifically because the
 * on-disk access token is expired, attempt a refresh against the on-disk
 * refresh_token (via `ensureFreshToken` semantics — read creds, refresh,
 * write back), then retry `loadAuth`. If refresh ALSO fails, propagate the
 * refresh error so the boot path can write an accurate `needs-auth.flag`.
 *
 * Distinction from `refreshAuthIfNeeded` (called from the hot path): that
 * one needs a valid AuthContext in hand to decide whether to refresh.
 * `loadAuthWithRefresh` handles the boot case where there is no AuthContext
 * yet — `loadAuth` blew up before producing one.
 */
describe("loadAuthWithRefresh", () => {
	const now = new Date("2026-05-17T08:00:00.000Z");
	const nowSec = Math.floor(now.getTime() / 1000);

	test("returns AuthContext directly when loadAuth succeeds; refreshFn NOT called", async () => {
		const token = makeJwt({ sub: "user-uuid-abc", exp: nowSec + 3600 });
		let refreshCalls = 0;
		const ctx = await loadAuthWithRefresh({
			now,
			readCredentialsFn: async () => ({
				access_token: token,
				refresh_token: "rt",
				email: "x@y.z",
				api_url: "http://localhost:63000",
			}),
			getApiUrlFn: async () => "http://localhost:63000",
			refreshFn: async () => {
				refreshCalls += 1;
				return "should-not-be-called";
			},
		});
		expect(ctx).toEqual({
			token,
			apiUrl: "http://localhost:63000",
			userId: "user-uuid-abc",
		});
		expect(refreshCalls).toBe(0);
	});

	test("on expired-token error: calls refreshFn, then retries loadAuth and returns the refreshed context", async () => {
		const expiredToken = makeJwt({ sub: "user-uuid-abc", exp: nowSec - 60 });
		const refreshedToken = makeJwt({
			sub: "user-uuid-abc",
			exp: nowSec + 3600,
		});
		// Stateful disk-stand-in: the first read returns the expired token;
		// after refreshFn runs (simulating `ensureFreshToken` writing new
		// creds), subsequent reads return the refreshed token.
		let currentAccessToken = expiredToken;
		const reads: string[] = [];
		const refreshCalls: Array<{
			apiUrl: string;
			profileName: string | undefined;
		}> = [];
		const ctx = await loadAuthWithRefresh({
			now,
			profileName: "agent-dev",
			readCredentialsFn: async () => {
				reads.push(currentAccessToken);
				return {
					access_token: currentAccessToken,
					refresh_token: "rt",
					email: "x@y.z",
					api_url: "http://localhost:63000",
				};
			},
			getApiUrlFn: async () => "http://localhost:63000",
			refreshFn: async (apiUrl, opts) => {
				refreshCalls.push({ apiUrl, profileName: opts?.profileName });
				currentAccessToken = refreshedToken;
				return refreshedToken;
			},
		});
		expect(ctx.token).toBe(refreshedToken);
		expect(ctx.userId).toBe("user-uuid-abc");
		expect(ctx.apiUrl).toBe("http://localhost:63000");
		expect(refreshCalls).toEqual([
			{ apiUrl: "http://localhost:63000", profileName: "agent-dev" },
		]);
		// loadAuth was called twice: once to discover the expiry, once after refresh.
		expect(reads).toHaveLength(2);
		expect(reads).toEqual([expiredToken, refreshedToken]);
	});

	test("on missing-credentials error: refreshFn NOT called, original error propagates", async () => {
		let refreshCalls = 0;
		await expect(
			loadAuthWithRefresh({
				now,
				readCredentialsFn: async () => null,
				getApiUrlFn: async () => "http://localhost:63000",
				refreshFn: async () => {
					refreshCalls += 1;
					return "should-not-be-called";
				},
			}),
		).rejects.toThrow(/no credentials/i);
		expect(refreshCalls).toBe(0);
	});

	test("on missing-sub error: refreshFn NOT called (refresh won't fix a malformed JWT)", async () => {
		const tokenNoSub = makeJwt({ exp: nowSec + 3600 });
		let refreshCalls = 0;
		await expect(
			loadAuthWithRefresh({
				now,
				readCredentialsFn: async () => ({
					access_token: tokenNoSub,
					refresh_token: "rt",
					email: "x@y.z",
					api_url: "http://localhost:63000",
				}),
				getApiUrlFn: async () => "http://localhost:63000",
				refreshFn: async () => {
					refreshCalls += 1;
					return "should-not-be-called";
				},
			}),
		).rejects.toThrow(/sub/i);
		expect(refreshCalls).toBe(0);
	});

	test("when refresh ALSO fails (e.g. invalid_grant): wraps in RefreshFailedError with cause set, message preserves upstream so caller can classify as `source: \"refresh\"`", async () => {
		const expiredToken = makeJwt({ sub: "user-uuid-abc", exp: nowSec - 60 });
		// Distinctive sentinel only the refresh path can produce — proves the
		// caller sees the refresh failure, not the original "token is expired"
		// loadAuth complaint. `diagnoseErrorClass({source:'refresh', ...})` is
		// what wants this — it always returns `expired_refresh_token`, but the
		// errorMessage on the flag should be the upstream refresh message so a
		// human grepping logs can tell apart invalid_grant vs network.
		const REFRESH_SENTINEL = "REFRESH_API_INVALID_GRANT_SENTINEL";
		let refreshCalls = 0;
		let caught: unknown;
		try {
			await loadAuthWithRefresh({
				now,
				readCredentialsFn: async () => ({
					access_token: expiredToken,
					refresh_token: "rt",
					email: "x@y.z",
					api_url: "http://localhost:63000",
				}),
				getApiUrlFn: async () => "http://localhost:63000",
				refreshFn: async () => {
					refreshCalls += 1;
					throw new Error(REFRESH_SENTINEL);
				},
			});
		} catch (err) {
			caught = err;
		}
		expect(refreshCalls).toBe(1);
		expect(caught).toBeInstanceOf(RefreshFailedError);
		const wrapped = caught as RefreshFailedError;
		expect(wrapped.message).toBe(REFRESH_SENTINEL);
		expect(wrapped.cause).toBeInstanceOf(Error);
		expect(wrapped.cause.message).toBe(REFRESH_SENTINEL);
		expect(wrapped.name).toBe("RefreshFailedError");
	});

	test("when refresh succeeds but the refreshed token has no `sub` claim, propagates the missing-sub error (not RefreshFailedError)", async () => {
		const expiredToken = makeJwt({ sub: "user-uuid-abc", exp: nowSec - 60 });
		// Refreshed token is well-formed timing-wise but missing `sub` — the
		// second `loadAuth` should hit its own missing-sub branch and throw a
		// plain Error, NOT a RefreshFailedError (the refresh itself succeeded).
		const refreshedTokenNoSub = makeJwt({ exp: nowSec + 3600 });
		let currentAccessToken = expiredToken;
		let refreshCalls = 0;
		let caught: unknown;
		try {
			await loadAuthWithRefresh({
				now,
				readCredentialsFn: async () => ({
					access_token: currentAccessToken,
					refresh_token: "rt",
					email: "x@y.z",
					api_url: "http://localhost:63000",
				}),
				getApiUrlFn: async () => "http://localhost:63000",
				refreshFn: async () => {
					refreshCalls += 1;
					currentAccessToken = refreshedTokenNoSub;
					return refreshedTokenNoSub;
				},
			});
		} catch (err) {
			caught = err;
		}
		expect(refreshCalls).toBe(1);
		expect(caught).toBeInstanceOf(Error);
		expect(caught).not.toBeInstanceOf(RefreshFailedError);
		expect((caught as Error).message).toMatch(/sub/i);
	});
});
