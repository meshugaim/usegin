/**
 * `recover file <entity_type> <entity_id>` — un-stick a single sync item.
 *
 * Dry-run by default. Pass --execute to actually call the RPC. For
 * production mutations, also requires --yes-i-am-sure.
 */

import { Command } from "commander";
import {
  getSyncItem,
  parseEntityType,
  resetStuckSyncItem,
  type ResetResult,
  type StuckItem,
} from "../lib/api";
import { bold, cyan, dim, green, red, yellow } from "../lib/colors";
import { parseEnv, projectRefFor, requireProdConfirmation } from "../lib/envs";
import { formatResetResults, formatStuckItems } from "../lib/format";

export function createFileCommand(): Command {
  return new Command("file")
    .description("Un-stick a single sync item by entity_type + entity_id")
    .argument("<entity_type>", "one of: file, email, attachment, drive, meeting_summary, meeting_transcript, sharepoint")
    .argument("<entity_id>", "UUID of the entity")
    // Intentionally NOT .requiredOption: we let parseEnv throw the friendly
    // "must be one of: production, staging" message instead of commander's
    // default "required option not specified".
    .option("-e, --env <environment>", "production or staging")
    .option("--execute", "actually perform the reset (default: dry-run)", false)
    .option("--yes-i-am-sure", "required for production + --execute", false)
    .option("--actor <name>", "recorded as triggered_by on the event", "recover_cli")
    .option("--json", "machine-readable JSON output", false)
    .addHelpText(
      "after",
      `
Examples:
  recover file drive f52c2f20-5748-4493-98c3-e3747f586d6f -e staging
  recover file drive f52c2f20-5748-4493-98c3-e3747f586d6f -e production --execute --yes-i-am-sure
  recover file drive f52c2f20-5748-4493-98c3-e3747f586d6f -e production --json

By default this is a dry-run: it shows the current state of the item and
what the reset *would* do, without touching anything. Re-run with --execute
to actually perform the reset.
`
    )
    .action(async (entityTypeArg: string, entityIdArg: string, opts) => {
      const env = parseEnv(opts.env);
      const entityType = parseEntityType(entityTypeArg);
      const execute = Boolean(opts.execute);
      const yesIAmSure = Boolean(opts.yesIAmSure);
      const actor = String(opts.actor);
      const json = Boolean(opts.json);

      requireProdConfirmation(env, execute, yesIAmSure);

      const projectRef = projectRefFor(env);

      // 1. Fetch current state.
      const current = await getSyncItem(projectRef, entityType, entityIdArg);

      if (!current) {
        if (json) {
          console.log(JSON.stringify({ action: "not_found", entity_type: entityType, entity_id: entityIdArg }));
        } else {
          console.log(
            `${yellow("not found")}: no sync_item for ${entityType}/${entityIdArg} in ${env}`
          );
        }
        process.exit(1);
      }

      if (json && !execute) {
        console.log(JSON.stringify({ mode: "dry_run", current }, null, 2));
        return;
      }

      if (!execute) {
        console.log(bold(`${cyan("recover")} ${dim(`(${env}, dry-run)`)}`));
        console.log(formatStuckItems([current]));
        const isStuck = isStuckStatus(current.gfs_sync_status);
        if (isStuck) {
          console.log(
            `\n${dim("would:")} reset ${entityType}/${entityIdArg} ${dim("→")} ${green("pending")}`
          );
          console.log(dim("re-run with --execute to apply"));
        } else {
          console.log(
            `\n${dim("nothing to do:")} item is ${green(current.gfs_sync_status)}`
          );
        }
        return;
      }

      // 2. Execute.
      const result = await resetStuckSyncItem(
        projectRef,
        entityType,
        entityIdArg,
        actor
      );

      if (json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(
        bold(`${cyan("recover")} ${dim(`(${env}, execute, actor=${actor})`)}`)
      );
      console.log(formatResetResults([result]));
      if (result.action === "reset") {
        console.log(
          `\n${green("✓")} ${entityType}/${entityIdArg} reset. The worker will pick it up on the next cycle.`
        );
      } else if (result.action === "already_clean") {
        console.log(`\n${dim("already clean — no change")}`);
      } else {
        console.log(`\n${red("✗ not found")}`);
        process.exit(1);
      }
    });
}

function isStuckStatus(status: string): boolean {
  return (
    status === "deleted" ||
    status === "retry_exhausted" ||
    status === "upload_failed" ||
    status === "excluded"
  );
}
