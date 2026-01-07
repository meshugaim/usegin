import { Command } from "commander";
import { SentryClient } from "../../../lib/sentry-api";
import { formatEvent, formatEventJson, type SentryEvent } from "../lib/format";

const DEFAULT_ORG = "askeffi";

export function createEventsCommand(): Command {
  const events = new Command("events").description("Manage Sentry events");

  events
    .command("show")
    .description("Show event details for an issue")
    .argument("<issue-id>", "Issue ID (e.g., NEXTJS-APP-1)")
    .argument("[event-id]", "Specific event ID (defaults to latest)")
    .option("-o, --org <org>", "Organization slug", DEFAULT_ORG)
    .option("--json", "Output as JSON")
    .action(async (issueId: string, eventId: string | undefined, opts) => {
      await runEventsShow(issueId, eventId, opts);
    });

  events
    .command("list")
    .description("List events for an issue")
    .argument("<issue-id>", "Issue ID (e.g., NEXTJS-APP-1)")
    .option("-o, --org <org>", "Organization slug", DEFAULT_ORG)
    .option("-n, --limit <n>", "Number of events to show", "10")
    .option("--json", "Output as JSON")
    .action(async (issueId: string, opts) => {
      await runEventsList(issueId, opts);
    });

  return events;
}

interface EventsShowOptions {
  org: string;
  json?: boolean;
}

async function runEventsShow(
  issueId: string,
  eventId: string | undefined,
  opts: EventsShowOptions
): Promise<void> {
  try {
    const client = new SentryClient({ org: opts.org });

    // First, get the issue to find the project slug
    const issue = (await client.getIssue(issueId)) as {
      project: { slug: string };
      shortId: string;
    };
    const projectSlug = issue.project.slug;

    let event: SentryEvent;

    if (eventId) {
      // Fetch specific event
      event = (await client.getEvent(projectSlug, eventId)) as SentryEvent;
    } else {
      // Get the latest event
      const events = (await client.listEvents(issueId, {
        full: true,
        limit: 1,
      })) as SentryEvent[];
      if (events.length === 0) {
        console.error(`No events found for issue ${issueId}`);
        process.exit(1);
      }
      event = events[0];
    }

    if (opts.json) {
      console.log(formatEventJson(event));
    } else {
      console.log(formatEvent(event, opts.org));
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

interface EventsListOptions {
  org: string;
  limit: string;
  json?: boolean;
}

async function runEventsList(
  issueId: string,
  opts: EventsListOptions
): Promise<void> {
  try {
    const client = new SentryClient({ org: opts.org });
    const limit = parseInt(opts.limit, 10);

    const events = (await client.listEvents(issueId, { limit })) as Array<{
      eventID: string;
      dateCreated: string;
      title?: string;
    }>;

    if (opts.json) {
      console.log(JSON.stringify(events, null, 2));
    } else {
      if (events.length === 0) {
        console.log("No events found");
        return;
      }

      console.log(`Events for ${issueId} (${events.length}):\n`);
      for (const event of events) {
        const date = new Date(event.dateCreated).toLocaleString();
        console.log(`  ${event.eventID}  ${date}`);
        if (event.title) {
          console.log(`    ${event.title}`);
        }
      }
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
