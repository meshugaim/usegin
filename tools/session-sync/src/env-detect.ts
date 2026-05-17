/**
 * Detect the current developer environment kind + id.
 *
 * Detection order (first match wins) — matches AC 19 of the
 * dev-session-sync spec verbatim:
 *
 *   1. CODESPACES === "true"               → codespaces, id = CODESPACE_NAME
 *   2. GITPOD_WORKSPACE_ID set              → gitpod,     id = GITPOD_WORKSPACE_ID
 *   3. GITPOD_API_URL set (no workspace id) → ona,        id = GITPOD_SVC
 *   4. else                                 → local-devcontainer, id = ""
 *
 * For the local-devcontainer branch the caller threads in the install-id
 * read via `getOrCreateInstallId()`. This function only returns the
 * sentinel `id: ""` so it stays a pure (no-FS) detection rule.
 */

export type EnvironmentKind =
	| "local-devcontainer"
	| "gitpod"
	| "codespaces"
	| "ona";

export interface DetectedEnvironment {
	kind: EnvironmentKind;
	id: string;
}

export function detectEnvironment(
	env: Partial<Record<string, string | undefined>>,
): DetectedEnvironment {
	if (env.CODESPACES === "true") {
		return { kind: "codespaces", id: env.CODESPACE_NAME ?? "" };
	}
	if (env.GITPOD_WORKSPACE_ID) {
		return { kind: "gitpod", id: env.GITPOD_WORKSPACE_ID };
	}
	if (env.GITPOD_API_URL) {
		return { kind: "ona", id: env.GITPOD_SVC ?? "" };
	}
	return { kind: "local-devcontainer", id: "" };
}

export type ValidateEnvIdentityInput = {
	kind: EnvironmentKind;
	id: string;
};

export type ValidateEnvIdentityResult =
	| { ok: true }
	| { ok: false; error: string };

// Stub — Red phase placeholder. Real implementation lands in Green commit.
export function validateEnvIdentity(
	_input: ValidateEnvIdentityInput,
): ValidateEnvIdentityResult {
	return { ok: true };
}
