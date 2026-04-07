import { join } from "path";

/** Path to the seed tips directory shipped with this tool. */
export const SEED_TIPS_DIR = join(import.meta.dir, "..", "tips");

/** Path to the CLI entry point. */
export const CLI_PATH = join(import.meta.dir, "..", "src", "cli.ts");

/** Strip ANSI escape codes for content assertions. */
// eslint-disable-next-line no-control-regex
export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

/** Run the tip CLI with given args and return { stdout, stderr, exitCode }. */
export function runCli(
  ...args: string[]
): { stdout: string; stderr: string; exitCode: number } {
  const result = Bun.spawnSync({
    cmd: ["bun", CLI_PATH, ...args],
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}
