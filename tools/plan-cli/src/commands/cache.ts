import { Command } from "commander";
import { clearCache, getCacheStats } from "../lib/cache";

export function createCacheCommand(): Command {
  const cmd = new Command("cache")
    .description("Manage the API response cache");

  cmd
    .command("clear")
    .description("Clear all cached data")
    .action(async () => {
      await clearCache();
      console.log("Cache cleared");
    });

  cmd
    .command("status")
    .description("Show cache statistics")
    .action(async () => {
      const stats = await getCacheStats();
      console.log("Cache status:");
      console.log(`  Teams: ${stats.teams} cached`);
      console.log(`  States: ${stats.states} team(s) cached`);
      console.log(`  Labels: ${stats.labels} team(s) cached`);
      console.log(`  Projects: ${stats.projects} cached`);
      console.log(`  Viewer: ${stats.hasViewer ? "cached" : "not cached"}`);
    });

  return cmd;
}
