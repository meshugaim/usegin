import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

/**
 * Configuration schema for the conversation watcher
 */
export const configSchema = z.object({
	username: z.string().min(1, "Username is required"),
	repoUrl: z.string().url("Repository URL must be a valid URL"),
	cloneDir: z
		.string()
		.default(() => join(homedir(), ".conversation-watcher", "repo")),
	watchDir: z
		.string()
		.default(() => join(homedir(), ".config", "Claude Code", "conversations")),
	debounceMs: z.number().min(100).max(60000).default(2000),
	detached: z.boolean().default(true),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Default configuration values
 */
export const defaults = {
	cloneDir: join(homedir(), ".conversation-watcher", "repo"),
	watchDir: join(homedir(), ".config", "Claude Code", "conversations"),
	debounceMs: 2000,
	detached: true,
} as const;
