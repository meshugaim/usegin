/**
 * Unit tests for `scripts/backfill.ts` (ENG-5863 AC 27).
 *
 * Covers the pure helpers (filename parse, stale-dir skip, subagent skip,
 * arg parsing, concurrency limiter) and the orchestration in `processFile`
 * with a mocked `postSync`. Filesystem touches use `tmpdir()`.
 */

import { describe, expect, it } from "bun:test";
import {
	mkdtempSync,
	mkdirSync,
	writeFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import type { AuthContext } from "../src/auth.ts";
import type {
	SyncRequest,
	SyncResponse,
} from "../src/sync-client.ts";
import {
	type BackfillOptions,
	type FileOutcome,
	existsRemote,
	isInsideStaleDir,
	isSubagentPath,
	parseArchiveFilename,
	parseArgs,
	processFile,
	runWithConcurrency,
	walkArchive,
} from "./backfill.ts";

const FIXTURE_AUTH: AuthContext = {
	token: "test-token",
	apiUrl: "http://localhost:0",
	userId: "user-uuid-test",
};

const BASE_OPTS: BackfillOptions = {
	sourceDir: "/tmp/archive",
	envIdSuffix: "lihub",
	username: "lihu",
	projectPath: "/agent-records/lihub",
	dryRun: false,
	maxConcurrency: 4,
	force: false,
};

const fakeExistsRemoteFalse = async (): Promise<boolean> => false;
const fakeExistsRemoteTrue = async (): Promise<boolean> => true;

function tmproot(): { root: string; cleanup: () => void } {
	const root = mkdtempSync(join(tmpdir(), "backfill-test-"));
	return {
		root,
		cleanup: () => {
			try {
				rmSync(root, { recursive: true, force: true });
			} catch {
				/* ignore */
			}
		},
	};
}

function makeArchive(dir: string, filename: string, jsonl: string): string {
	mkdirSync(dir, { recursive: true });
	const abs = join(dir, filename);
	writeFileSync(abs, gzipSync(Buffer.from(jsonl, "utf-8")));
	return abs;
}

// Two-line JSONL: user + assistant.
const SAMPLE_JSONL = [
	JSON.stringify({
		type: "user",
		gitBranch: "main",
		gitSha: "abc1234",
		message: { role: "user", content: "hello" },
	}),
	JSON.stringify({
		type: "assistant",
		message: {
			role: "assistant",
			model: "claude-opus-4-7",
			content: "hi",
		},
	}),
	"",
].join("\n");

describe("parseArchiveFilename", () => {
	it("accepts the canonical archive shape", () => {
		const r = parseArchiveFilename(
			"114426-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
		);
		expect(r).toEqual({
			sessionId: "7c99a7ed-e185-435c-b888-dac13dd1aad1",
		});
	});

	it("rejects missing time prefix", () => {
		expect(
			parseArchiveFilename(
				"conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
			),
		).toBeNull();
	});

	it("rejects non-UUID session id", () => {
		expect(
			parseArchiveFilename("114426-conversation-not-a-uuid.jsonl.gz"),
		).toBeNull();
	});

	it("rejects subagent filename shape", () => {
		expect(parseArchiveFilename("agent-abc123def4567890a.jsonl.gz")).toBeNull();
	});

	it("rejects ungzipped jsonl", () => {
		expect(
			parseArchiveFilename(
				"114426-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl",
			),
		).toBeNull();
	});

	it("rejects path-traversal-style filenames", () => {
		expect(
			parseArchiveFilename(
				"../etc-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
			),
		).toBeNull();
	});
});

describe("isInsideStaleDir", () => {
	it("flags message-bad-credentials-* path", () => {
		expect(
			isInsideStaleDir(
				"/home/x/agent-records/message-bad-credentials-documentation-url-https-docs-github-com-rest-status-401/2026-04/foo.jsonl.gz",
			),
		).toBe(true);
	});

	it("flags message-requires-authentication-* path", () => {
		expect(
			isInsideStaleDir(
				"/home/x/agent-records/message-requires-authentication-documentation-url-https-docs-github-com-rest-status-401/2026-04/foo.jsonl.gz",
			),
		).toBe(true);
	});

	it("does not flag normal dev subtrees", () => {
		expect(
			isInsideStaleDir("/home/x/agent-records/lihub/2026-05/foo.jsonl.gz"),
		).toBe(false);
	});

	it("does not match on substring (must be a path component)", () => {
		// The stale-dir name as part of a filename, not a directory, should pass.
		expect(
			isInsideStaleDir(
				"/home/x/agent-records/lihub/2026-05/note-about-message-bad-credentials.txt",
			),
		).toBe(false);
	});
});

describe("isSubagentPath", () => {
	it("flags /subagents/ in path", () => {
		expect(
			isSubagentPath("/foo/bar/subagents/agent-1234567890abcdef0.jsonl.gz"),
		).toBe(true);
	});

	it("flags agent- prefix filename", () => {
		expect(isSubagentPath("/foo/agent-1234567890abcdef0.jsonl.gz")).toBe(true);
	});

	it("passes a normal parent archive", () => {
		expect(
			isSubagentPath(
				"/foo/bar/2026-05-13/114426-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
			),
		).toBe(false);
	});
});

describe("parseArgs", () => {
	it("requires --source-dir", () => {
		expect(() => parseArgs([])).toThrow(/--source-dir is required/);
	});

	it("derives env-id-suffix from basename(--source-dir)", () => {
		const o = parseArgs(["--source-dir", "/home/x/agent-records/lihub"]);
		expect("help" in o).toBe(false);
		if ("help" in o) return;
		expect(o.envIdSuffix).toBe("lihub");
		expect(o.username).toBe("lihub");
		expect(o.projectPath).toBe("/agent-records/lihub");
	});

	it("honors all overrides", () => {
		const o = parseArgs([
			"--source-dir",
			"/x/y",
			"--env-id-suffix",
			"custom",
			"--username",
			"lihu",
			"--project-path",
			"/p",
			"--dry-run",
			"--max-concurrency",
			"8",
		]);
		if ("help" in o) throw new Error("expected options");
		expect(o.envIdSuffix).toBe("custom");
		expect(o.username).toBe("lihu");
		expect(o.projectPath).toBe("/p");
		expect(o.dryRun).toBe(true);
		expect(o.maxConcurrency).toBe(8);
	});

	it("returns help sentinel for --help", () => {
		const o = parseArgs(["--help"]);
		expect("help" in o && o.help === true).toBe(true);
	});

	it("rejects negative concurrency", () => {
		expect(() =>
			parseArgs(["--source-dir", "/x", "--max-concurrency", "0"]),
		).toThrow(/--max-concurrency must be a positive integer/);
	});

	it("rejects unknown args", () => {
		expect(() => parseArgs(["--bogus"])).toThrow(/Unknown arg/);
	});
});

describe("runWithConcurrency", () => {
	it("preserves input order in the output array", async () => {
		const out = await runWithConcurrency([1, 2, 3, 4], 2, async (x) => x * 10);
		expect(out).toEqual([10, 20, 30, 40]);
	});

	it("respects the concurrency limit", async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		await runWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((r) => setTimeout(r, 5));
			inFlight -= 1;
		});
		expect(maxInFlight).toBeLessThanOrEqual(2);
	});

	it("handles empty input", async () => {
		const out = await runWithConcurrency<number, number>([], 4, async (x) => x);
		expect(out).toEqual([]);
	});
});

describe("existsRemote", () => {
	it("returns true on HTTP 200", async () => {
		const fakeFetch = (async () =>
			new Response(JSON.stringify({ session: {} }), { status: 200 })) as unknown as typeof fetch;
		const result = await existsRemote(FIXTURE_AUTH, "abc", fakeFetch);
		expect(result).toBe(true);
	});

	it("returns false on HTTP 404", async () => {
		const fakeFetch = (async () =>
			new Response("nope", { status: 404 })) as unknown as typeof fetch;
		const result = await existsRemote(FIXTURE_AUTH, "abc", fakeFetch);
		expect(result).toBe(false);
	});

	it("throws on any other status (5xx, 401, ...)", async () => {
		const fakeFetch = (async () =>
			new Response("server error", { status: 500 })) as unknown as typeof fetch;
		await expect(existsRemote(FIXTURE_AUTH, "abc", fakeFetch)).rejects.toThrow(/HTTP 500/);
	});

	it("builds the correct URL with Authorization header", async () => {
		let capturedUrl = "";
		let capturedAuth = "";
		const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
			capturedUrl = url.toString();
			capturedAuth = String(
				(init?.headers as Record<string, string> | undefined)?.Authorization ?? "",
			);
			return new Response("", { status: 404 });
		}) as unknown as typeof fetch;
		await existsRemote(FIXTURE_AUTH, "my-session-id", fakeFetch);
		expect(capturedUrl).toBe("http://localhost:0/api/v1/dev-sessions/my-session-id");
		expect(capturedAuth).toBe("Bearer test-token");
	});
});

describe("walkArchive", () => {
	it("walks recursively and returns absolute paths", async () => {
		const { root, cleanup } = tmproot();
		try {
			makeArchive(
				join(root, "2026-05/2026-05-13"),
				"114426-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
				SAMPLE_JSONL,
			);
			makeArchive(
				join(root, "2026-05/2026-05-14"),
				"094500-conversation-0a344324-81fc-4da6-adcc-dfe15ad6a3ba.jsonl.gz",
				SAMPLE_JSONL,
			);
			const files = await walkArchive(root);
			expect(files.length).toBe(2);
			expect(files.every((f) => f.startsWith(root))).toBe(true);
		} finally {
			cleanup();
		}
	});

	it("returns empty on a directory with no .jsonl.gz", async () => {
		const { root, cleanup } = tmproot();
		try {
			writeFileSync(join(root, "README.md"), "hi");
			const files = await walkArchive(root);
			expect(files).toEqual([]);
		} finally {
			cleanup();
		}
	});
});

describe("processFile", () => {
	it("dry-run: parses metadata, returns dry_run, does not POST", async () => {
		const { root, cleanup } = tmproot();
		try {
			const abs = makeArchive(
				join(root, "2026-05-13"),
				"114426-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
				SAMPLE_JSONL,
			);
			let postCalled = false;
			const fakePostSync = async (): Promise<SyncResponse> => {
				postCalled = true;
				throw new Error("should not be called in dry-run");
			};

			const outcome = await processFile(
				abs,
				FIXTURE_AUTH,
				{ ...BASE_OPTS, dryRun: true },
				fakePostSync,
				fakeExistsRemoteTrue,
			);

			expect(outcome.kind).toBe("dry_run");
			expect(outcome.sessionId).toBe(
				"7c99a7ed-e185-435c-b888-dac13dd1aad1",
			);
			expect(outcome.detail).toMatch(/turns=2/);
			expect(postCalled).toBe(false);
		} finally {
			cleanup();
		}
	});

	it("uploaded: POSTs with file + metadata + hash, returns uploaded", async () => {
		const { root, cleanup } = tmproot();
		try {
			const abs = makeArchive(
				join(root, "2026-05-13"),
				"114426-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
				SAMPLE_JSONL,
			);
			let captured: SyncRequest | null = null;
			const fakePostSync = async (req: SyncRequest): Promise<SyncResponse> => {
				captured = req;
				return {
					ok: true,
					status: 200,
					body: { session: { session_id: req.sessionId } },
				};
			};

			const outcome = await processFile(
				abs,
				FIXTURE_AUTH,
				BASE_OPTS,
				fakePostSync,
				fakeExistsRemoteFalse,
			);

			expect(outcome.kind).toBe("uploaded");
			expect(captured).not.toBeNull();
			const sent = captured as unknown as SyncRequest;
			expect(sent.sessionId).toBe("7c99a7ed-e185-435c-b888-dac13dd1aad1");
			expect(sent.contentHash).toMatch(/^[0-9a-f]{64}$/);
			expect(sent.metadata.environment_kind).toBe("ona");
			expect(sent.metadata.environment_id).toBe("backfill-lihub");
			expect(sent.metadata.username).toBe("lihu");
			expect(sent.metadata.turn_count).toBe(2);
			expect(sent.metadata.git_branch).toBe("main");
			expect(sent.metadata.git_sha).toBe("abc1234");
			expect(sent.metadata.claude_model).toBe("claude-opus-4-7");
			expect(sent.fileBytes.byteLength).toBeGreaterThan(0);
		} finally {
			cleanup();
		}
	});

	it("skipped_stale_dir: never decompresses files inside stale-dir paths", async () => {
		const { root, cleanup } = tmproot();
		try {
			const staleDir = join(
				root,
				"message-bad-credentials-documentation-url-https-docs-github-com-rest-status-401/2026-04",
			);
			const abs = makeArchive(
				staleDir,
				"094500-conversation-0a344324-81fc-4da6-adcc-dfe15ad6a3ba.jsonl.gz",
				SAMPLE_JSONL,
			);
			let postCalled = false;
			const fakePostSync = async (): Promise<SyncResponse> => {
				postCalled = true;
				return { ok: true, status: 200, body: { session: {} } };
			};
			const outcome = await processFile(
				abs,
				FIXTURE_AUTH,
				BASE_OPTS,
				fakePostSync,
				fakeExistsRemoteFalse,
			);
			expect(outcome.kind).toBe("skipped_stale_dir");
			expect(postCalled).toBe(false);
		} finally {
			cleanup();
		}
	});

	it("skipped_subagent: agent- prefix is not processed", async () => {
		const { root, cleanup } = tmproot();
		try {
			const abs = makeArchive(
				root,
				"agent-1234567890abcdef0.jsonl.gz",
				SAMPLE_JSONL,
			);
			let postCalled = false;
			const fakePostSync = async (): Promise<SyncResponse> => {
				postCalled = true;
				return { ok: true, status: 200, body: { session: {} } };
			};
			const outcome = await processFile(
				abs,
				FIXTURE_AUTH,
				BASE_OPTS,
				fakePostSync,
				fakeExistsRemoteFalse,
			);
			expect(outcome.kind).toBe("skipped_subagent");
			expect(postCalled).toBe(false);
		} finally {
			cleanup();
		}
	});

	it("skipped_unmatched: filename that doesn't match the regex", async () => {
		const { root, cleanup } = tmproot();
		try {
			const abs = makeArchive(root, "weird-filename.jsonl.gz", SAMPLE_JSONL);
			const fakePostSync = async (): Promise<SyncResponse> => {
				throw new Error("should not be called");
			};
			const outcome = await processFile(
				abs,
				FIXTURE_AUTH,
				BASE_OPTS,
				fakePostSync,
				fakeExistsRemoteFalse,
			);
			expect(outcome.kind).toBe("skipped_unmatched");
		} finally {
			cleanup();
		}
	});

	it("error: server returns transport_error", async () => {
		const { root, cleanup } = tmproot();
		try {
			const abs = makeArchive(
				join(root, "2026-05-13"),
				"114426-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
				SAMPLE_JSONL,
			);
			const fakePostSync = async (): Promise<SyncResponse> => ({
				ok: false,
				kind: "transport_error",
				status: 500,
				body: { error: "server is sad" },
				syncDisabled: false,
			});
			const outcome = await processFile(
				abs,
				FIXTURE_AUTH,
				BASE_OPTS,
				fakePostSync,
				fakeExistsRemoteFalse,
			);
			expect(outcome.kind).toBe("error");
			expect(outcome.detail).toMatch(/status=500/);
		} finally {
			cleanup();
		}
	});

	it("error: gunzip fails on non-gzipped bytes", async () => {
		const { root, cleanup } = tmproot();
		try {
			// Write a non-gzipped file with the right name shape.
			mkdirSync(join(root, "2026-05-13"), { recursive: true });
			const abs = join(
				root,
				"2026-05-13",
				"114426-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
			);
			writeFileSync(abs, "this is not gzipped at all");
			const fakePostSync = async (): Promise<SyncResponse> => {
				throw new Error("should not be called");
			};
			const outcome = await processFile(
				abs,
				FIXTURE_AUTH,
				BASE_OPTS,
				fakePostSync,
				fakeExistsRemoteFalse,
			);
			expect(outcome.kind).toBe("error");
			expect(outcome.detail).toMatch(/gunzip/);
		} finally {
			cleanup();
		}
	});

	it("skipped_existing: pre-existing row → no decompress, no POST", async () => {
		const { root, cleanup } = tmproot();
		try {
			const abs = makeArchive(
				join(root, "2026-05-13"),
				"114426-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
				SAMPLE_JSONL,
			);
			let postCalled = false;
			const fakePostSync = async (): Promise<SyncResponse> => {
				postCalled = true;
				return { ok: true, status: 200, body: { session: {} } };
			};
			const outcome = await processFile(
				abs,
				FIXTURE_AUTH,
				BASE_OPTS,
				fakePostSync,
				fakeExistsRemoteTrue,
			);
			expect(outcome.kind).toBe("skipped_existing");
			expect(outcome.sessionId).toBe(
				"7c99a7ed-e185-435c-b888-dac13dd1aad1",
			);
			expect(postCalled).toBe(false);
		} finally {
			cleanup();
		}
	});

	it("force: pre-existing row → re-POST despite existsRemote=true", async () => {
		const { root, cleanup } = tmproot();
		try {
			const abs = makeArchive(
				join(root, "2026-05-13"),
				"114426-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
				SAMPLE_JSONL,
			);
			let postCalled = false;
			let existsCalled = false;
			const fakePostSync = async (): Promise<SyncResponse> => {
				postCalled = true;
				return { ok: true, status: 200, body: { session: {} } };
			};
			const fakeExists = async (): Promise<boolean> => {
				existsCalled = true;
				return true;
			};
			const outcome = await processFile(
				abs,
				FIXTURE_AUTH,
				{ ...BASE_OPTS, force: true },
				fakePostSync,
				fakeExists,
			);
			expect(outcome.kind).toBe("uploaded");
			expect(postCalled).toBe(true);
			expect(existsCalled).toBe(false); // pre-check bypassed under --force
		} finally {
			cleanup();
		}
	});

	it("error: existsRemote throws → surfaces error, does not POST", async () => {
		const { root, cleanup } = tmproot();
		try {
			const abs = makeArchive(
				join(root, "2026-05-13"),
				"114426-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
				SAMPLE_JSONL,
			);
			let postCalled = false;
			const fakePostSync = async (): Promise<SyncResponse> => {
				postCalled = true;
				return { ok: true, status: 200, body: { session: {} } };
			};
			const fakeExists = async (): Promise<boolean> => {
				throw new Error("HTTP 500");
			};
			const outcome = await processFile(
				abs,
				FIXTURE_AUTH,
				BASE_OPTS,
				fakePostSync,
				fakeExists,
			);
			expect(outcome.kind).toBe("error");
			expect(outcome.detail).toMatch(/existsRemote/);
			expect(postCalled).toBe(false);
		} finally {
			cleanup();
		}
	});

	it("error: lock_held → surfaces holder env in detail", async () => {
		const { root, cleanup } = tmproot();
		try {
			const abs = makeArchive(
				join(root, "2026-05-13"),
				"114426-conversation-7c99a7ed-e185-435c-b888-dac13dd1aad1.jsonl.gz",
				SAMPLE_JSONL,
			);
			const fakePostSync = async (): Promise<SyncResponse> => ({
				ok: false,
				status: 409,
				kind: "lock_held",
				holder: {
					environment_kind: "gitpod",
					environment_id: "env-abc",
					username: "lihu",
					expires_at: "2026-05-15T13:00:00Z",
				},
			});
			const outcome = await processFile(
				abs,
				FIXTURE_AUTH,
				BASE_OPTS,
				fakePostSync,
				fakeExistsRemoteFalse,
			);
			expect(outcome.kind).toBe("error");
			expect(outcome.detail).toMatch(/lock_held/);
			expect(outcome.detail).toMatch(/gitpod/);
		} finally {
			cleanup();
		}
	});
});
