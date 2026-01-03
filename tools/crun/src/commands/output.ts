import { Command } from "commander";
import { homedir } from "os";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { resolveUniqueSessionId } from "../session";

const PM2_LOG_DIR = join(homedir(), ".pm2", "logs");

export function createOutputCommand(): Command {
  const cmd = new Command("output")
    .description("Read output from a completed or running crun process")
    .argument("<session-id>", "Session ID (full or short prefix)")
    .option("--error", "Show stderr instead of stdout")
    .option("--both", "Show both stdout and stderr")
    .action(async (sessionId: string, opts) => {
      await runOutput(sessionId, opts);
    });

  return cmd;
}

async function runOutput(
  sessionId: string,
  opts: { error?: boolean; both?: boolean }
): Promise<void> {
  try {
    // Resolve short ID to full session ID
    const fullSessionId = await resolveUniqueSessionId(sessionId);

    // Find log files for this session
    const files = await readdir(PM2_LOG_DIR);
    const outLog = files.find(
      (f) => f.includes(fullSessionId) && f.endsWith("-out.log")
    );
    const errLog = files.find(
      (f) => f.includes(fullSessionId) && f.endsWith("-error.log")
    );

    if (!outLog && !errLog) {
      console.error(`No logs found for session: ${fullSessionId}`);
      process.exit(1);
    }

    if (opts.both) {
      if (errLog) {
        console.log("=== STDERR ===");
        const errContent = await readFile(join(PM2_LOG_DIR, errLog), "utf-8");
        console.log(errContent || "(empty)");
      }
      if (outLog) {
        console.log("\n=== STDOUT ===");
        const outContent = await readFile(join(PM2_LOG_DIR, outLog), "utf-8");
        console.log(outContent || "(empty)");
      }
    } else if (opts.error) {
      if (!errLog) {
        console.error("No error log found");
        process.exit(1);
      }
      const content = await readFile(join(PM2_LOG_DIR, errLog), "utf-8");
      console.log(content || "(empty)");
    } else {
      if (!outLog) {
        console.error("No output log found");
        process.exit(1);
      }
      const content = await readFile(join(PM2_LOG_DIR, outLog), "utf-8");
      console.log(content || "(empty)");
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
