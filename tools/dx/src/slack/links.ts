/**
 * Cross-surface link transforms applied to outbound Slack messages.
 *
 * Today: ENG-\d+ Linear-issue IDs get auto-formatted as Slack mrkdwn links
 * to the issue page so anyone reading the message can jump straight into
 * Linear. Idempotent — bodies that already contain the wrapped form are
 * left alone.
 *
 * Symmetric reads (resolve ENG-IDs in INCOMING messages) are out of scope
 * here; the read path stays simple-text-pass-through. If we want enriched
 * inbox display later, that lives next to `read.ts` / `inbox.ts`.
 *
 * Configurable via env:
 *   - LINEAR_ORG_URL  (default "https://linear.app/askeffi") — Linear org URL.
 *
 * The default matches the team's actual Linear org. Override only if a
 * different team installs UseGin under a different Linear workspace.
 */

const DEFAULT_LINEAR_ORG_URL = "https://linear.app/askeffi";

/** Strip a trailing slash so we can append `/issue/...` cleanly. */
function normalizeOrgUrl(rawUrl: string): string {
	return rawUrl.replace(/\/+$/, "");
}

/**
 * Match `ENG-123` etc. The lookbehind `(?<![\\w/|<])` rules out:
 *   - `ENGRAM-1`     → already in a longer word
 *   - `/issue/ENG-1` → already a URL path component (idempotency vs. the
 *                      output of this function itself)
 *   - `|ENG-1>`      → already inside a Slack mrkdwn link's `|label>` tail
 *   - `<ENG-1>`      → already wrapped (defensive — shouldn't appear).
 *
 * The lookahead `(?!\\w)` ensures we don't grab the prefix of a longer
 * identifier (e.g. `ENG-123ABC` won't match `ENG-123`).
 */
const ENG_ID_PATTERN = /(?<![\w/|<])ENG-(\d+)(?!\w)/g;

/**
 * Transform a message body so each free-standing `ENG-\d+` becomes a Slack
 * mrkdwn link. Idempotent: running twice produces the same result, since
 * occurrences inside an existing `<url|ENG-1>` are skipped by the regex.
 */
export function autoLinkEngIds(
	body: string,
	options: { orgUrl?: string } = {},
): string {
	const orgUrl = normalizeOrgUrl(options.orgUrl ?? DEFAULT_LINEAR_ORG_URL);
	return body.replace(ENG_ID_PATTERN, (full, num) => {
		const issue = `ENG-${num}`;
		return `<${orgUrl}/issue/${issue}|${issue}>`;
	});
}

/**
 * Resolve the configured Linear org URL from env at call time. Pure read,
 * no caching — keeps the test seam minimal (override the env in beforeEach
 * and the function picks it up).
 */
export function getLinearOrgUrl(env: NodeJS.ProcessEnv = process.env): string {
	const v = env.LINEAR_ORG_URL?.trim();
	return v && v.length > 0 ? v : DEFAULT_LINEAR_ORG_URL;
}

/** Convenience: read env + apply transform in one call. */
export function autoLinkEngIdsFromEnv(
	body: string,
	env: NodeJS.ProcessEnv = process.env,
): string {
	return autoLinkEngIds(body, { orgUrl: getLinearOrgUrl(env) });
}
