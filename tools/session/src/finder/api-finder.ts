/**
 * Higher-level API-driven finder (Step 5a of ENG-5861).
 *
 * Wraps `api-client.ts` with credential resolution from the Effi CLI's
 * profile-aware store, so callers don't need to pass an `ApiAuthContext`
 * directly. Mirrors the daemon's `auth.ts` shape (DI'd readers + reading from
 * `tools/effi-cli/src/lib/credentials.ts`).
 *
 * Step 5b will migrate `tools/session/src/commands/{list,find,resume}.ts` to
 * call these helpers. The current `tools/session/src/finder/remote.ts` (the
 * `~/agent-records/`-driven finder) is intentionally untouched here — AC 43
 * deletes it post-GA, but it's load-bearing for the existing CLI until
 * Step 5b lands.
 *
 * Pagination: `findRemoteSessionsViaApi` returns the FIRST PAGE only for
 * slice 1. This is sufficient for the CLI's current `--limit ≤ 100` use
 * cases. A cursor-paged consumer is a follow-up; the lower-level
 * `listSessions` already exposes the cursor verbatim, so the migration is
 * a thin wrapper change in Step 5b if needed.
 *
 * Linear: ENG-5861
 */

import {
  getApiUrl as defaultGetApiUrl,
  readCredentials as defaultReadCredentials,
} from "../../../effi-cli/src/lib/credentials.ts";
import {
  type ApiListOptions,
  type ApiSessionItem,
  type FetchLike,
  getSession,
  listSessions,
} from "./api-client.ts";

interface CredentialsShape {
  access_token: string;
  refresh_token: string;
  email: string;
  api_url: string;
}

export interface ApiFinderOptions {
  /** Effi CLI profile name (defaults to active/current). */
  profileName?: string;
}

/**
 * Dependency-injection seam for tests. Production callers pass nothing and
 * the defaults from `effi-cli/credentials.ts` and global `fetch` are used.
 */
export interface ApiFinderDeps {
  fetchImpl?: FetchLike;
  readCredentialsFn?: (
    profileName?: string,
  ) => Promise<CredentialsShape | null>;
  getApiUrlFn?: (profileName?: string) => Promise<string>;
}

async function resolveAuth(
  options: ApiFinderOptions,
  deps: ApiFinderDeps,
): Promise<{ token: string; apiUrl: string }> {
  const readCredentialsFn = deps.readCredentialsFn ?? defaultReadCredentials;
  const getApiUrlFn = deps.getApiUrlFn ?? defaultGetApiUrl;

  const creds = await readCredentialsFn(options.profileName);
  if (!creds) {
    throw new Error(
      "session: no credentials. Run `effi auth login` to authenticate, then retry.",
    );
  }
  const apiUrl = await getApiUrlFn(options.profileName);
  return { token: creds.access_token, apiUrl };
}

/**
 * Fetch the first page of dev_sessions matching the filters.
 *
 * Returns just `items` from the envelope — slice-1 callers (CLI list/find
 * commands) don't paginate yet. When pagination is needed, callers can
 * either pass a higher `limit` (server cap is 100) or fall through to the
 * lower-level `listSessions` for cursor handling.
 */
export async function findRemoteSessionsViaApi(
  options: ApiFinderOptions,
  filters: ApiListOptions,
  deps: ApiFinderDeps = {},
): Promise<ApiSessionItem[]> {
  const auth = await resolveAuth(options, deps);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const result = await listSessions(auth, filters, fetchImpl);
  return result.items;
}

/**
 * Fetch a single dev_sessions row + signed URL by full session id.
 *
 * Returns null when the row isn't visible (RLS-hidden or genuinely missing —
 * the route's 404 path is shared, by design). Throws on any other non-2xx.
 */
export async function resolveRemoteSessionViaApi(
  options: ApiFinderOptions,
  sessionId: string,
  deps: ApiFinderDeps = {},
): Promise<{ session: ApiSessionItem; signed_url: string } | null> {
  const auth = await resolveAuth(options, deps);
  const fetchImpl = deps.fetchImpl ?? fetch;
  return getSession(auth, sessionId, fetchImpl);
}
