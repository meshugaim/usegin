import { describe, expect, test } from "bun:test";
import type { AuthContext } from "../src/auth.ts";
import { isTokenExpired, loadAuth, refreshAuthIfNeeded } from "../src/auth.ts";

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
