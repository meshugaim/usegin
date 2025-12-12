import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";
import { printApiStats } from "../lib/stats";

export function createLabelsCommand(): Command {
  const cmd = new Command("labels")
    .description("List available labels")
    .option("--team <key>", "Team key (e.g., ENG)")
    .option("--json", "Output as JSON")
    .option("--stats", "Show API call statistics")
    .action(async (opts) => {
      await runLabels(opts);
    });

  return cmd;
}

async function runLabels(opts: {
  team?: string;
  json?: boolean;
  stats?: boolean;
}): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("Error: LINEAR_API_KEY environment variable is required");
    process.exit(2);
  }

  try {
    const client = new LinearClient({ apiKey });

    // Get team (optional - for team-specific labels)
    const teamKey = opts.team ?? process.env.PLAN_TEAM;
    let teamId: string | undefined;
    let teamName: string | undefined;

    if (teamKey) {
      const team = await client.getTeamByKey(teamKey);
      if (!team) {
        const teams = await client.getAllTeams();
        const available = teams.map((t) => t.key).join(", ");
        console.error(`Error: Team "${teamKey}" not found. Available teams: ${available}`);
        process.exit(1);
      }
      teamId = team.id;
      teamName = team.name;
    } else {
      const defaultTeam = await client.getDefaultTeam();
      if (defaultTeam) {
        teamId = defaultTeam.id;
        teamName = defaultTeam.name;
      }
    }

    // Get team labels
    const teamLabels = teamId ? await client.getLabelsForTeam(teamId) : [];

    // Get workspace labels
    const workspaceLabels = await client.getWorkspaceLabels();

    // Combine and dedupe
    const allLabels = new Map<string, { name: string; scope: string }>();

    for (const label of teamLabels) {
      allLabels.set(label.name.toLowerCase(), { name: label.name, scope: "team" });
    }

    for (const label of workspaceLabels) {
      if (!allLabels.has(label.name.toLowerCase())) {
        allLabels.set(label.name.toLowerCase(), { name: label.name, scope: "workspace" });
      }
    }

    if (allLabels.size === 0) {
      console.log("No labels found");
      printApiStats(client.apiCallCount, opts.stats ?? false);
      return;
    }

    const sortedLabels = Array.from(allLabels.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    if (opts.json) {
      console.log(JSON.stringify({
        labels: sortedLabels.map((l) => l.name),
        details: sortedLabels
      }, null, 2));
    } else {
      console.log("Available labels:");
      for (const label of sortedLabels) {
        console.log(`  ${label.name}`);
      }
    }

    printApiStats(client.apiCallCount, opts.stats ?? false);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
