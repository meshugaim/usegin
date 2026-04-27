import { resolveSessionPath } from "../finder";
import { parseForkArgs } from "../cli-args";
import { fetchSession, formatFetchResult } from "../fetch";

function printForkHelp() {
  console.log(`
session fork - Fork a session (copy + resume the copy)

USAGE:
  session fork <session-id|prefix>

Creates a copy of the session JSONL with a new UUID. The original session
is untouched — like branching in git. Then resumes the copy interactively.

Subagent files (agent-*.jsonl) and nested subagent directories are also
copied to keep the forked session self-contained.

OPTIONS:
  --dry-run   Show what would be copied without doing it

EXAMPLES:
  session fork 3263a294                              # Fork by short prefix
  session fork 3263a294-abcd-4567-8901-234567890abc  # Fork by full UUID
  session fork 3263a294 --dry-run                    # Preview without copying
`);
}

export async function runFork(args: string[]) {
  const forkArgs = parseForkArgs(args);

  if (forkArgs.help) {
    printForkHelp();
    return;
  }

  if (!forkArgs.sessionId) {
    console.error("Error: session ID required\n");
    printForkHelp();
    process.exit(1);
  }

  try {
    // Step 1: Fetch if remote (no-op if already local)
    const fetchResult = await fetchSession(forkArgs.sessionId);
    if (!fetchResult.alreadyLocal) {
      console.log(formatFetchResult(fetchResult));
    }

    // Step 2: Resolve to file path
    const sourcePath = await resolveSessionPath(forkArgs.sessionId);
    const sourceDir = (await import("node:path")).dirname(sourcePath);
    const sourceId = (await import("node:path")).basename(sourcePath, ".jsonl");

    // Step 3: Generate new UUID
    const newId = crypto.randomUUID();
    const newPath = (await import("node:path")).join(sourceDir, `${newId}.jsonl`);

    // Step 4: Copy main session file, rewriting sessionId
    const sourceContent = await Bun.file(sourcePath).text();
    const rewrittenContent = sourceContent.replaceAll(sourceId, newId);

    if (forkArgs.dryRun) {
      console.log(`Would fork session:`);
      console.log(`  Source: ${sourceId}`);
      console.log(`  Target: ${newId}`);
      console.log(`  File:   ${newPath}`);

      // Check for subagent files
      const { readdir } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const dirFiles = await readdir(sourceDir);
      const subagentFiles = dirFiles.filter(
        (f) => f.startsWith("agent-") && f.endsWith(".jsonl")
      );

      // Filter to subagents belonging to this session
      for (const subFile of subagentFiles) {
        const subContent = await Bun.file(join(sourceDir, subFile)).text();
        const firstLine = subContent.slice(0, subContent.indexOf("\n") || subContent.length);
        if (firstLine.includes(sourceId)) {
          console.log(`  Copy:   ${subFile}`);
        }
      }

      // Check nested subagents directory
      const nestedDir = join(sourceDir, sourceId, "subagents");
      try {
        const nestedFiles = await readdir(nestedDir);
        for (const f of nestedFiles) {
          if (f.startsWith("agent-") && f.endsWith(".jsonl")) {
            console.log(`  Copy:   ${sourceId}/subagents/${f} → ${newId}/subagents/${f}`);
          }
        }
      } catch {
        // No nested directory
      }

      return;
    }

    // Write the forked session file
    await Bun.write(newPath, rewrittenContent);

    // Step 5: Copy subagent files that belong to this session
    const { readdir, mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dirFiles = await readdir(sourceDir);
    const subagentFiles = dirFiles.filter(
      (f) => f.startsWith("agent-") && f.endsWith(".jsonl")
    );

    let subagentsCopied = 0;
    for (const subFile of subagentFiles) {
      const subPath = join(sourceDir, subFile);
      const subContent = await Bun.file(subPath).text();
      const firstLine = subContent.slice(0, subContent.indexOf("\n") || subContent.length);
      if (firstLine.includes(sourceId)) {
        const rewrittenSub = subContent.replaceAll(sourceId, newId);
        await Bun.write(subPath.replace(sourceId, newId), rewrittenSub);
        subagentsCopied++;
      }
    }

    // Copy nested subagents directory if it exists
    const nestedDir = join(sourceDir, sourceId, "subagents");
    try {
      const nestedFiles = await readdir(nestedDir);
      const targetNestedDir = join(sourceDir, newId, "subagents");
      await mkdir(targetNestedDir, { recursive: true });

      for (const f of nestedFiles) {
        if (f.startsWith("agent-") && f.endsWith(".jsonl")) {
          const content = await Bun.file(join(nestedDir, f)).text();
          const rewritten = content.replaceAll(sourceId, newId);
          await Bun.write(join(targetNestedDir, f), rewritten);
          subagentsCopied++;
        }
      }
    } catch {
      // No nested directory — that's fine
    }

    const shortNew = newId.slice(0, 8);
    const shortSrc = sourceId.slice(0, 8);
    console.log(`Forked ${shortSrc} → ${shortNew}`);
    if (subagentsCopied > 0) {
      console.log(`  Copied ${subagentsCopied} subagent file(s)`);
    }

    // Step 6: Resume the forked session
    const resumeProcess = Bun.spawn(
      ["just", "c", "--resume", newId],
      {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }
    );
    await resumeProcess.exited;
    process.exit(resumeProcess.exitCode ?? 0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
