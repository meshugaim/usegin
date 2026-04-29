/**
 * `dx evals` — UseGin eval runner CLI surface.
 *
 * S3 (ENG-BUILD-PLAN): single-axis runner (`run`). One model × one prompt ×
 * one suite of cases; Opus judge per DoG; results to usegin/evals/<corpus>/runs/.
 *
 * Mirrors `slack/index.ts` shape exactly.
 *
 * See usegin/evals/BUILD-PLAN.md for slice sequencing.
 */

import { Command } from "commander";
import { buildEvalsRunCommand } from "./commands/run";
import { buildEvalsIterateCommand } from "./commands/iterate";

export function buildEvalsCommand(): Command {
  const cmd = new Command("evals").description(
    "Eval runner — score Effi and Gin against Definitions of Good.",
  );
  cmd.addCommand(buildEvalsRunCommand());
  cmd.addCommand(buildEvalsIterateCommand());
  return cmd;
}
