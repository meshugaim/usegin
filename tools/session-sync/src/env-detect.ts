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

export type ValidateEnvIdentityResult =
	| { ok: true }
	| { ok: false; error: string };

/**
 * Refuse to proceed when env_id is empty. Empty id ships as
 * `environment_id: ""` in upload metadata and the API rejects it with
 * HTTP 400 invalid_metadata.
 *
 * This is the safety net for ENG-6033: pm2 captures env at the original
 * `pm2 start` time and never refreshes it across Ona env-resume, so
 * `GITPOD_SVC` (and thus `id`) goes stale-to-empty under us. The script
 * fix (`ensure-session-sync.sh` calling `pm2 restart --update-env` on
 * every env-resume) prevents the staleness; this validator catches the
 * symptom if that path didn't run.
 *
 * Caller contract: invoke AFTER install-id resolution. `cli.ts` runs
 * `getOrCreateInstallId()` for the local-devcontainer branch first and
 * then threads the resolved id into the validator. Treating all kinds
 * uniformly (empty id = reject) means a corrupt state-dir on local can't
 * silently slip through with `environment_id: ""`.
 */
export function validateEnvIdentity(
	input: DetectedEnvironment,
): ValidateEnvIdentityResult {
	if (input.id === "") {
		return {
			ok: false,
			error:
				`empty env_id for kind=${input.kind} — pm2 likely captured a stale ` +
				`environment at original start (ENG-6033). Recover with: ` +
				`bun pm2 restart session-sync --update-env`,
		};
	}
	return { ok: true };
}
