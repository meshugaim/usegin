import { listRelatedFiles } from "../parser";
import { deleteSessionFiles } from "../rm";
import { resolveSessionPath } from "../finder";

function printRmHelp() {
  console.log(`
session rm - Delete a session and its subagent files

USAGE:
  session rm <session-id|prefix|path> [--yes]

Resolves the session, finds all related files (main session + subagents),
shows what will be deleted, and asks for confirmation.

OPTIONS:
  --yes, -y   Skip confirmation prompt

EXAMPLES:
  session rm 502de9c7                    # Delete by short prefix
  session rm 502de9c7 --yes              # Skip confirmation
  session delete 502de9c7                # "delete" is an alias for "rm"
`);
}

export async function runRm(args: string[]) {
  const yesFlag = args.includes("--yes") || args.includes("-y");
  const helpFlag = args.includes("--help") || args.includes("-h");

  if (helpFlag) {
    printRmHelp();
    return;
  }

  const fileOrId = args.find((a) => !a.startsWith("-"));

  if (!fileOrId) {
    console.error("Error: session ID required\n");
    printRmHelp();
    process.exit(1);
  }

  try {
    const filePath = await resolveSessionPath(fileOrId);

    // Find related files (main + subagents)
    const relatedFiles = await listRelatedFiles(filePath);

    console.log(`Session: ${filePath}`);
    if (relatedFiles.length > 1) {
      console.log(`  + ${relatedFiles.length - 1} subagent file(s)`);
    }

    if (!yesFlag) {
      // Prompt for confirmation
      process.stdout.write("Delete? (y/N) ");
      const response = await new Promise<string>((resolve) => {
        process.stdin.once("data", (data) => resolve(data.toString().trim()));
      });
      if (response.toLowerCase() !== "y") {
        console.log("Cancelled.");
        return;
      }
    }

    // Delete all related files
    const result = await deleteSessionFiles(relatedFiles);

    if (result.failed > 0) {
      console.error(`Deleted ${result.deleted} file(s), ${result.failed} failed.`);
      process.exit(1);
    }

    console.log(`Deleted ${result.deleted} file(s).`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
