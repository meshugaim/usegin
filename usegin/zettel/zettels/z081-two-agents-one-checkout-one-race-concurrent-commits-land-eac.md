---
id: z081
title: Two agents, one checkout, one race — concurrent commits land each other's work under wrong messages
type: zettel
authored-by: usegin
threads: [↑z028, ~z040]
created: 2026-04-27
session: a2f5af80-303b-4c26-957b-ddb5bfeb61e3
---

## Human side

Lihu, 2026-04-27, paraphrased: *"This shouldn't happen. Tikur it. The fix is straightforward — revert and recommit. Whether it's yours or other agents'. You can always talk to other agents. We solve such cases by zettel-ing it."*

## UseGin side

`/workspaces/test-mvp/` has one `.git/index`. Multiple Claude sessions (UseGin main, sub-agents, autosync hooks, parallel humans+agents) all run `git add` and `git commit` against that one index. `git` locks individual operations but **not** the `stage → commit` interval. Between agent X's `git diff --cached` (4 files) and agent X's `git commit` (read index → form commit), agent Y's `git add` can land — Y's files now sit in X's commit, under X's message.

This happened on 2026-04-27 with commit `4f6988745`. The reflog has the smoking gun: two `commit:` entries with the same message ("feat(dx-app): his — close the punch list") and a `reset: moving to HEAD` between them — concurrent autosync rebases racing.

The same root cause produces both directions of `reference_autosync_concurrent_collisions` Mode 1 (your work lands under a stranger's message) — UseGin's z037+z040 went into agent A's `9853ed033` commit; agent A's 36 files went into UseGin's `4f6988745`. The asymmetry was just timing.

**The lever is per-agent isolation.** Two complementary moves:

1. **Tripwire (loose, immediate):** a pre-commit hook that records `git diff --cached --name-only` at commit-message-construction-time and re-checks at commit-execution-time. If the two lists disagree, abort and tell the operator to re-stage. Detects the race without preventing it. Lands this turn.
2. **Worktree-per-session (strict, follow-on):** each Claude session allocates `.worktrees/<session-id>/` on startup and operates there; push `HEAD:main` from the worktree (memory: `feedback_main_wt_stay_on_main`). Eliminates the shared-index race entirely. Bigger devcontainer change; tracked separately.

Forward-only fix for the bad commit was: `git revert 4f6988745` (clean undo, no history rewrite per CLAUDE.md "no force-push"); restore UseGin's 4 legitimate files via `git checkout 4f6988745 -- <paths>`; commit those alone with the accurate message. Other agents' files return to unstaged/untracked, where their owning sessions recommit them under their own messages.

Cross-agent coordination is possible (`SendMessage` to running spawned agents), but the actual mechanism that prevents recurrence is structural — not communicative. Two agents being polite to each other does not make the index transactional.

The full tikur record (timeline, five whys, three fixes) lives at `.claude/tikur-records/2026-04-27-commit-scope-collision.md`. The skill that authored it: `.claude/skills/tikur/SKILL.md`.
