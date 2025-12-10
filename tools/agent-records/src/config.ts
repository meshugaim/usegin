import { z } from "zod";
import { homedir } from "node:os";
import { join } from "node:path";

export const configSchema = z.object({
	recordsDir: z.string().default(join(homedir(), "agent-records")),
});

export type Config = z.infer<typeof configSchema>;

export const defaults = {
	recordsDir: join(homedir(), "agent-records"),
} as const;

/**
 * Get username from git config
 */
export async function getGitUsername(): Promise<string | null> {
	try {
		const proc = Bun.spawn(["git", "config", "user.name"], {
			stdout: "pipe",
		});
		const text = await new Response(proc.stdout).text();
		const username = text.trim();
		return username || null;
	} catch {
		return null;
	}
}

/**
 * Convert username to kebab-case for directory names
 */
export function toKebabCase(str: string): string {
	return str
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}
