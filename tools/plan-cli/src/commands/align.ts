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
    values: [
      "Connectedness - build a web of related issues",
      "Clarity - simple titles, labels carry type",
      "Traceability - commits mention issues",
      "Presence - start what you work on, close what you finish",
    ],
    practices: {
      labels: "Use labels for type: bug, feature, chore, docs",
      connectBeforeCreating: "Consider how new issues fit into existing work",
      oneSourceOfTruth: "Linear is where work lives - not markdown files or other todo tools",
    },
  };

  console.log(JSON.stringify(data, null, 2));
}
