/**
 * Daemon-side mirror of `SyncMetadata` from
 * `nextjs-app/lib/services/dev-sessions.ts`.
 *
 * Field-for-field aligned with the route's `validateSyncMetadata` contract;
 * if the route adds a field, mirror it here too. Kept in this small module
 * so `sync-client.ts`, `sync-flow.ts`, and `sync-session.ts` import a
 * single typed shape rather than each redeclaring it.
 */

export type EnvironmentKind =
	| "local-devcontainer"
	| "gitpod"
	| "codespaces"
	| "ona";

export type SessionStatus = "active" | "completed";

export interface SyncMetadata {
	turn_count: number;
	line_count: number;
	project_path: string;
	git_branch?: string | null;
	git_sha?: string | null;
	claude_model?: string | null;
	environment_kind: EnvironmentKind;
	environment_id: string;
	username: string;
	status?: SessionStatus;
	preview_first?: string[] | null;
	preview_last?: string[] | null;
	first_user_message?: string | null;
	file_size_bytes?: number;
	gzipped_size_bytes?: number;
}
