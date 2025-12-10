/**
 * Check if a conversation file is a warmup conversation.
 * Warmup conversations start with exactly:
 * USER:
 * Warmup
 */
export async function isWarmupConversation(filePath: string): Promise<boolean> {
	try {
		const file = Bun.file(filePath);
		const text = await file.text();
		const lines = text.split("\n");

		// Check if first two lines match warmup pattern
		if (lines.length >= 2) {
			const firstTwo = `${lines[0]}\n${lines[1]}`;
			return firstTwo === "USER:\nWarmup";
		}

		return false;
	} catch {
		return false;
	}
}

/**
 * Filter out warmup conversations from a list of file paths
 */
export async function filterWarmups(
	filePaths: string[],
): Promise<string[]> {
	const results = await Promise.all(
		filePaths.map(async (path) => {
			const isWarmup = await isWarmupConversation(path);
			return isWarmup ? null : path;
		}),
	);

	return results.filter((path): path is string => path !== null);
}

/**
 * Check if a conversation file matches any of the given regex patterns
 */
export async function matchesContentPattern(
	filePath: string,
	patterns: string[],
): Promise<boolean> {
	if (patterns.length === 0) {
		return false;
	}

	try {
		const file = Bun.file(filePath);
		const text = await file.text();

		// Check if any pattern matches
		for (const pattern of patterns) {
			const regex = new RegExp(pattern);
			if (regex.test(text)) {
				return true;
			}
		}

		return false;
	} catch {
		return false;
	}
}

/**
 * Filter out conversations matching content patterns
 */
export async function filterByContentPatterns(
	filePaths: string[],
	patterns: string[],
): Promise<string[]> {
	if (patterns.length === 0) {
		return filePaths;
	}

	const results = await Promise.all(
		filePaths.map(async (path) => {
			const matches = await matchesContentPattern(path, patterns);
			return matches ? null : path;
		}),
	);

	return results.filter((path): path is string => path !== null);
}

/**
 * Check if a conversation file is a sub-agent conversation.
 * Sub-agent conversations have filenames matching pattern: conversation-agent-{short-hash}
 * Regular conversations have filenames matching pattern: conversation-{full-uuid}
 */
export function isSubAgentConversation(filePath: string): boolean {
	// Extract filename from path
	const filename = filePath.split("/").pop() || "";

	// Sub-agent pattern: conversation-agent-{8-char-hex}
	// Regular pattern: conversation-{uuid}
	return /conversation-agent-[0-9a-f]{8}\.txt$/.test(filename);
}

/**
 * Filter out sub-agent conversations from a list of file paths
 */
export function filterSubAgents(filePaths: string[]): string[] {
	return filePaths.filter((path) => !isSubAgentConversation(path));
}
