import { Command } from "commander";
import { getAutoCompactEnabled, setAutoCompactEnabled } from "../lib/settings";

export function createAutocompactCommand(): Command {
  const autocompact = new Command("autocompact")
    .description("Manage auto-compact setting in ~/.claude/settings.json")
    .argument("[state]", "on/off to enable/disable, omit to show current state")
    .action(async (state?: string) => {
      if (!state) {
        // Show current state
        const enabled = await getAutoCompactEnabled();
        if (enabled === undefined) {
          console.log("autocompact: not set");
        } else {
          console.log(`autocompact: ${enabled ? "on" : "off"}`);
        }
        return;
      }

      if (state === "on") {
        await setAutoCompactEnabled(true);
        console.log("autocompact: on");
      } else if (state === "off") {
        await setAutoCompactEnabled(false);
        console.log("autocompact: off");
      } else {
        console.error(`Error: Invalid state "${state}". Use "on" or "off".`);
        process.exit(1);
      }
    });

  return autocompact;
}
