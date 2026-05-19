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
	/**
	 * Fork lineage (ENG-5862 AC 36) — populated together when the daemon
	 * was started by `session resume <id> --fork`. The fork's first sync
	 * carries the source session's id and turn_count at fork time; absent
	 * on every non-fork sync. Mirrors the optional fields on the
	 * server-side `SyncMetadata` in `nextjs-app/lib/services/dev-sessions.ts`.
	 */
	parent_session_id?: string;
	forked_at_turn?: number;
	/**
	 * ENG-6068 — ISO-8601 timestamp the session started at, derived by
	 * `extractMetadata` from the earliest JSONL event `timestamp`. Wires
	 * through to the server's `metadata.started_at`; the upsert pins
	 * `dev_sessions.started_at` and the `storage_path` date segment to the
	 * day the session ACTUALLY started, not the upload day.
	 *
	 * Optional + backward-compatible — the field MUST be OMITTED (not sent
	 * as `null` or empty string) when the extractor returns `null`, so
	 * pre-A.2 daemons' wire shape and the daemon-meta-only-file wire shape
	 * stay byte-identical and the server's `if (m.started_at != null)`
	 * validator branch stays inert. Mirrors the server-side optional shape
	 * on `SyncMetadata` in `nextjs-app/lib/services/dev-sessions.ts`.
	 */
	started_at?: string;
}
