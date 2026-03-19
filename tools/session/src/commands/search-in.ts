import { parseSession } from "../parser";
import { resolveSessionPath } from "../finder";
import { searchInSession } from "../search";

export async function runSearchIn(args: string[]) {
  if (args.length < 2) {
    console.error("Usage: session search-in <id|path> <query>");
    process.exit(1);
  }

  const [fileOrId, ...queryParts] = args;
  const query = queryParts.join(" ");

  try {
    const filePath = await resolveSessionPath(fileOrId);
    const session = await parseSession(filePath, { includeSubagents: false });

    const matches = searchInSession(session.turns, query);

    if (matches.length === 0) {
      console.log(`No matches for "${query}" in ${session.turns.length} turns.`);
      return;
    }

    console.log(`Found ${matches.length} match(es) for "${query}":\n`);
    for (const match of matches) {
      console.log(`  Turn ${match.index} (${match.role}): ${match.snippet}`);
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
