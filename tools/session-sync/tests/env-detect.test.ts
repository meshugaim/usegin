import { describe, expect, test } from "bun:test";
import { detectEnvironment } from "../src/env-detect.ts";

describe("detectEnvironment", () => {
	test("CODESPACES=true → codespaces with CODESPACE_NAME id", () => {
		const env = {
			CODESPACES: "true",
			CODESPACE_NAME: "lihu-jubilant-octopus-abc123",
		};
		expect(detectEnvironment(env)).toEqual({
			kind: "codespaces",
			id: "lihu-jubilant-octopus-abc123",
		});
	});

	test("CODESPACES=true with missing CODESPACE_NAME → empty id", () => {
		expect(detectEnvironment({ CODESPACES: "true" })).toEqual({
			kind: "codespaces",
			id: "",
		});
	});

	test("CODESPACES set but not 'true' → does NOT pick codespaces", () => {
		// Detection rule: env.CODESPACES === "true". Anything else falls
		// through to the next rule.
		const result = detectEnvironment({ CODESPACES: "1" });
		expect(result.kind).not.toBe("codespaces");
	});

	test("GITPOD_WORKSPACE_ID set → gitpod with that id", () => {
		const env = { GITPOD_WORKSPACE_ID: "ws-abc-def-123" };
		expect(detectEnvironment(env)).toEqual({
			kind: "gitpod",
			id: "ws-abc-def-123",
		});
	});

	test("GITPOD_WORKSPACE_ID + CODESPACES=true → codespaces wins (rule order)", () => {
		const env = {
			CODESPACES: "true",
			CODESPACE_NAME: "cs-name",
			GITPOD_WORKSPACE_ID: "ws-id",
		};
		expect(detectEnvironment(env)).toEqual({
			kind: "codespaces",
			id: "cs-name",
		});
	});

	test("GITPOD_API_URL without GITPOD_WORKSPACE_ID → ona with GITPOD_SVC id", () => {
		const env = {
			GITPOD_API_URL: "https://api.gitpod.io",
			GITPOD_SVC: "envid12345-instance98765",
		};
		expect(detectEnvironment(env)).toEqual({
			kind: "ona",
			id: "envid12345-instance98765",
		});
	});

	test("GITPOD_API_URL set with empty GITPOD_SVC → ona with empty id", () => {
		const env = { GITPOD_API_URL: "https://api.gitpod.io" };
		expect(detectEnvironment(env)).toEqual({ kind: "ona", id: "" });
	});

	test("GITPOD_API_URL + GITPOD_WORKSPACE_ID → gitpod wins (rule order)", () => {
		const env = {
			GITPOD_API_URL: "https://api.gitpod.io",
			GITPOD_WORKSPACE_ID: "ws-abc",
			GITPOD_SVC: "svc-xyz",
		};
		expect(detectEnvironment(env)).toEqual({
			kind: "gitpod",
			id: "ws-abc",
		});
	});

	test("no cloud markers → local-devcontainer with empty id sentinel", () => {
		// The install-id is threaded in by the caller via getOrCreateInstallId;
		// env-detect alone returns an empty id sentinel for the local case.
		expect(detectEnvironment({})).toEqual({
			kind: "local-devcontainer",
			id: "",
		});
	});
});
