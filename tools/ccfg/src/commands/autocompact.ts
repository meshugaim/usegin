import { Command } from "commander";
import { getAutoCompactEnabled, setAutoCompactEnabled } from "../lib/settings";

function getProjectPath(): string {
  return process.cwd();
}

export function createAutocompactCommand(): Command {
  const autocompact = new Command("autocompact")
    .description("Manage auto-compact setting")
    .argument("[state]", "on/off to enable/disable, omit to show current state")
    .action(async (state?: string) => {
      const projectPath = getProjectPath();

      if (!state) {
        // Show current state
        const enabled = await getAutoCompactEnabled(projectPath);
        if (enabled === undefined) {
          console.log("autocompact: not set");
        } else {
          console.log(`autocompact: ${enabled ? "on" : "off"}`);
        }
        return;
      }

      if (state === "on") {
        await setAutoCompactEnabled(projectPath, true);
        console.log("autocompact: on");
      } else if (state === "off") {
        await setAutoCompactEnabled(projectPath, false);
        console.log("autocompact: off");
      } else {
        console.error(`Error: Invalid state "${state}". Use "on" or "off".`);
        process.exit(1);
      }
    });

  return autocompact;
}
