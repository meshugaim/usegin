import { Command } from "commander";

/**
 * `dx zettel it` — the !zettleit trigger.
 *
 * v0 (this): print a trigger banner the *active* Claude session interprets.
 * The banner names the procedure (zettleread → add → verify) and points at
 * the zettel-capture skill so the discipline lives in one place.
 *
 * v1 (planned): gate step 2 on human approval — Claude proposes title +
 * placement + threads, waits for confirmation, then writes.
 *
 * Shell shortcut: `tools/bin/zettleit` → `dx zettel it`.
 *
 * Output convention (matches dx-wide rule): banner → stderr; structured
 * record → stdout when `--json`.
 */

export interface ItOptions {
  json?: boolean;
}

export interface ItRecord {
  thought: string;
  ts: string;
  cwd: string;
  session_id: string | null;
  pid: number;
}

export async function readStdinUtf8(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8");
}

export function buildRecord(thought: string): ItRecord {
  return {
    thought: thought.trim(),
    ts: new Date().toISOString(),
    cwd: process.cwd(),
    session_id: process.env.CLAUDE_SESSION_ID ?? null,
    pid: process.pid,
  };
}

export function banner(rec: ItRecord): string {
  return [
    "",
    "[ZETTLEIT] capture request — active Claude session, this is for you.",
    "",
    `Thought: ${rec.thought}`,
    "",
    "Procedure (v0 — autonomous wiring):",
    "  1. zettleread — `dx zettel list` + `rg` over usegin/zettel/zettels/",
    "     to find the placement parent and thread cross-refs.",
    "  2. `dx zettel add --as=usegin --title '<atomic claim>'` with",
    "     --placement and --thread flags wired from step 1.",
    "     (Body on stdin via heredoc; two-faced when suitable, z022.)",
    "  3. `dx zettel show <new-id>` to verify round-trip.",
    "",
    "Skill: .claude/skills/zettel-capture/SKILL.md",
    "Spec: v1 will gate step 2 on approval; v0 captures autonomously.",
    "",
  ].join("\n");
}

export function buildZettelItCommand(): Command {
  return new Command("it")
    .description(
      "Trigger a zettel capture — active Claude session does zettleread + add. " +
        "Shell shortcut: `zettleit \"<thought>\"`.",
    )
    .argument("[thought...]", "the raw thought (positional words; or stdin)")
    .option("--json", "emit the trigger record as JSON to stdout")
    .action(async (parts: string[] | undefined, opts: ItOptions) => {
      let thought = (parts ?? []).join(" ").trim();
      if (!thought) thought = (await readStdinUtf8()).trim();
      if (!thought) {
        process.stderr.write(
          "dx zettel it: thought is required (positional or stdin). " +
            'Try: `dx zettel it "..."` or `echo "..." | dx zettel it`.\n',
        );
        process.exit(1);
      }
      const rec = buildRecord(thought);
      process.stderr.write(banner(rec));
      if (opts.json) process.stdout.write(JSON.stringify(rec) + "\n");
    });
}
