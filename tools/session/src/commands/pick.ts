import { openSessionPicker } from "../finder";
import { parsePickArgs } from "../cli-args";

export async function runPick(args: string[]) {
  const pickArgs = parsePickArgs(args);

  try {
    const result = await openSessionPicker({
      allProjects: pickArgs.allProjects,
      since: pickArgs.since,
      method: pickArgs.method,
    });

    if (result) {
      // Output as JSON for Claude to parse
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error("No session selected");
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
