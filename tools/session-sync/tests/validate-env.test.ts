import { describe, expect, test } from "bun:test";
import { validateEnvIdentity } from "../src/env-detect.ts";

// ENG-6033: pm2 captures env at original `pm2 start` time; on Ona env-resume,
// GITPOD_SVC changes underneath the still-running daemon. env-detect then
// returns `id: ""`, the upload metadata gets serialized as
// `environment_id: ""` and the API rejects with HTTP 400 invalid_metadata.
//
// Part A (ensure-session-sync.sh) prevents the staleness on env-resume.
// Part B (this validation) is the safety net: if env_id is empty for any
// non-local environment kind, the daemon refuses to start with a message
// pointing at the `--update-env` recovery, instead of silently spraying
// invalid POSTs.
describe("validateEnvIdentity", () => {
	test(
		"ona kind with empty id is rejected with --update-env recovery hint",
		() => {
			const result = validateEnvIdentity({ kind: "ona", id: "" });
			expect(result.ok).toBe(false);
			if (result.ok) throw new Error("unreachable — narrowing for TS");
			expect(result.error).toContain("empty env_id");
			expect(result.error).toContain("ona");
			expect(result.error).toContain("--update-env");
		},
	);

	test("gitpod kind with empty id is rejected", () => {
		const result = validateEnvIdentity({ kind: "gitpod", id: "" });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — narrowing for TS");
		expect(result.error).toContain("empty env_id");
		expect(result.error).toContain("gitpod");
		expect(result.error).toContain("--update-env");
	});

	test("codespaces kind with empty id is rejected", () => {
		const result = validateEnvIdentity({ kind: "codespaces", id: "" });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — narrowing for TS");
		expect(result.error).toContain("empty env_id");
		expect(result.error).toContain("codespaces");
		expect(result.error).toContain("--update-env");
	});

	test("ona kind with a valid id is accepted", () => {
		const result = validateEnvIdentity({
			kind: "ona",
			id: "envid12345-instance98765",
		});
		expect(result).toEqual({ ok: true });
	});

	test("gitpod kind with a valid id is accepted", () => {
		const result = validateEnvIdentity({
			kind: "gitpod",
			id: "ws-abc-def-123",
		});
		expect(result).toEqual({ ok: true });
	});

	test("local-devcontainer with empty id is accepted (install-id is set later)", () => {
		// In the local path env-detect intentionally returns `id: ""`; the
		// caller threads in the install-id via getOrCreateInstallId(). The
		// validator runs BEFORE that resolution step, so it must allow this
		// shape through.
		const result = validateEnvIdentity({
			kind: "local-devcontainer",
			id: "",
		});
		expect(result).toEqual({ ok: true });
	});

	test("local-devcontainer with a resolved install-id is accepted", () => {
		const result = validateEnvIdentity({
			kind: "local-devcontainer",
			id: "install-a1b2c3d4",
		});
		expect(result).toEqual({ ok: true });
	});
});
