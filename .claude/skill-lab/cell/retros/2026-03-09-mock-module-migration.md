### 2026-03-09 — ENG-2606 mock.module → spyOn migration
**Verdict:** collapsed
**Collapse events:** 1 (skill never invoked — hand-rolled parallel agents instead)

**Key observations:**

- **Cell skill was never invoked.** Spawner pitched "cell pattern" to the user, then used raw `Agent` tool with `isolation: "worktree"` and hand-written prompts. No `crun`, no `worktree` CLI, workers never told to read `worker.md`. The skill was cargo-culted — the concept was referenced but the actual process was bypassed entirely.

- **Isolation failed completely.** All 4 workers operated in the main working tree (`/workspaces/test-mvp/`) instead of their worktree directories. The `Agent` tool's `isolation: "worktree"` created git worktrees but workers ignored them. Evidence: `git log main` showed worker commits, worktree branches had zero new commits.

- **Cross-worker contamination.** Commit `e856387d` (notifications worker) included ~2000 lines of integration test infrastructure from another agent's staged changes. The worker ran `git add` broadly and swept in pre-existing staged files. Required interactive rebase to fix.

- **Workers overwrote each other.** 6 files were committed by multiple workers. For 3 project-files test files, the second worker's commit reverted the first worker's migration because both started from the same base state.

- **Worker moved HEAD backwards.** One worker ran `git checkout 943df1ab`, rewinding main and losing all 23 migration commits. Required reflog recovery (`git reset --hard 83d8727c`).

- **3/4 workers hit context limits.** Batches of 15-30 files per worker were too large. Workers exited with "Prompt is too long" before completing. The lib worker left 6 files with half-done edits (removed old declarations, didn't add replacements), causing 67 test failures.

- **No pre-flight verification.** Spawner launched all 4 workers simultaneously without verifying that the first worker actually committed to its worktree branch. A single check after the first worker's first commit would have caught the isolation failure immediately.

- **No alignment verification.** Spawner did not rephrase the task back to the user before spawning. Went straight from audit → create issues → spawn workers.

- **Spawner did cleanup directly.** After workers finished, spawner edited 4 test files to fix duplicate declarations left by worker overlap. This is acceptable post-worker cleanup but indicates the workers' scope wasn't clean.

- **Unwanted extras.** Components worker added 2 documentation commits nobody asked for. Notifications worker created 2 `.skip` files (new test files it couldn't get working).

**What was salvaged:**
- ~94 mock.module calls migrated across ~25 files
- All 1993 tests pass after spawner cleanup
- Notifications module fully migrated (0 remaining)
- 57 application-code mock.module calls remain (out of original ~151)

**Suggestions:**

1. **Use the actual skill.** `crun` + `worktree` CLI is the tested path. The `Agent` tool's `isolation: "worktree"` is not equivalent and its isolation guarantees are unverified.

2. **Add pre-flight check to spawner.md.** "For parallel work: spawn ONE worker first. Verify it commits to its worktree branch (`git -C <worktree> log --oneline -1`). Only then spawn the rest."

3. **Add batch sizing guidance.** "For mechanical migrations, cap at 8-10 files per worker. For feature work, 1 slice = 1 worker." The 30-file batches in this session were 3x too large.

4. **Add commit scope guardrail to worker.md.** "Always `git add <specific-files>`, never `git add .` or `git add -A`. Check `git status` before committing to ensure no unrelated files are staged."

5. **Sequence when files overlap.** The 6 files touched by multiple workers should have been assigned to a single worker, or the second worker should have run after the first finished. The skill's "don't parallelize when file conflicts are likely" rule was ignored.

6. **The skill needs to be more discoverable.** The spawner knew about cell conceptually but reached for lower-level tools. This suggests the skill's triggering or the spawner's habit of using `Agent` directly needs addressing.
