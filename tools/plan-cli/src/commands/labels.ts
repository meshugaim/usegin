import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";
import { printApiStats } from "../lib/stats";
import { shouldDefaultToJson } from "../lib/output-mode";
import { getTeamKey } from "../lib/identifier";

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

    // Get team — always resolves (PLAN_TEAM env var or "ENG" default)
    const teamKey = opts.team ?? getTeamKey();
    const team = await client.getTeamByKey(teamKey);
    if (!team) {
      const teams = await client.getAllTeams();
      const available = teams.map((t) => t.key).join(", ");
      console.error(`Error: Team "${teamKey}" not found. Available teams: ${available}`);
      process.exit(1);
    }
    const teamId = team.id;
    const teamName = team.name;

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

    const useJson = shouldDefaultToJson({
      json: opts.json,
      env: process.env,
      isTTY: process.stdout.isTTY,
    });

    if (allLabels.size === 0) {
      if (useJson) {
        console.log(JSON.stringify({ labels: [], details: [] }, null, 2));
      } else {
        console.log("No labels found");
      }
      printApiStats(client.apiCallCount, opts.stats ?? false);
      return;
    }

    const sortedLabels = Array.from(allLabels.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    if (useJson) {
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
