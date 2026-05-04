/**
 * User resolution for `dx slack` — accept `Uxxxxxxxx` raw id, `@handle`,
 * or email address; return the canonical Slack user id.
 *
 * Sibling of `./channel`'s `resolveChannel`. Channel and user are different
 * Slack namespaces (channels paginate via `conversations.list`; users
 * paginate via `users.list` or one-shot via `users.lookupByEmail`), so
 * the two resolvers stay separate.
 *
 * Bot scopes that gate this:
 *   - email path needs `users:read.email` (NOT in the test-workspace bot's
 *     current grant — Slack returns `missing_scope` and we surface that
 *     verbatim so the caller can prompt Lihu).
 *   - handle/id path needs `users:read` (already in scope).
 *
 * Part of: ENG-5760
 */

import { maskToken, type SlackConfig } from "./config";

export class UserResolutionError extends Error {
	readonly tokenMask: string;
	/** Slack error code if this came from a Slack-reported failure. */
	readonly slackError?: string;
	constructor(message: string, config: SlackConfig, slackError?: string) {
		super(message);
		this.tokenMask = maskToken(config.botToken);
		this.slackError = slackError;
	}
}

export interface SlackUserShape {
	id?: string;
	name?: string;
	real_name?: string;
	deleted?: boolean;
	is_bot?: boolean;
	profile?: {
		email?: string;
		display_name?: string;
		real_name?: string;
	};
}

/** Structural subset of `users.*` we depend on. */
export interface SlackUserClient {
	users: {
		lookupByEmail(args: { email: string }): Promise<{
			ok?: boolean;
			error?: string;
			user?: SlackUserShape;
		}>;
		list(args: { cursor?: string; limit?: number }): Promise<{
			ok?: boolean;
			error?: string;
			members?: SlackUserShape[];
			response_metadata?: { next_cursor?: string };
		}>;
		info(args: { user: string }): Promise<{
			ok?: boolean;
			error?: string;
			user?: SlackUserShape;
		}>;
	};
}

/** Detect the input shape — id, email, or handle. */
export function classifyUserInput(
	input: string,
): "id" | "email" | "handle" | "empty" {
	const t = input.trim();
	if (!t) return "empty";
	if (/^[UW][A-Z0-9]{8,}$/.test(t)) return "id";
	if (t.includes("@") && !t.startsWith("@")) return "email";
	return "handle";
}

/**
 * Resolve a user input to a Slack user id.
 *
 * - `Uxxxxxxxx` / `Wxxxxxxxx` — passed through (no API call).
 * - `email@host` — `users.lookupByEmail` (one call, fast path).
 * - `@handle` / `handle` — `users.list` walked until a match on `name` or
 *    `profile.display_name`.
 *
 * Throws `UserResolutionError` on any miss / Slack error.
 */
export async function resolveUser(
	client: SlackUserClient,
	input: string,
	config: SlackConfig,
): Promise<string> {
	const kind = classifyUserInput(input);
	const trimmed = input.trim();

	if (kind === "empty") {
		throw new UserResolutionError("user input is empty", config);
	}

	if (kind === "id") {
		return trimmed;
	}

	if (kind === "email") {
		const resp = await client.users.lookupByEmail({ email: trimmed });
		if (resp.ok && resp.user?.id) return resp.user.id;
		throw new UserResolutionError(
			`users.lookupByEmail failed: ${resp.error ?? "unknown error"}`,
			config,
			resp.error,
		);
	}

	// handle path
	const wanted = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
	let cursor: string | undefined;
	const MAX_PAGES = 20;
	for (let page = 0; page < MAX_PAGES; page += 1) {
		const resp = await client.users.list({ cursor, limit: 200 });
		if (resp.ok === false) {
			throw new UserResolutionError(
				`users.list failed: ${resp.error ?? "unknown error"}`,
				config,
				resp.error,
			);
		}
		for (const u of resp.members ?? []) {
			if (u.deleted) continue;
			if (
				u.id &&
				(u.name === wanted || u.profile?.display_name === wanted)
			) {
				return u.id;
			}
		}
		cursor = resp.response_metadata?.next_cursor;
		if (!cursor) break;
	}

	throw new UserResolutionError(
		`user not found: ${input} (try the email address or the raw Uxxxxx id)`,
		config,
	);
}

/** One-shot fetch of a user record (for the `user find` command's report). */
export async function fetchUserInfo(
	client: SlackUserClient,
	userId: string,
	config: SlackConfig,
): Promise<SlackUserShape> {
	const resp = await client.users.info({ user: userId });
	if (!resp.ok || !resp.user) {
		throw new UserResolutionError(
			`users.info failed: ${resp.error ?? "unknown error"}`,
			config,
			resp.error,
		);
	}
	return resp.user;
}
