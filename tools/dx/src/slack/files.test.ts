/**
 * Unit tests for `dx slack files upload` (uploadV2).
 *
 * Part of: ENG-5760
 */

import { describe, expect, it } from "bun:test";
import {
	formatUploadHuman,
	formatUploadJson,
	uploadFile,
	type SlackFilesClient,
	type SlackUploadV2Response,
} from "./files";

const config = { botToken: "xoxb-1234-5678-AbCdEf" };

interface UploadCall {
	channel_id?: string;
	filename: string;
	title?: string;
	initial_comment?: string;
	bytes: number;
}

function fakeClient(opts: {
	channelsByName?: Record<string, string>;
	uploadResult?: SlackUploadV2Response;
	uploadCalls?: UploadCall[];
}): SlackFilesClient {
	return {
		conversations: {
			async list() {
				return {
					ok: true,
					channels: Object.entries(opts.channelsByName ?? {}).map(
						([name, id]) => ({ id, name }),
					),
					response_metadata: {},
				};
			},
		},
		files: {
			async uploadV2(args) {
				opts.uploadCalls?.push({
					channel_id: args.channel_id,
					filename: args.filename,
					title: args.title,
					initial_comment: args.initial_comment,
					bytes: args.file.byteLength,
				});
				return (
					opts.uploadResult ?? {
						ok: true,
						files: [
							{
								id: "F_NEW",
								name: args.filename,
								permalink:
									"https://askeffi.slack.com/files/U_BOT/F_NEW/" +
									args.filename,
							},
						],
					}
				);
			},
		},
	};
}

describe("uploadFile", () => {
	it("uploads a buffer to the resolved channel", async () => {
		const uploadCalls: UploadCall[] = [];
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			uploadCalls,
		});
		const r = await uploadFile(
			client,
			"#dev",
			Buffer.from("hello world"),
			"hello.txt",
			config,
		);
		expect(r.ok).toBe(true);
		expect(r.fileId).toBe("F_NEW");
		expect(r.permalink).toContain("hello.txt");
		expect(uploadCalls[0]?.channel_id).toBe("C_DEV");
		expect(uploadCalls[0]?.bytes).toBe(11);
	});

	it("passes title and initial_comment through", async () => {
		const uploadCalls: UploadCall[] = [];
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			uploadCalls,
		});
		await uploadFile(
			client,
			"#dev",
			Buffer.from("x"),
			"x.txt",
			config,
			{ title: "T", initialComment: "see this" },
		);
		expect(uploadCalls[0]?.title).toBe("T");
		expect(uploadCalls[0]?.initial_comment).toBe("see this");
	});

	it("handles uploadV2 returning a single `file` (not files[])", async () => {
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			uploadResult: {
				ok: true,
				file: { id: "F_SINGLE", name: "x.txt", permalink: "https://x" },
			},
		});
		const r = await uploadFile(
			client,
			"#dev",
			Buffer.from("x"),
			"x.txt",
			config,
		);
		expect(r.ok).toBe(true);
		expect(r.fileId).toBe("F_SINGLE");
	});

	it("rejects empty filename without an API call", async () => {
		const uploadCalls: UploadCall[] = [];
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			uploadCalls,
		});
		const r = await uploadFile(
			client,
			"#dev",
			Buffer.from("x"),
			"",
			config,
		);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("empty_filename");
		expect(uploadCalls.length).toBe(0);
	});

	it("rejects empty buffer without an API call", async () => {
		const uploadCalls: UploadCall[] = [];
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			uploadCalls,
		});
		const r = await uploadFile(
			client,
			"#dev",
			Buffer.from(""),
			"x.txt",
			config,
		);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("empty_file");
		expect(uploadCalls.length).toBe(0);
	});

	it("surfaces missing_scope when files:write isn't granted", async () => {
		const client = fakeClient({
			channelsByName: { dev: "C_DEV" },
			uploadResult: { ok: false, error: "missing_scope" },
		});
		const r = await uploadFile(
			client,
			"#dev",
			Buffer.from("x"),
			"x.txt",
			config,
		);
		expect(r.ok).toBe(false);
		expect(r.error).toBe("missing_scope");
	});
});

describe("formatUploadHuman", () => {
	it("renders OK line", () => {
		const out = formatUploadHuman({
			ok: true,
			channel: "C_DEV",
			channelInput: "#dev",
			fileId: "F_NEW",
			filename: "x.txt",
			permalink: "https://x",
			tokenMask: "xoxb…CdEf",
		});
		expect(out).toContain("OK");
		expect(out).toContain("F_NEW");
	});

	it("hints on files:write missing_scope", () => {
		const out = formatUploadHuman({
			ok: false,
			channelInput: "#dev",
			filename: "x.txt",
			error: "missing_scope",
			tokenMask: "xoxb…CdEf",
		});
		expect(out).toContain("files:write");
	});
});

describe("formatUploadJson", () => {
	it("renders snake_case JSON", () => {
		const j = JSON.parse(
			formatUploadJson({
				ok: true,
				channel: "C_DEV",
				channelInput: "#dev",
				fileId: "F_NEW",
				filename: "x.txt",
				permalink: "https://x",
				tokenMask: "xoxb…CdEf",
			}),
		);
		expect(j.file_id).toBe("F_NEW");
		expect(j.permalink).toBe("https://x");
	});
});
