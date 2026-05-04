/**
 * Unit tests for `dx slack channel <verb>` operations.
 *
 * Part of: ENG-5760
 */

import { describe, expect, it } from "bun:test";
import {
	archiveChannel,
	createChannel,
	formatOpHuman,
	formatOpJson,
	inviteToChannel,
	joinChannel,
	listChannelMembers,
	setChannelPurpose,
	setChannelTopic,
	type ChannelAdminClient,
} from "./channelOps";

const config = { botToken: "xoxb-1234-5678-AbCdEf" };

interface FakeOpts {
	channelsByName?: Record<string, string>;
	emailMap?: Record<string, string>;
	createResult?: {
		ok?: boolean;
		error?: string;
		channel?: { id?: string; name?: string; is_private?: boolean };
	};
	inviteResult?: {
		ok?: boolean;
		error?: string;
		errors?: Array<{ user?: string; error?: string }>;
	};
	joinResult?: {
		ok?: boolean;
		error?: string;
		channel?: { id?: string };
		warning?: string;
	};
	archiveResult?: { ok?: boolean; error?: string };
	topicResult?: { ok?: boolean; error?: string; topic?: string };
	purposeResult?: { ok?: boolean; error?: string; purpose?: string };
	membersPages?: Array<{ members: string[]; next?: string }>;
	usersInfoMap?: Record<
		string,
		{
			ok?: boolean;
			user?: {
				id?: string;
				name?: string;
				real_name?: string;
				is_bot?: boolean;
				profile?: { email?: string; real_name?: string };
			};
		}
	>;
	calls?: {
		create?: Array<{ name: string; is_private?: boolean }>;
		invite?: Array<{ channel: string; users: string }>;
		join?: Array<{ channel: string }>;
		archive?: Array<{ channel: string }>;
		setTopic?: Array<{ channel: string; topic: string }>;
		setPurpose?: Array<{ channel: string; purpose: string }>;
		members?: Array<{ channel: string; cursor?: string }>;
	};
}

function makeClient(opts: FakeOpts): ChannelAdminClient {
	const channelsByName = opts.channelsByName ?? {};
	let memberPageIdx = 0;
	const calls = opts.calls ?? {};

	return {
		conversations: {
			async list() {
				return {
					ok: true,
					channels: Object.entries(channelsByName).map(([name, id]) => ({
						id,
						name,
					})),
					response_metadata: {},
				};
			},
			async create(args) {
				calls.create?.push(args);
				return (
					opts.createResult ?? {
						ok: true,
						channel: {
							id: "C_NEW",
							name: args.name,
							is_private: args.is_private,
						},
					}
				);
			},
			async invite(args) {
				calls.invite?.push(args);
				return opts.inviteResult ?? { ok: true };
			},
			async join(args) {
				calls.join?.push(args);
				return (
					opts.joinResult ?? {
						ok: true,
						channel: { id: args.channel },
					}
				);
			},
			async archive(args) {
				calls.archive?.push(args);
				return opts.archiveResult ?? { ok: true };
			},
			async setTopic(args) {
				calls.setTopic?.push(args);
				return (
					opts.topicResult ?? { ok: true, topic: args.topic }
				);
			},
			async setPurpose(args) {
				calls.setPurpose?.push(args);
				return (
					opts.purposeResult ?? { ok: true, purpose: args.purpose }
				);
			},
			async members(args) {
				calls.members?.push({ channel: args.channel, cursor: args.cursor });
				const pages = opts.membersPages ?? [];
				const page = pages[memberPageIdx] ?? { members: [] };
				memberPageIdx += 1;
				return {
					ok: true,
					members: page.members,
					response_metadata: page.next ? { next_cursor: page.next } : {},
				};
			},
		},
		users: {
			async lookupByEmail({ email }) {
				const id = opts.emailMap?.[email];
				if (id) return { ok: true, user: { id } };
				return { ok: false, error: "users_not_found" };
			},
			async list() {
				return { ok: true, members: [] };
			},
			async info({ user }) {
				return (
					opts.usersInfoMap?.[user] ?? { ok: false, error: "user_not_found" }
				);
			},
		},
	};
}

describe("createChannel", () => {
	it("creates a public channel", async () => {
		const calls = { create: [] as Array<{ name: string; is_private?: boolean }> };
		const client = makeClient({ calls });
		const r = await createChannel(client, "#new-room", config);
		expect(r.ok).toBe(true);
		expect(r.verb).toBe("create");
		expect(r.channel).toBe("C_NEW");
		expect(calls.create).toEqual([{ name: "new-room", is_private: undefined }]);
	});

	it("strips a leading # from the name", async () => {
		const calls = { create: [] as Array<{ name: string; is_private?: boolean }> };
		const client = makeClient({ calls });
		await createChannel(client, "#foo", config);
		expect(calls.create[0]?.name).toBe("foo");
	});

	it("creates a private channel when isPrivate=true", async () => {
		const calls = { create: [] as Array<{ name: string; is_private?: boolean }> };
		const client = makeClient({ calls });
		await createChannel(client, "private-room", config, { isPrivate: true });
		expect(calls.create[0]?.is_private).toBe(true);
	});

	it("sets topic post-create when provided", async () => {
		const calls = {
			create: [] as Array<{ name: string; is_private?: boolean }>,
			setTopic: [] as Array<{ channel: string; topic: string }>,
		};
		const client = makeClient({ calls });
		const r = await createChannel(client, "tagged", config, {
			topic: "what we ship here",
		});
		expect(r.ok).toBe(true);
		expect(calls.setTopic).toEqual([
			{ channel: "C_NEW", topic: "what we ship here" },
		]);
		expect(r.details?.topic).toBe("what we ship here");
	});

	it("returns ok=false on Slack name_taken", async () => {
		const client = makeClient({
			createResult: { ok: false, error: "name_taken" },
		});
		const r = await createChannel(client, "exists", config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("name_taken");
	});

	it("rejects empty name without calling Slack", async () => {
		const calls = { create: [] as Array<{ name: string; is_private?: boolean }> };
		const client = makeClient({ calls });
		const r = await createChannel(client, "  ", config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("empty_name");
		expect(calls.create.length).toBe(0);
	});
});

describe("inviteToChannel", () => {
	it("resolves emails and joins ids comma-separated", async () => {
		const calls = {
			invite: [] as Array<{ channel: string; users: string }>,
		};
		const client = makeClient({
			channelsByName: { dev: "C_DEV" },
			emailMap: {
				"a@askeffi.ai": "U_A",
				"b@askeffi.ai": "U_B",
			},
			calls,
		});
		const r = await inviteToChannel(
			client,
			"#dev",
			["a@askeffi.ai", "b@askeffi.ai"],
			config,
		);
		expect(r.ok).toBe(true);
		expect(calls.invite).toEqual([{ channel: "C_DEV", users: "U_A,U_B" }]);
	});

	it("collects per-user resolution failures and proceeds with the rest", async () => {
		const calls = {
			invite: [] as Array<{ channel: string; users: string }>,
		};
		const client = makeClient({
			channelsByName: { dev: "C_DEV" },
			emailMap: { "a@askeffi.ai": "U_A" },
			calls,
		});
		const r = await inviteToChannel(
			client,
			"#dev",
			["a@askeffi.ai", "ghost@askeffi.ai"],
			config,
		);
		expect(r.ok).toBe(true);
		expect(calls.invite[0]?.users).toBe("U_A");
		const failures = (r.details?.resolution_failures ?? []) as Array<{
			input: string;
		}>;
		expect(failures.length).toBe(1);
		expect(failures[0]?.input).toBe("ghost@askeffi.ai");
	});

	it("returns ok=false when no user could be resolved", async () => {
		const client = makeClient({
			channelsByName: { dev: "C_DEV" },
			emailMap: {},
		});
		const r = await inviteToChannel(client, "#dev", ["ghost@askeffi.ai"], config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("no_users_resolved");
	});

	it("returns ok=false when no users provided", async () => {
		const client = makeClient({ channelsByName: { dev: "C_DEV" } });
		const r = await inviteToChannel(client, "#dev", [], config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("no_users");
	});
});

describe("joinChannel", () => {
	it("calls conversations.join with the resolved id", async () => {
		const calls = { join: [] as Array<{ channel: string }> };
		const client = makeClient({
			channelsByName: { dev: "C_DEV" },
			calls,
		});
		const r = await joinChannel(client, "#dev", config);
		expect(r.ok).toBe(true);
		expect(calls.join).toEqual([{ channel: "C_DEV" }]);
	});

	it("surfaces missing_scope verbatim", async () => {
		const client = makeClient({
			channelsByName: { dev: "C_DEV" },
			joinResult: { ok: false, error: "missing_scope" },
		});
		const r = await joinChannel(client, "#dev", config);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("missing_scope");
	});
});

describe("archiveChannel", () => {
	it("calls conversations.archive on the resolved id", async () => {
		const calls = { archive: [] as Array<{ channel: string }> };
		const client = makeClient({
			channelsByName: { dev: "C_DEV" },
			calls,
		});
		const r = await archiveChannel(client, "#dev", config);
		expect(r.ok).toBe(true);
		expect(calls.archive).toEqual([{ channel: "C_DEV" }]);
	});
});

describe("setChannelTopic / setChannelPurpose", () => {
	it("sets topic", async () => {
		const calls = {
			setTopic: [] as Array<{ channel: string; topic: string }>,
		};
		const client = makeClient({
			channelsByName: { dev: "C_DEV" },
			calls,
		});
		const r = await setChannelTopic(client, "#dev", "ship daily", config);
		expect(r.ok).toBe(true);
		expect(r.verb).toBe("topic");
		expect(calls.setTopic).toEqual([{ channel: "C_DEV", topic: "ship daily" }]);
	});

	it("sets purpose", async () => {
		const calls = {
			setPurpose: [] as Array<{ channel: string; purpose: string }>,
		};
		const client = makeClient({
			channelsByName: { dev: "C_DEV" },
			calls,
		});
		const r = await setChannelPurpose(
			client,
			"#dev",
			"durable artifacts",
			config,
		);
		expect(r.ok).toBe(true);
		expect(r.verb).toBe("purpose");
		expect(calls.setPurpose).toEqual([
			{ channel: "C_DEV", purpose: "durable artifacts" },
		]);
	});
});

describe("listChannelMembers", () => {
	it("paginates members and enriches with users.info", async () => {
		const client = makeClient({
			channelsByName: { dev: "C_DEV" },
			membersPages: [
				{ members: ["U1", "U2"], next: "page2" },
				{ members: ["U3"] },
			],
			usersInfoMap: {
				U1: {
					ok: true,
					user: {
						id: "U1",
						name: "alice",
						profile: { email: "alice@askeffi.ai" },
					},
				},
				U2: {
					ok: true,
					user: { id: "U2", name: "bob" },
				},
				U3: { ok: false },
			},
		});
		const r = await listChannelMembers(client, "#dev", config);
		expect(r.ok).toBe(true);
		expect(r.members?.length).toBe(3);
		expect(r.members?.[0]?.email).toBe("alice@askeffi.ai");
		expect(r.members?.[1]?.email).toBeUndefined();
		expect(r.members?.[2]?.id).toBe("U3");
	});
});

describe("formatOpHuman / formatOpJson", () => {
	it("renders a successful create line with channel id", () => {
		const out = formatOpHuman({
			ok: true,
			verb: "create",
			channel: "C_NEW",
			channelInput: "new-room",
			tokenMask: "xoxb…CdEf",
		});
		expect(out).toContain("create OK");
		expect(out).toContain("C_NEW");
	});

	it("renders missing_scope hint on failure", () => {
		const out = formatOpHuman({
			ok: false,
			verb: "join",
			channelInput: "#dev",
			error: "missing_scope",
			tokenMask: "xoxb…CdEf",
		});
		expect(out).toContain("FAILED");
		expect(out).toContain("missing_scope");
		expect(out).toContain("Lihu-please-add-these");
	});

	it("never includes the raw token", () => {
		const out = formatOpHuman({
			ok: false,
			verb: "create",
			error: "name_taken",
			tokenMask: "xoxb…CdEf",
		});
		expect(out).not.toContain("1234-5678");
	});

	it("JSON output uses snake_case for cross-tool consumption", () => {
		const j = JSON.parse(
			formatOpJson({
				ok: true,
				verb: "create",
				channel: "C_NEW",
				channelInput: "new",
				tokenMask: "xoxb…CdEf",
			}),
		);
		expect(j.channel_input).toBe("new");
		expect(j.token).toBe("xoxb…CdEf");
	});
});
