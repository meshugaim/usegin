/**
 * Extract and summarize user-assistant conversations from Claude Code JSONL logs.
 * Ported from scripts/extract_conversation.js
 */

export interface Message {
	role: string;
	text: string;
	uuid: string;
	parentUuid: string | null;
	timestamp: string;
}

export interface Fork {
	parentUuid: string | null;
	parentMsg: Message | null;
	branches: Message[];
}

export interface ExtractionResult {
	messages: Message[];
	messagesByUuid: Map<string, Message>;
}

/**
 * Extract user and assistant messages from a JSONL conversation log.
 * Returns an array of messages and a map of all messages by UUID for fork detection.
 */
export async function extractConversation(
	jsonlPath: string,
): Promise<ExtractionResult> {
	const messages: Message[] = [];
	const messagesByUuid = new Map<string, Message>();

	const file = Bun.file(jsonlPath);
	const content = await file.text();
	const lines = content.split("\n");

	// First pass: collect all messages with their metadata
	for (const line of lines) {
		if (!line.trim()) continue;

		try {
			const entry = JSON.parse(line);

			// Look for user or assistant message entries
			if (entry.type === "user" || entry.type === "assistant") {
				const message = entry.message || {};
				const role = message.role;
				const content = message.content;

				if (role && content) {
					const textParts: string[] = [];

					if (typeof content === "string") {
						textParts.push(content);
					} else if (Array.isArray(content)) {
						for (const item of content) {
							if (typeof item === "object") {
								// Text content
								if (item.type === "text" && item.text) {
									textParts.push(item.text);
								}
								// Skip tool use and tool results - too verbose
							} else if (typeof item === "string") {
								textParts.push(item);
							}
						}
					}

					if (textParts.length > 0) {
						const text = textParts.join("\n").trim();
						if (text) {
							const msg: Message = {
								role,
								text,
								uuid: entry.uuid,
								parentUuid: entry.parentUuid || null,
								timestamp: entry.timestamp,
							};
							messages.push(msg);
							messagesByUuid.set(entry.uuid, msg);
						}
					}
				}
			}
		} catch (_e) {}
	}

	return { messages, messagesByUuid };
}

/**
 * Detect forks/rewinds in the conversation by finding messages with the same parent.
 * Returns an array of fork points with the parent message and the forked messages.
 */
export function detectForks(
	messages: Message[],
	messagesByUuid: Map<string, Message>,
): Fork[] {
	const childrenByParent = new Map<string, Message[]>();

	// Group messages by their parent UUID (including null for root messages)
	for (const msg of messages) {
		const parentKey = msg.parentUuid || "ROOT";
		if (!childrenByParent.has(parentKey)) {
			childrenByParent.set(parentKey, []);
		}
		childrenByParent.get(parentKey)?.push(msg);
	}

	// Find parents with multiple children (fork points)
	const forks: Fork[] = [];
	for (const [parentKey, children] of childrenByParent.entries()) {
		if (children.length > 1) {
			const parentUuid = parentKey === "ROOT" ? null : parentKey;
			const parentMsg = parentUuid
				? messagesByUuid.get(parentUuid) || null
				: null;
			forks.push({
				parentUuid,
				parentMsg,
				branches: children,
			});
		}
	}

	return forks;
}

/**
 * Format extracted messages into readable conversation with fork detection.
 */
export function formatConversation(
	messages: Message[],
	messagesByUuid: Map<string, Message>,
): string {
	const forks = detectForks(messages, messagesByUuid);
	const forkPointUuids = new Set(forks.map((f) => f.parentUuid));

	const output: string[] = [];

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		if (!msg) continue;

		// Check if this message's parent is a fork point (including null/ROOT)
		const parentKey = msg.parentUuid || null;
		if (forkPointUuids.has(parentKey)) {
			const fork = forks.find((f) => f.parentUuid === parentKey);
			if (fork) {
				const branchIndex = fork.branches.findIndex((b) => b.uuid === msg.uuid);

				if (branchIndex > 0) {
					// This is not the first branch, so it's a rewind
					let rewindMessage: string;
					if (parentKey === null) {
						rewindMessage =
							"🔄 REWIND: New conversation started (back to root)";
					} else {
						const parentText = fork.parentMsg
							? `${fork.parentMsg.text.substring(0, 50).replace(/\n/g, " ")}...`
							: "previous message";
						rewindMessage = `🔄 REWIND: Conversation branched here (back to: "${parentText}")`;
					}

					output.push(`\n${"=".repeat(70)}`);
					output.push(rewindMessage);
					output.push(`${"=".repeat(70)}\n`);
				}
			}
		}

		output.push(`${msg.role.toUpperCase()}:\n${msg.text}`);
		output.push("");
	}

	return output.join("\n");
}
