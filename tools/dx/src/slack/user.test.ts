/**
 * Unit tests for `dx slack` user resolution.
 *
 * Part of: ENG-5760
 */

import { describe, expect, it } from "bun:test";
import {
	classifyUserInput,
	fetchUserInfo,
	resolveUser,
	UserResolutionError,
	type SlackUserClient,
	type SlackUserShape,
} from "./user";

const config = { botToken: "xoxb-1234-5678-AbCdEf" };

function fakeClient(opts: {
	emailMap?: Record<string, string>;
	pages?: Array<{ members: SlackUserShape[]; next?: string }>;
	infoMap?: Record<string, SlackUserShape>;
	listError?: string;
	emailError?: string;
}): SlackUserClient {
	let pageIdx = 0;
	return {
		users: {
			async lookupByEmail({ email }) {
				if (opts.emailError) {
					return { ok: false, error: opts.emailError };
				}
				const id = opts.emailMap?.[email];
				if (id) return { ok: true, user: { id, profile: { email } } };
				return { ok: false, error: "users_not_found" };
			},
			async list() {
				if (opts.listError) {
					return { ok: false, error: opts.listError };
				}
				const page = opts.pages?.[pageIdx] ?? { members: [] };
				pageIdx += 1;
				return {
					ok: true,
					members: page.members,
					response_metadata: page.next ? { next_cursor: page.next } : {},
				};
			},
			async info({ user }) {
				const u = opts.infoMap?.[user];
				if (u) return { ok: true, user: u };
				return { ok: false, error: "user_not_found" };
			},
		},
	};
}

describe("classifyUserInput", () => {
	it("identifies raw user ids", () => {
		expect(classifyUserInput("U0123ABCDE")).toBe("id");
		expect(classifyUserInput("WABCDEFGHIJ")).toBe("id");
	});

	it("identifies email addresses", () => {
		expect(classifyUserInput("lihu@askeffi.ai")).toBe("email");
	});

	it("treats @handle and bare handle as handle", () => {
		expect(classifyUserInput("@lihu")).toBe("handle");
		expect(classifyUserInput("lihu")).toBe("handle");
	});

	it("flags empty / whitespace input", () => {
		expect(classifyUserInput("")).toBe("empty");
		expect(classifyUserInput("   ")).toBe("empty");
	});
});

describe("resolveUser", () => {
	it("passes raw Uxxxx ids through without API calls", async () => {
		const client = fakeClient({});
		expect(await resolveUser(client, "U0123ABCDE", config)).toBe(
			"U0123ABCDE",
		);
	});

	it("resolves an email via users.lookupByEmail", async () => {
		const client = fakeClient({
			emailMap: { "lihu@askeffi.ai": "U_LIHU" },
		});
		expect(await resolveUser(client, "lihu@askeffi.ai", config)).toBe(
			"U_LIHU",
		);
	});

	it("surfaces missing_scope for the email path", async () => {
		const client = fakeClient({ emailError: "missing_scope" });
		try {
			await resolveUser(client, "lihu@askeffi.ai", config);
			throw new Error("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(UserResolutionError);
			expect((err as UserResolutionError).slackError).toBe("missing_scope");
		}
	});

	it("resolves @handle via users.list (with pagination)", async () => {
		const client = fakeClient({
			pages: [
				{
					members: [
						{ id: "U1", name: "alice" },
						{ id: "U2", name: "bob" },
					],
					next: "page2",
				},
				{
					members: [
						{ id: "U3", name: "charlie" },
						{ id: "U4", name: "lihu" },
					],
				},
			],
		});
		expect(await resolveUser(client, "@lihu", config)).toBe("U4");
	});

	it("matches on profile.display_name as well as name", async () => {
		const client = fakeClient({
			pages: [
				{
					members: [
						{ id: "U1", name: "lberman", profile: { display_name: "lihu" } },
					],
				},
			],
		});
		expect(await resolveUser(client, "lihu", config)).toBe("U1");
	});

	it("skips deleted users", async () => {
		const client = fakeClient({
			pages: [
				{
					members: [
						{ id: "U_OLD", name: "lihu", deleted: true },
						{ id: "U_NEW", name: "lihu" },
					],
				},
			],
		});
		expect(await resolveUser(client, "lihu", config)).toBe("U_NEW");
	});

	it("throws on empty input", async () => {
		await expect(resolveUser(fakeClient({}), "", config)).rejects.toBeInstanceOf(
			UserResolutionError,
		);
	});

	it("throws when handle is not found", async () => {
		const client = fakeClient({
			pages: [{ members: [{ id: "U1", name: "alice" }] }],
		});
		await expect(
			resolveUser(client, "@nobody", config),
		).rejects.toBeInstanceOf(UserResolutionError);
	});

	it("never leaks the raw token in the error", async () => {
		const client = fakeClient({});
		try {
			await resolveUser(client, "@nobody", config);
			throw new Error("should have thrown");
		} catch (err) {
			const e = err as UserResolutionError;
			expect(e.tokenMask).toContain("xoxb");
			expect(e.message).not.toContain("1234-5678");
		}
	});
});

describe("fetchUserInfo", () => {
	it("returns the user record on success", async () => {
		const client = fakeClient({
			infoMap: {
				U_LIHU: {
					id: "U_LIHU",
					name: "lihu",
					profile: { email: "lihu@askeffi.ai", display_name: "Lihu" },
				},
			},
		});
		const u = await fetchUserInfo(client, "U_LIHU", config);
		expect(u.id).toBe("U_LIHU");
		expect(u.profile?.email).toBe("lihu@askeffi.ai");
	});

	it("throws UserResolutionError on Slack failure", async () => {
		const client = fakeClient({});
		await expect(
			fetchUserInfo(client, "U_NOPE", config),
		).rejects.toBeInstanceOf(UserResolutionError);
	});
});
