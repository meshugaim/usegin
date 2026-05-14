/**
 * Tests for `error-classify.ts` (ENG-5990, T5 + T5b).
 *
 * Pure function. Covers the auth/lock/network discrimination across the
 * canonical input shapes: thrown Errors from auth.ts/token-refresh.ts,
 * sync-client `transport_error` envelopes, lock_held / not_holder
 * envelopes. The 403 carve-out is load-bearing — a regression that
 * collapses all 403s into `auth` would silently flip the daemon to
 * `needs-auth` on every lock-release race.
 */

import { describe, expect, test } from "bun:test";
import { classifyError } from "../src/error-classify.ts";

describe("classifyError — thrown errors", () => {
	test("loadAuth 'no credentials' → auth", () => {
		expect(
			classifyError(
				new Error(
					"session-sync: no credentials. Run `effi auth login` to authenticate.",
				),
			),
		).toBe("auth");
	});

	test("expired token error → auth", () => {
		expect(
			classifyError(new Error("session-sync: dev-login token is expired.")),
		).toBe("auth");
	});

	test("missing sub claim → auth", () => {
		expect(
			classifyError(
				new Error("session-sync: dev-login token is missing `sub` claim."),
			),
		).toBe("auth");
	});

	test("invalid_grant from refresh → auth", () => {
		expect(classifyError(new Error("refresh failed: invalid_grant"))).toBe(
			"auth",
		);
	});

	test("revoked refresh_token → auth", () => {
		expect(classifyError(new Error("refresh_token revoked by server"))).toBe(
			"auth",
		);
	});

	test("ECONNREFUSED on .code → network", () => {
		const err = new Error("connect ECONNREFUSED 127.0.0.1:63000") as Error & {
			code?: string;
		};
		err.code = "ECONNREFUSED";
		expect(classifyError(err)).toBe("network");
	});

	test("EAI_AGAIN on .cause.code → network", () => {
		const err = new Error("getaddrinfo EAI_AGAIN api.askeffi.ai") as Error & {
			cause?: { code?: string };
		};
		err.cause = { code: "EAI_AGAIN" };
		expect(classifyError(err)).toBe("network");
	});

	test("connect-timeout (UND_ERR_CONNECT_TIMEOUT) → network", () => {
		const err = new Error("fetch failed") as Error & { code?: string };
		err.code = "UND_ERR_CONNECT_TIMEOUT";
		expect(classifyError(err)).toBe("network");
	});

	test("unknown error shape → network (safer default)", () => {
		expect(classifyError(new Error("something went wrong"))).toBe("network");
	});
});

describe("classifyError — sync-client envelopes", () => {
	test("transport_error 401 → auth", () => {
		expect(
			classifyError({
				kind: "transport_error",
				status: 401,
				body: { error: "unauthorized" },
			}),
		).toBe("auth");
	});

	test("transport_error 403 with auth body → auth", () => {
		expect(
			classifyError({
				kind: "transport_error",
				status: 403,
				body: { error: "expired_token" },
			}),
		).toBe("auth");
	});

	test("transport_error 403 with {kind:'unauthorized'} body → auth", () => {
		expect(
			classifyError({
				kind: "transport_error",
				status: 403,
				body: { kind: "unauthorized" },
			}),
		).toBe("auth");
	});

	test("transport_error 403 with not_holder body → lock (carve-out)", () => {
		expect(
			classifyError({
				kind: "transport_error",
				status: 403,
				body: { error: "not_holder" },
			}),
		).toBe("lock");
	});

	test("transport_error 500 → network", () => {
		expect(
			classifyError({
				kind: "transport_error",
				status: 500,
				body: "internal server error",
			}),
		).toBe("network");
	});

	test("transport_error 503 sync_disabled → network", () => {
		expect(
			classifyError({
				kind: "transport_error",
				status: 503,
				body: { error: "sync_disabled" },
			}),
		).toBe("network");
	});

	test("lock_held envelope → lock", () => {
		expect(
			classifyError({
				kind: "lock_held",
				holder: { environment_kind: "x", environment_id: "y" },
			}),
		).toBe("lock");
	});

	test("not_holder envelope (DeleteLock 403) → lock", () => {
		expect(classifyError({ kind: "not_holder", body: {} })).toBe("lock");
	});
});
