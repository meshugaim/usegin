# cell — Skill Lab

## Intent

The cell skill orchestrates autonomous multi-agent work: one spawner thread delegates to worker agents who implement, review, and retro. It exists because complex tasks exceed a single context window, and because parallelizable work benefits from concurrent execution.

The critical distinction from liaison: cell workers commit and push themselves (liaison commits on behalf of workers). Cell workers are autonomous — they own their slice end-to-end. This makes isolation and scope discipline even more important, because there's no liaison reviewing diffs before they land.

Success means: workers complete their assigned scope without stepping on each other, commits are clean and scoped, the spawner orchestrates rather than executes, and the `crun`/`worktree` tooling is actually used (not hand-rolled alternatives).

## Success Signals

When retroing a session that used this skill, a good session looks like:

### Skill Invocation
- [ ] The cell skill was actually invoked (not just described as "cell-like")
- [ ] Spawner read `spawner.md` and workers were told to read `worker.md`
- [ ] `crun` was used to spawn workers (not raw `Agent` tool with hand-rolled prompts)
- [ ] `worktree` CLI was used for parallel isolation (not `Agent` `isolation: "worktree"`)

### Spawner Discipline
- [ ] Spawner verified alignment with user before spawning ("So: migrate X to Y. Correct?")
- [ ] Spawner checked MCP state before spawning (`ccfg mcp list`)
- [ ] Spawner did not write code, run tests, or edit files directly (until cleanup)
- [ ] Spawner used `plan start/close` to track progress in Linear
- [ ] Spawner used `-n` (note-to-self) for workflow continuity on each spawn

### Worker Isolation
- [ ] Workers operated in isolated worktrees (for parallel work)
- [ ] Workers committed only their own files — no cross-worker contamination
- [ ] Workers did not touch the main working tree when using worktrees
- [ ] Spawner verified isolation worked before launching all workers (smoke test)

### Scope Discipline
- [ ] Each worker had a clearly bounded scope (specific files/modules)
- [ ] Workers did not modify files outside their assigned scope
- [ ] Workers did not add unrequested extras (docs, refactors, new files)
- [ ] For overlapping files (same file, different mocks), scope was pre-resolved or work was sequenced

### Commit Hygiene
- [ ] Workers committed after each edit (small, frequent commits)
- [ ] Commits mentioned the Linear issue (`Part of: ENG-XXX`)
- [ ] Workers did not `git add .` or `git add -A` — only specific files
- [ ] No pre-existing staged/unstaged changes were swept into commits
- [ ] Workers did not run destructive git operations (checkout, reset) on shared branches

### Context Management
- [ ] Worker scope was small enough to complete within context limits (~8-10 files max)
- [ ] Workers that hit context limits committed partial progress before exiting
- [ ] Spawner spawned fresh workers for remaining work (not resumed exhausted ones)

### Quality
- [ ] Workers ran tests after each file migration
- [ ] Workers ran the full test suite at completion
- [ ] Spawner ran the full test suite after all workers finished
- [ ] Review was triggered after implementation (code-review skill)
- [ ] Retro was triggered after feature completion (cell-retro skill)

## Known Limitations

- **`crun` vs `Agent` tool.** The skill assumes `crun` for spawning, but agents in Claude Code often reach for the `Agent` tool directly. The `Agent` tool's `isolation: "worktree"` flag doesn't use the `worktree` CLI and may not provide the same isolation guarantees.
- **Worktree isolation is not verified.** Nothing in the skill tells the spawner to confirm that a worker is actually operating in its worktree (not the main working tree). A single `git status` check in the worktree after first edit would catch this.
- **Shared-file overlap is unaddressed.** When two workers need to modify the same file (e.g., different mocks in the same test file), the skill says "don't parallelize when file conflicts are likely" but doesn't offer a resolution pattern. In practice, spawners parallelize anyway and hope for the best.
- **Worker commit scope is trust-based.** Workers are told to commit their work, but nothing prevents `git add .` from sweeping in unrelated changes. The skill could recommend `git add <specific-files>` but doesn't enforce it.
- **Context exhaustion is common.** Large batches (30+ files) reliably exhaust worker context. The skill says "spawn fresh when context exhausted" but doesn't guide spawners on batch sizing to prevent it.

## Retro Guide

When the `skill-retro` skill triggers a retro for cell, follow this evaluation process:

**1. Was cell actually used?**
Check whether the cell skill was invoked or just referenced. Look for: `/cell` invocation, `crun` usage, `worktree` CLI usage, workers told to "use the cell skill as worker." If the spawner hand-rolled parallel agents without the skill, that's the first and most important finding — the skill was bypassed entirely.

**2. Check spawner discipline**
Did the spawner orchestrate or execute? Look for Edit/Write/Grep tool usage by the spawner thread (not sub-agents). The spawner should only use: Bash (for git, plan, crun, worktree), Read (for reviewing results), and text output. Exception: cleanup/fixup after workers finish is acceptable if scoped.

**3. Check isolation**
For parallel workers: were worktrees used? Did workers actually operate in their worktrees? Check for signs of main-working-tree contamination: workers committing to main instead of worktree branches, workers checking out commits on main, pre-existing dirty files swept into commits. The smoking gun is `git log main` showing worker commits that should be on worktree branches.

**4. Check commit scope**
Review each worker's commits. Do they contain only files within that worker's assigned scope? Look for: integration test files in unit test commits, files from other workers' domains, package-lock changes, documentation additions. Run `git diff-tree --name-only` on each commit and flag anything outside scope.

**5. Check batch sizing**
How many files were assigned per worker? Did workers hit context limits ("Prompt is too long")? Rule of thumb: >15 files per worker is risky, >25 is almost certain to exhaust context. Check if partial work was committed before context death.

**6. Check overlap handling**
Were there files touched by multiple workers? If so: was this anticipated and sequenced, or did it cause overwrites? Check for duplicate commits on the same file (`git log --all -- <file>` showing commits from different workers). Check if the later commit preserved the earlier worker's changes.

**7. Check quality gates**
Did the spawner run the full test suite after all workers finished? Was a review triggered? Was a retro triggered? Were Linear issues closed?

## Ideas / Notes

- The ENG-2606 session (2026-03-09) is the founding failure case. Spawner said "cell pattern" but used raw `Agent` tool with `isolation: "worktree"`. Workers committed to main instead of worktree branches, contaminated commits with integration test changes, overwrote each other's work, moved HEAD backwards, and 3/4 hit context limits. Every success signal above was derived from a specific failure in this session.
- The `Agent` tool's `isolation: "worktree"` is NOT the same as the `worktree` CLI. The Agent tool creates git worktrees but doesn't guarantee workers use them correctly. The `worktree` CLI + `crun --cwd` is the tested path.
- Sequential-by-default (from liaison's ENG-1624 lesson) applies even more strongly to cell, because cell workers commit autonomously. Parallel workers on the same branch is a recipe for the exact chaos seen in ENG-2606.
- Batch sizing guidance is missing from the skill itself. Consider adding: "For mechanical migrations, cap at 8-10 files per worker. For feature work, 1 slice = 1 worker."
- A pre-flight check ("verify one worker commits correctly before launching the rest") would have caught the isolation failure in ENG-2606 immediately. Consider adding to spawner.md.
- **`crun` cannot run inside Claude Code sessions.** The `CLAUDECODE` env var check blocks nested launches. Round 2 (same day) hit this when trying `crun --cwd $(worktree path ...)` — all 5 workers failed. Fallback was `Agent` tool with `isolation: "worktree"`, which worked but bypasses the skill's prescribed tooling. `crun` needs a fix (unset CLAUDECODE, or `--force` flag) for the skill to work as designed.
- **`Agent` tool worktrees don't guarantee branch isolation.** In round 2, 4/5 workers committed directly to main despite being in Agent-managed worktrees. Only 1 worker committed to its worktree branch. This was harmless (zero file overlap) but is a latent risk. The skill should document this behavior.
- **Batch sizing of 3-8 files per worker works well.** Round 2 used this range and all 5 workers completed without context exhaustion (vs. round 1's 15-30 files where 3/4 hit limits).
- **Scope-creep in worker prompts needs explicit prohibition.** "Do NOT touch any files outside your N-file list" wasn't enough — 2 workers still created unsolicited docs/CI commits. Consider: "Do NOT create new files. Do NOT modify files outside your list. Do NOT add documentation, refactor CI, or improve anything beyond your assignment."

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-03-09 | Lab created | ENG-2606 session: parallel workers without cell skill caused contamination, overwrites, and data loss |
| 2026-03-09 | Round 2 retro added | Same task, skill invoked properly this time. `crun` blocked by nested-session check, fell back to Agent tool. Much better outcomes (0 overlap, 0 contamination, all workers completed) |
