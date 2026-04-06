import { parseSession, listRelatedFiles, StreamingParser, withTimeout } from "../parser";
import { formatNarrative, formatMarkdown, formatTerminal, formatToolFilter, dedupTaskNotifications, type FormatOptions } from "../formatter";
import { formatStats } from "../formatter-stats";
import { buildTimeline } from "../timeline";
import { formatTimeline } from "../formatter-timeline";
import { buildJsonOutput } from "../json-format";
import { getSessionCommits } from "../git-commits";
import { resolveSessionPath } from "../finder";
import { debugLog } from "../debug";
import { sliceTurns, formatPositionHeader } from "../incremental";
import { filterNotifications } from "../filter-notifications";
import { parseTimestampArg, filterByTimestamp, resolveCommitTimestamp } from "../filter-by-timestamp";
import type { MainArgs } from "../cli-args-main";
import { buildIssuesCommand } from "../cli-args-main";

/**
 * Check if debug mode is enabled via --debug flag or DEBUG=session env var
 */
function isDebugEnabled(args: MainArgs): boolean {
  return args.debug || process.env.DEBUG === "session";
}

export async function runParse(args: MainArgs) {
  try {
    // Stream mode - read from stdin
    if (args.stream) {
      const parser = new StreamingParser({
        toolInput: args.toolInput,
        toolOutput: args.toolOutput,
        truncate: args.truncate,
      });

      const decoder = new TextDecoder();
      const stream = Bun.stdin.stream();
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const output = parser.feed(decoder.decode(value));
          for (const line of output) {
            console.log(line);
            console.log("");
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Flush remaining
      const final = parser.end();
      for (const line of final) {
        console.log(line);
      }
      return;
    }

    // --issues: delegate to `plan list --session <id> --json`
    if (args.issues) {
      const cmd = buildIssuesCommand(args.file);
      console.error(`→ ${cmd.join(" ")}`);
      const proc = Bun.spawn(cmd, {
        stdout: "inherit",
        stderr: "inherit",
      });
      const exitCode = await proc.exited;
      process.exit(exitCode);
    }

    const debug = isDebugEnabled(args);
    const totalStart = Date.now();

    // Resolve session ID to path if needed
    const filePath = await resolveSessionPath(args.file);

    // List related files mode - just print file paths
    if (args.listFiles) {
      const files = await listRelatedFiles(filePath);
      for (const file of files) {
        console.log(file);
      }
      return;
    }

    // Always discover subagents — btw aside questions are part of the session
    // narrative and should be visible in every format, not just --subagents.
    const includeSubagents = true;

    // Parse session with debug timing and timeout
    let stepStart = Date.now();
    debugLog(debug, "Parsing session...");
    let session = await withTimeout(
      parseSession(filePath, {
        includeSubagents,
        includeWarmups: args.includeWarmups,
        debug,
      }),
      args.timeout
    );
    debugLog(debug, `Parsed ${session.turns.length} turns`, stepStart);

    if (includeSubagents && session.subagents.length > 0) {
      debugLog(debug, `Found ${session.subagents.length} subagent(s)`);
    }

    // Enrich session with git history commits when cwd and session ID are available.
    // Uses SHA-based discovery first (most precise), then trailer-based, then falls back to time-window.
    if (session.cwd && session.sessionId) {
      stepStart = Date.now();
      debugLog(debug, "Querying git history for commits...");
      try {
        const gitCommits = await getSessionCommits({
          cwd: session.cwd,
          sessionId: session.sessionId,
          startTime: session.startTimestamp,
          endTime: session.endTimestamp,
          shas: session.commits.map((c) => c.hash),
        });
        if (gitCommits.length > 0) {
          session.gitCommits = gitCommits;
          debugLog(debug, `Found ${gitCommits.length} git commit(s)`, stepStart);
        } else {
          debugLog(debug, "No git commits found for session", stepStart);
        }
      } catch {
        // Graceful degradation: git history is best-effort enrichment.
        // Fall back to regex-extracted commits if this fails.
        debugLog(debug, "Git history query failed, using regex commits", stepStart);
      }
    }

    // --- Exclude task-notification turns (before windowing so --last N gives N real turns) ---
    if (args.excludeNotifications) {
      session = { ...session, turns: filterNotifications(session.turns) };
    }

    // --- Timestamp filter (before windowing so --last N gives N real turns) ---
    if (args.sinceTimestamp) {
      const since = parseTimestampArg(args.sinceTimestamp);
      session = { ...session, turns: filterByTimestamp(session.turns, since) };
    }

    // --- Commit-based timestamp filter (sugar over sinceTimestamp) ---
    if (args.sinceCommit) {
      const commitDate = await resolveCommitTimestamp(args.sinceCommit, session.cwd);
      session = { ...session, turns: filterByTimestamp(session.turns, commitDate) };
    }

    // --- Turn windowing (--since-turn, --last) ---
    const sliceResult = sliceTurns(session.turns, {
      sinceTurn: args.sinceTurn,
      last: args.last,
    });

    if (args.sinceTurn != null || args.last != null) {
      session = { ...session, turns: sliceResult.turns };
      const header = formatPositionHeader({
        windowStart: sliceResult.windowStart,
        turnCount: sliceResult.turns.length,
        totalTurns: sliceResult.totalTurns,
      });
      if (header) {
        console.log(header);
        console.log();
      }
    }

    // Deduplicate task notifications (queued + delivered with same task-id)
    session = { ...session, turns: dedupTaskNotifications(session.turns) };

    // --timeline: standalone output mode showing chronological event flow
    if (args.timeline) {
      const events = buildTimeline(session, { reportLines: args.reportLines });
      const isTTY = process.stdout.isTTY !== false;
      const lines = formatTimeline(events, { showHints: isTTY, showTools: args.showTools });
      debugLog(debug, "Total parse time", totalStart);
      console.log(lines.join("\n"));
      return;
    }

    // --tool / --tools filter: standalone output mode that replaces normal formatting
    if (args.tool || args.tools) {
      const toolNames = args.tools
        ? args.tools.split(",").map((t) => t.trim())
        : [args.tool!];
      const options: Partial<FormatOptions> = {
        toolInput: args.toolInput,
        toolOutput: args.toolOutput,
        truncate: args.truncate,
      };
      const toolOutput = formatToolFilter(session, toolNames, options);
      debugLog(debug, "Total parse time", totalStart);
      console.log(toolOutput);
      return;
    }

    // Format output with debug timing
    stepStart = Date.now();
    debugLog(debug, `Formatting as ${args.format}...`);
    const options: Partial<FormatOptions> = {
      toolInput: args.toolInput,
      toolOutput: args.toolOutput,
      truncate: args.truncate,
      includeSubagents: args.subagents,
      commits: args.commits,
    };

    let output: string;
    switch (args.format) {
      case "json": {
        const jsonOutput = buildJsonOutput(session, args.truncate);
        output = JSON.stringify(jsonOutput, null, 2);
        break;
      }
      case "stats": {
        const showHints = process.stdout.isTTY !== false;
        output = formatStats(session, { showHints });
        break;
      }
      case "terminal":
        output = formatTerminal(session, options);
        break;
      case "markdown":
        output = formatMarkdown(session);
        break;
      case "narrative":
      default:
        output = formatNarrative(session, options);
        break;
    }
    debugLog(debug, "Formatting complete", stepStart);
    debugLog(debug, "Total parse time", totalStart);
    console.log(output);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
