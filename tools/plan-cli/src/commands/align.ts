import { Command } from "commander";
// Bun supports importing text files directly
import alignContent from "./align.md" with { type: "text" };

export function createAlignCommand(): Command {
  const cmd = new Command("align")
    .description("Output collaboration norms and workflow philosophy")
    .option("--json", "Output as JSON (for programmatic use)")
    .action(async (opts) => {
      if (opts.json) {
        outputJSON();
      } else {
        outputMarkdown();
      }
    });

  return cmd;
}

function outputMarkdown(): void {
  console.log(alignContent);
}

function outputJSON(): void {
  const data = {
    concepts: {
      twoPlaces: {
        inbox: "Unprocessed ideas, questions, unclear stuff",
        list: "Actionable work, ready to execute",
      },
      ordering: "Position in list = priority. Top = next up.",
      flow: ["capture", "promote", "start", "close"],
    },
    agreements: [
      "Use plan for task tracking",
      "Check plan list for ready work",
      "Linear is source of truth",
    ],
  };

  console.log(JSON.stringify(data, null, 2));
}
