/**
 * `recover project <project_id>` — un-stick all stuck sync items in a project.
 *
 * Dry-run by default: lists what would be reset. --execute actually does it,
 * looping over each item and calling reset_stuck_sync_item. For production
 * mutations, requires --yes-i-am-sure.
 *
 * Optional --entity filter scopes to a single type (e.g. drive only).
 */

import { Command } from "commander";
import {
  listStuckForProject,
  parseEntityType,
  resetStuckSyncItem,
  validateUuid,
  type EntityType,
  type ResetResult,
} from "../lib/api";
import { bold, cyan, dim, green, red, yellow } from "../lib/colors";
import { parseEnv, projectRefFor, requireProdConfirmation } from "../lib/envs";
import { formatResetResults, formatStuckItems } from "../lib/format";

export function createProjectCommand(): Command {
  return new Command("project")
    .description("Un-stick every stuck sync item in a project")
    .argument("<project_id>", "UUID of the project")
    .requiredOption("-e, --env <environment>", "production or staging")
    .option(
      "--entity <type>",
      "limit to one entity type (drive, file, email, attachment, sharepoint, meeting_summary, meeting_transcript)"
    )
    .option("--execute", "actually perform the resets (default: dry-run)", false)
    .option("--yes-i-am-sure", "required for production + --execute", false)
    .option("--actor <name>", "recorded as triggered_by on events", "recover_cli")
    .option("--json", "machine-readable JSON output", false)
    .addHelpText(
      "after",
      `
Examples:
  recover project f0c450db-c147-4986-a737-b3d9787c9ef7 -e staging
  recover project f0c450db-c147-4986-a737-b3d9787c9ef7 -e staging --entity drive
  recover project f0c450db-c147-4986-a737-b3d9787c9ef7 -e production --execute --yes-i-am-sure

By default this is a dry-run: it lists stuck items without touching anything.
Re-run with --execute to reset each item in turn.
`
    )
    .action(async (projectIdArg: string, opts) => {
      const env = parseEnv(opts.env);
      const execute = Boolean(opts.execute);
      const yesIAmSure = Boolean(opts.yesIAmSure);
      const actor = String(opts.actor);
      const json = Boolean(opts.json);
      const entityFilter: EntityType | undefined = opts.entity
        ? parseEntityType(String(opts.entity))
        : undefined;

      requireProdConfirmation(env, execute, yesIAmSure);
      validateUuid(projectIdArg, "project_id");

      const projectRef = projectRefFor(env);

      // 1. List candidates.
      const stuck = await listStuckForProject(
        projectRef,
        projectIdArg,
        entityFilter
      );

      if (!execute) {
        if (json) {
          console.log(
            JSON.stringify({ mode: "dry_run", project_id: projectIdArg, env, count: stuck.length, items: stuck }, null, 2)
          );
          return;
        }
        console.log(
          bold(
            `${cyan("recover")} ${dim(
              `(${env}, dry-run, project=${projectIdArg.slice(0, 8)}…)`
            )}`
          )
        );
        console.log(formatStuckItems(stuck));
        if (stuck.length > 0) {
          console.log(
            `\n${dim("would:")} reset ${bold(
              String(stuck.length)
            )} item(s) ${dim("→")} ${green("pending")}`
          );
          console.log(dim("re-run with --execute to apply"));
        }
        return;
      }

      // 2. Execute each.
      if (stuck.length === 0) {
        if (json) {
          console.log(
            JSON.stringify({ mode: "execute", project_id: projectIdArg, env, count: 0, results: [] })
          );
        } else {
          console.log(`${dim("nothing to recover in")} ${projectIdArg}`);
        }
        return;
      }

      const results: ResetResult[] = [];
      for (const item of stuck) {
        const r = await resetStuckSyncItem(
          projectRef,
          item.entity_type,
          item.entity_id,
          actor
        );
        results.push(r);
      }

      const resetCount = results.filter((r) => r.action === "reset").length;
      const alreadyClean = results.filter((r) => r.action === "already_clean").length;
      const notFound = results.filter((r) => r.action === "not_found").length;

      if (json) {
        console.log(
          JSON.stringify(
            {
              mode: "execute",
              project_id: projectIdArg,
              env,
              summary: { reset: resetCount, already_clean: alreadyClean, not_found: notFound },
              results,
            },
            null,
            2
          )
        );
        return;
      }

      console.log(
        bold(
          `${cyan("recover")} ${dim(
            `(${env}, execute, project=${projectIdArg.slice(0, 8)}…, actor=${actor})`
          )}`
        )
      );
      console.log(formatResetResults(results));
      console.log(
        `\n${green("✓")} reset ${bold(String(resetCount))}` +
          (alreadyClean ? ` ${dim(`(already_clean: ${alreadyClean})`)}` : "") +
          (notFound ? ` ${yellow(`(not_found: ${notFound})`)}` : "")
      );
      if (resetCount > 0) {
        console.log(dim("The worker will pick up these items on its next cycle."));
      }
    });
}
