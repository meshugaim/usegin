### 2026-03-09 — ENG-2606 mock.module → spyOn migration (round 2)
**Verdict:** partially followed
**Collapse events:** 1 (used `Agent` tool instead of `crun` + `worktree` CLI)
**Key observations:**

- **Cell skill was invoked.** `/cell` was triggered, spawner read `spawner.md`, `core.md`, and `worker.md`. This is a direct improvement over round 1 where the skill was only conceptually referenced.

- **`crun` was attempted but failed.** Spawner correctly tried `crun --cwd $(worktree path ...)` with manually created worktrees — the documented path. All 5 failed with "Claude Code cannot be launched inside another Claude Code session" (CLAUDECODE env var check). Spawner adapted by switching to `Agent` tool with `isolation: "worktree"`. This was the right fallback given the constraint, but it bypassed the `crun`/`worktree` tooling the skill prescribes.

- **MCP state was checked and optimized.** Spawner ran `ccfg mcp list` and disabled all 5 MCPs before spawning, following the skill exactly. Re-enabled after workers finished.

- **Alignment was verified.** Spawner presented understanding, listed next steps, asked for confirmation before implementing. User confirmed and added the `/cell` directive.

- **Batch sizing was excellent.** 3-8 files per worker (5 batches of 26 files). Zero workers hit context limits. All 5 completed successfully. This directly addresses the round 1 failure of 15-30 file batches.

- **File isolation was perfect.** Zero file overlap between any two workers. Every migration commit touches exactly one file. No cross-worker contamination. No files swept in via `git add .`.

- **Commit hygiene was excellent.** 26 migration commits, each touching exactly one file. All commits follow the `refactor(test): migrate mock.module → spyOn in <filename>` pattern with `Part of: ENG-2606` in the body.

- **Two scope-creep commits from workers.** `396c10c2` (hooks README, 79 lines) and `ca85b1b3` (CI composite action refactor, 3 files). Neither was asked for. Both came from workers adding "improvements" beyond their assigned scope. Spawner noticed but left them since they were interleaved with migration commits.

- **Worktree isolation partially worked.** 4/5 workers committed directly to main (not their worktree branches). Only batch 1 committed to its worktree branch and required a manual merge. This is the same isolation problem from round 1 — the `Agent` tool's `isolation: "worktree"` doesn't guarantee workers stay on their worktree branch. However, because files didn't overlap, this caused no harm.

- **Spawner discipline was good.** Spawner did not write code or edit test files. The only direct edits were: deleting `.skip` debris files (cleanup), writing a shared prompt file (preparation), and the merge. All appropriate spawner actions.

- **Linear tracking was maintained.** Spawner closed ENG-2610, ENG-2611, ENG-2608, ENG-2609, and ENG-2606. Used `plan close` with comments.

- **`-n` (note-to-self) was used on `crun` calls** but not on `Agent` tool calls (which don't support it). Minor gap — spawner tracked workflow mentally.

- **Full test suite run after all workers.** Spawner ran `bun test` after merging — 1993 pass, 0 fail. Individual workers also ran tests per-file.

- **No review or retro triggered.** The skill requires both. This session completed the migration but didn't spawn a reviewer or a retro worker. (The user manually triggered this retro via `/skill-retro`.)

**Success Signal Scorecard:**

| Signal | Result | Notes |
|---|---|---|
| Skill invoked | PASS | `/cell` triggered, skill files read |
| `crun` used | FAIL | Attempted but blocked by nested-session check. Fell back to `Agent` tool |
| `worktree` CLI used | PARTIAL | Created worktrees manually, but they were for `crun` which failed. `Agent` tool created its own worktrees |
| Alignment verified | PASS | Presented understanding, got confirmation |
| MCP state checked | PASS | Disabled all 5 MCPs before spawning |
| Spawner didn't execute | PASS | Only cleanup/prep actions |
| Linear tracked | PASS | All sub-issues and parent closed |
| Note-to-self used | PARTIAL | Used on `crun` calls, not on `Agent` calls |
| Workers in worktrees | PARTIAL | `Agent` worktrees exist but 4/5 workers committed to main directly |
| No cross-contamination | PASS | Zero file overlap, zero swept files |
| No extras | FAIL | 2 scope-creep commits from workers |
| Commits scoped | PASS | Each migration commit = exactly 1 file |
| Batch sizing OK | PASS | 3-8 files per worker, zero context exhaustion |
| Tests run per-file | PASS | Workers verified after each file |
| Full suite at end | PASS | 1993/1993 pass |
| Review triggered | FAIL | Not done |
| Retro triggered | FAIL | User-initiated, not spawner-initiated |

**Suggestions:**

1. **`crun` nested-session blocker needs a fix.** The `CLAUDECODE` env var check prevents `crun` from working inside Claude Code sessions. This is the fundamental reason the skill's prescribed tooling couldn't be used. Options: (a) `crun` unsets `CLAUDECODE` before launching, (b) `crun` has a `--force` flag, (c) document that `Agent` tool is the fallback when inside Claude Code.

2. **Worker scope-creep prevention.** Add to worker prompts: "Do NOT create documentation, refactor CI, or make improvements beyond your assigned files." Two workers added unsolicited commits. The shared prompt file mentioned "Do NOT touch any files outside your N-file list" but workers still created new files.

3. **Review and retro should be spawner-initiated.** The spawner completed all work, closed Linear, but didn't trigger review or retro. These are required by the skill's quality process. Even for mechanical migrations, a quick review pass catches subtle issues.

4. **The `Agent` tool's `isolation: "worktree"` behavior needs documentation.** 4/5 workers committed to main instead of worktree branches. This worked fine here (no overlap) but is a latent risk. The lab should note: "Agent tool worktrees don't guarantee branch isolation — workers may commit to main."
