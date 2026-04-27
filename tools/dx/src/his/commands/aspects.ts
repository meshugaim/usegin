import { Command } from "commander";
import { listAspects, type Bucket } from "../aspects";
import { dxShouldOutputJson } from "../../output";

export function buildHisAspectsCommand(): Command {
  return new Command("aspects")
    .description("List registered rating aspects.")
    .option("--bucket <bucket>", "Filter by bucket: human | claude | shared")
    .action(actionAspects);
}

async function actionAspects(opts: { bucket?: string }) {
  const bucket = opts.bucket as Bucket | undefined;
  const aspects = listAspects(bucket);

  if (dxShouldOutputJson()) {
    process.stdout.write(JSON.stringify(aspects, null, 2) + "\n");
    return;
  }

  for (const a of aspects) {
    const aliases = a.aliases.length ? `  (${a.aliases.join(", ")})` : "";
    const hint = a.hint ? `  — ${a.hint}` : "";
    process.stdout.write(`[${a.bucket}] ${a.key}${aliases}${hint}\n`);
  }
}
