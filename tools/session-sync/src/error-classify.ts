/**
 * Error classification for the session-sync daemon (ENG-5990).
 *
 * Three classes:
 *   - `auth`     → daemon transitions to `needs-auth` (idle until creds arrive).
 *   - `lock`     → existing 403 not_holder lock-release path; never auth-flip.
 *   - `network`  → existing backoff/retry; never auth-flip. Default for
 *                  unknowns (better noisy logs than a stuck daemon).
 *
 * Inputs:
 *   - A thrown `Error` from `loadAuth` or `refreshAuthIfNeeded`.
 *   - A non-200 response from `postSync` / `postHeartbeat`
 *     (`{kind:"transport_error", status, body}` or `{kind:"lock_held"}`).
 *
 * Pure — no I/O, no clock.
 */

export type ErrorClass = "auth" | "lock" | "network";

/**
 * The shape we accept from sync-client / heartbeat. Loose on purpose —
 * callers may also hand in a thrown `Error` (caught from `refreshAuthIfNeeded`),
 * so the function checks for both response and error shapes.
 */
export type Classifiable =
	| Error
	| {
			kind: "transport_error";
			status: number;
			body: unknown;
	  }
	| {
			kind: "lock_held";
			holder: unknown;
	  }
	| { kind: "not_holder"; body?: unknown };

const AUTH_KEYWORDS_RE =
	/expired|invalid_grant|revoked|unauthorized|no credentials|missing `sub`|token is missing/i;

function bodyHasAuthShape(body: unknown): boolean {
	if (!body || typeof body !== "object") return false;
	const b = body as { error?: unknown; kind?: unknown };
	if (typeof b.error === "string") {
		// Common auth body shapes: { error: "expired_token" | "unauthorized" }.
		if (AUTH_KEYWORDS_RE.test(b.error)) return true;
	}
	if (typeof b.kind === "string") {
		// e.g. { kind: "unauthorized" }.
		if (b.kind === "unauthorized" || b.kind === "expired_token") return true;
	}
	return false;
}

function bodyIsNotHolder(body: unknown): boolean {
	if (!body || typeof body !== "object") return false;
	const b = body as { error?: unknown; kind?: unknown };
	return b.error === "not_holder" || b.kind === "not_holder";
}

export function classifyError(input: Classifiable): ErrorClass {
	// Sync-client returned a parsed 403 not_holder envelope explicitly.
	if (
		input !== null &&
		typeof input === "object" &&
		"kind" in input &&
		(input as { kind: string }).kind === "not_holder"
	) {
		return "lock";
	}

	// Sync-client returned a 409 lock_held — existing backoff path.
	if (
		input !== null &&
		typeof input === "object" &&
		"kind" in input &&
		(input as { kind: string }).kind === "lock_held"
	) {
		return "lock";
	}

	// Sync-client returned transport_error with status.
	if (
		input !== null &&
		typeof input === "object" &&
		"kind" in input &&
		(input as { kind: string }).kind === "transport_error"
	) {
		const r = input as { status: number; body: unknown };
		// 403 carve-out: not_holder body is lock-class, not auth-class.
		if (r.status === 403 && bodyIsNotHolder(r.body)) return "lock";
		if (r.status === 401) return "auth";
		if (r.status === 403 && bodyHasAuthShape(r.body)) return "auth";
		if (r.status === 400 && bodyHasAuthShape(r.body)) return "auth";
		// 5xx, 503, 429, anything else → network.
		return "network";
	}

	// Thrown Error (from loadAuth, refreshAuthIfNeeded, or downstream).
	if (input instanceof Error) {
		// Network error shapes from node's fetch / undici. `code` lives on
		// the error object itself or on its `.cause`.
		const code =
			(input as Error & { code?: string }).code ??
			(input as Error & { cause?: { code?: string } }).cause?.code ??
			"";
		if (code === "ECONNREFUSED" || code === "EAI_AGAIN") return "network";
		if (code === "UND_ERR_CONNECT_TIMEOUT") return "network";
		if (code === "ETIMEDOUT" || code === "ENETUNREACH") return "network";
		if (AUTH_KEYWORDS_RE.test(input.message)) return "auth";
		// Unknown errors default to network — never flip state on uncertainty.
		return "network";
	}

	return "network";
}
