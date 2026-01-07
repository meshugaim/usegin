import { Command } from "commander";
import { SentryClient } from "../../../lib/sentry-api";
import {
  parseRrwebEvents,
  formatReplayTimeline,
  formatReplayJson,
  type RrwebEvent,
} from "../lib/replay-format";

const DEFAULT_ORG = "askeffi";

export function createReplayCommand(): Command {
  return new Command("replay")
    .description("Analyze Sentry session replay data")
    .argument("<replay-id>", "Replay ID (32-character hex string)")
    .option("-o, --org <org>", "Organization slug", DEFAULT_ORG)
    .option("-p, --project <project>", "Project slug (auto-detected if not provided)")
    .option(
      "-t, --type <type>",
      "Filter event type (mutation, click, input, scroll, error, hydration)"
    )
    .option("--json", "Output as JSON")
    .action(async (replayId: string, opts: ReplayOptions) => {
      await runReplayCommand(replayId, opts);
    });
}

interface ReplayOptions {
  org: string;
  project?: string;
  type?: string;
  json?: boolean;
}

interface ReplayMetadata {
  id: string;
  project?: { id: string; slug: string };
  started_at?: string;
  finished_at?: string;
  duration?: number;
  count_errors?: number;
  urls?: string[];
}

async function runReplayCommand(
  replayId: string,
  opts: ReplayOptions
): Promise<void> {
  try {
    const client = new SentryClient({ org: opts.org });

    // Fetch replay metadata (API returns data nested under 'data' key)
    const replayResponse = (await client.getReplay(replayId)) as
      | ReplayMetadata
      | { data: ReplayMetadata };
    const replay = "data" in replayResponse ? replayResponse.data : replayResponse;

    // Determine project slug
    const projectSlug = opts.project || replay.project?.slug;
    if (!projectSlug) {
      console.error("Error: Could not determine project. Use --project option.");
      process.exit(1);
    }

    // Fetch replay segments
    const segments = (await client.getReplaySegments(
      replayId,
      projectSlug
    )) as RrwebEvent[][] | RrwebEvent[];

    // Flatten segments into events array
    const events = flattenSegments(segments);

    // Parse events
    const parsed = parseRrwebEvents(events, {
      type: opts.type,
      includeRaw: opts.json,
    });

    // Output header info
    if (!opts.json) {
      printReplayHeader(replay, opts.org);
    }

    // Format output
    if (opts.json) {
      console.log(formatReplayJson(parsed));
    } else {
      console.log(formatReplayTimeline(parsed));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

function flattenSegments(segments: RrwebEvent[][] | RrwebEvent[]): RrwebEvent[] {
  // Segments can be an array of arrays or a flat array
  if (segments.length === 0) return [];

  // Check if first element is an array
  if (Array.isArray(segments[0]) && "type" in segments[0] === false) {
    // Array of arrays - flatten
    return (segments as RrwebEvent[][]).flat();
  }

  // Already flat
  return segments as RrwebEvent[];
}

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function printReplayHeader(replay: ReplayMetadata, org: string): void {
  console.log(`${colors.bold}Replay:${colors.reset} ${colors.cyan}${replay.id}${colors.reset}`);

  if (replay.started_at) {
    const start = new Date(replay.started_at).toLocaleString();
    console.log(`${colors.bold}Started:${colors.reset} ${start}`);
  }

  if (replay.duration) {
    const mins = Math.floor(replay.duration / 60);
    const secs = replay.duration % 60;
    console.log(`${colors.bold}Duration:${colors.reset} ${mins}m ${secs}s`);
  }

  if (replay.count_errors !== undefined) {
    console.log(`${colors.bold}Errors:${colors.reset} ${replay.count_errors}`);
  }

  if (replay.urls && replay.urls.length > 0) {
    console.log(`${colors.bold}URLs:${colors.reset}`);
    for (const url of replay.urls.slice(0, 5)) {
      console.log(`  ${colors.dim}${url}${colors.reset}`);
    }
  }

  const replayUrl = `https://sentry.io/organizations/${org}/replays/${replay.id}/`;
  console.log(`${colors.bold}View:${colors.reset} ${colors.blue}${replayUrl}${colors.reset}`);
  console.log("");
}
