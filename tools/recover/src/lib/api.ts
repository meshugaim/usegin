/**
 * Thin Supabase Management API client.
 *
 * Executes SQL and RPC calls against a remote project via the official
 * Management API endpoint. Uses SUPABASE_ACCESS_TOKEN for auth.
 *
 * We deliberately keep this self-contained (no imports from other tools)
 * so `recover` can be run in isolation. If a second tool ever needs to
 * talk to the Management API, extract this into a shared lib rather than
 * copy-pasting.
 */

const MANAGEMENT_API = "https://api.supabase.com";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a UUID to prevent SQL injection. Throws on invalid input. */
export function validateUuid(value: string, label = "value"): string {
  if (!UUID_RE.test(value)) {
    throw new Error(
      `Invalid UUID for ${label}: '${value}' ` +
        `(expected 8-4-4-4-12 hex, e.g. f52c2f20-5748-4493-98c3-e3747f586d6f)`
    );
  }
  return value;
}

/** Escape a SQL string literal (single quotes). */
export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function getAccessToken(): string {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Missing required env var: SUPABASE_ACCESS_TOKEN. " +
        "Get a token from https://supabase.com/dashboard/account/tokens."
    );
  }
  return token;
}

/**
 * Execute a SQL statement against a project's database via the Management API.
 *
 * Returns rows as an array. The Management API returns either an array or
 * `{rows: [...]}` depending on the statement type, so we normalize.
 *
 * @param readOnly When true, the API enforces read-only and rejects any
 *   write. Use for SELECT; must be false for RPC calls that mutate state.
 */
export async function executeSql<T = Record<string, unknown>>(
  projectRef: string,
  query: string,
  readOnly = false
): Promise<T[]> {
  const token = getAccessToken();
  const resp = await fetch(
    `${MANAGEMENT_API}/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, read_only: readOnly }),
    }
  );

  if (!resp.ok) {
    const body = await resp.text();

    // Friendly translation: the reset_stuck_sync_item RPC is not present in
    // the target database. This is the most common "why doesn't this work?"
    // for a new environment because the CLI is dev-local but the RPC is a
    // migration that has to land in the target DB separately. Matches Postgres
    // error code 42883 (undefined_function) against our specific RPC name.
    if (
      body.includes("reset_stuck_sync_item") &&
      (body.includes("42883") || body.includes("does not exist"))
    ) {
      throw new Error(
        `The reset_stuck_sync_item RPC is not present in project ${projectRef}. ` +
          `Ensure migration 20260406083041_reset_stuck_sync_item_rpc.sql has been ` +
          `applied to the target database via the normal main → staging → production ` +
          `promotion flow. (The CLI is a local dev tool; only the migration has to ` +
          `reach the target.)`
      );
    }

    throw new Error(
      `SQL query failed (${projectRef}): ${resp.status} ${body}`
    );
  }

  const result = (await resp.json()) as unknown;
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [] as T[];
}

// ─── Domain types ────────────────────────────────────────────────────────────

export const ENTITY_TYPES = [
  "file",
  "email",
  "attachment",
  "drive",
  "meeting_summary",
  "meeting_transcript",
  "sharepoint",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export function parseEntityType(value: string): EntityType {
  if ((ENTITY_TYPES as readonly string[]).includes(value)) {
    return value as EntityType;
  }
  throw new Error(
    `Invalid entity type '${value}'. Accepted: ${ENTITY_TYPES.join(", ")}.`
  );
}

export interface StuckItem {
  entity_type: EntityType;
  entity_id: string;
  project_id: string;
  gfs_sync_status: string;
  is_excluded: boolean;
  failure_count: number;
  error_message: string | null;
}

export interface ResetResult {
  entity_type: EntityType;
  entity_id: string;
  old_status: string | null;
  new_status: string | null;
  old_is_excluded: boolean | null;
  new_is_excluded: boolean | null;
  old_failure_count: number | null;
  new_failure_count: number | null;
  action: "reset" | "already_clean" | "not_found";
}

/** The statuses the reset RPC can unstick. Mirrors the RPC's whitelist. */
export const STUCK_STATUSES = [
  "deleted",
  "retry_exhausted",
  "upload_failed",
  "excluded",
] as const;

/**
 * List stuck entities for a project. Scoped by project_id (denormalized on
 * gfs_sync_items), optionally filtered by entity_type.
 */
export async function listStuckForProject(
  projectRef: string,
  projectId: string,
  entityType?: EntityType
): Promise<StuckItem[]> {
  validateUuid(projectId, "project_id");
  const entityFilter = entityType
    ? `AND entity_type = ${sqlLiteral(entityType)}`
    : "";
  const stuckList = STUCK_STATUSES.map(sqlLiteral).join(", ");
  const query = `
    SELECT
      entity_type::text AS entity_type,
      entity_id::text   AS entity_id,
      project_id::text  AS project_id,
      gfs_sync_status::text AS gfs_sync_status,
      is_excluded,
      failure_count,
      error_message
    FROM public.gfs_sync_items
    WHERE project_id = ${sqlLiteral(projectId)}
      AND gfs_sync_status IN (${stuckList})
      ${entityFilter}
    ORDER BY entity_type, entity_id;
  `;
  return executeSql<StuckItem>(projectRef, query, true);
}

/**
 * Fetch a single stuck item by (entity_type, entity_id). Returns null if not
 * found, otherwise a StuckItem snapshot (which may not actually be stuck —
 * caller decides).
 */
export async function getSyncItem(
  projectRef: string,
  entityType: EntityType,
  entityId: string
): Promise<StuckItem | null> {
  validateUuid(entityId, "entity_id");
  const query = `
    SELECT
      entity_type::text AS entity_type,
      entity_id::text   AS entity_id,
      project_id::text  AS project_id,
      gfs_sync_status::text AS gfs_sync_status,
      is_excluded,
      failure_count,
      error_message
    FROM public.gfs_sync_items
    WHERE entity_type = ${sqlLiteral(entityType)}
      AND entity_id   = ${sqlLiteral(entityId)}
    LIMIT 1;
  `;
  const rows = await executeSql<StuckItem>(projectRef, query, true);
  return rows[0] ?? null;
}

/**
 * Call reset_stuck_sync_item(entity_type, entity_id, actor) via the
 * Management API. Returns the single row the RPC produces.
 */
export async function resetStuckSyncItem(
  projectRef: string,
  entityType: EntityType,
  entityId: string,
  actor: string
): Promise<ResetResult> {
  validateUuid(entityId, "entity_id");
  const query = `
    SELECT
      entity_type::text AS entity_type,
      entity_id::text   AS entity_id,
      old_status::text  AS old_status,
      new_status::text  AS new_status,
      old_is_excluded,
      new_is_excluded,
      old_failure_count,
      new_failure_count,
      action
    FROM public.reset_stuck_sync_item(
      ${sqlLiteral(entityType)}::gfs_entity_type,
      ${sqlLiteral(entityId)}::uuid,
      ${sqlLiteral(actor)}
    );
  `;
  const rows = await executeSql<ResetResult>(projectRef, query, false);
  if (rows.length === 0) {
    throw new Error(
      `reset_stuck_sync_item returned no rows for ${entityType}/${entityId}`
    );
  }
  return rows[0]!;
}
