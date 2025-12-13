import { Command } from "commander";
// Bun supports importing text files directly
import alignContent from "./align.md" with { type: "text" };

export function createAlignCommand(): Command {
  const cmd = new Command("align")
    .description("Output collaboration norms and workflow philosophy")
    .action((_options, command) => {
      console.log(alignContent);
      console.log("\n---\n");
      command.parent?.outputHelp();
    });

  return cmd;
}
