# Ideator 03 — Observability-first ops

Bias: an invisible failure is worse than a noisy one. Make the bad thing
impossible to ignore; the fix follows the metric.

## Ideas

- `dx storm-status` — live one-liner of N agents touching tree, autosync
  in-flight, stash count, push-fail rate over last 30 min. Cheap to glance.

- Status-line widget piped from `dx storm-status` so every agent sees the
  storm severity *before* deciding to commit.

- `dx commit-eats` counter — every time autosync runs `reset HEAD~1` (or any
  destructive op), bump a SQLite counter with `{sha, message, files,
  reason}`. Daily digest mails the human.

- Refuse-to-be-silent autosync: when autosync is about to drop a commit,
  emit a loud `systemMessage` + `dx his rate friction_lost_work=95` row +
  zettel-stub before doing anything destructive.

- `dx commit-eats show` — list the last N silently-eaten commits with their
  reflog SHA, files, and a one-shot recovery command (`dx commit-eats
  recover <id>`).

- Push-fail trace IDs: every push attempt gets a UUID logged with
  `{agent, sha_attempted, base_at_attempt, files, reject_reason,
  what_we_did_next}`. `dx push-trace tail` to follow live.

- "Mode-1 collision detector" — pre-commit hook compares `git diff --staged
  --name-only` to the files the agent's *own* edits actually touched
  (tracked from session JSONL). Surface the delta in the commit message
  footer: `--- captured 7 stranger files: a.tsx, b.ts, ...`.

- Stash dashboard: `dx stash` prints stash count, age histogram, owner
  attribution (which agent created each), and flags stashes >24h old as
  abandonment risk.

- Per-agent attribution prefix in commit message: `[agent=gin-A1]` injected
  by autosync. Then `git log --grep '[agent=gin-A1]'` is queryable history.

- `dx working-tree owners` — for every dirty file in working tree, show
  which agent last touched it (from session JSONL) and how long ago. Now
  "whose half-broken file is blocking my push" is a single command.

- Pre-push hook prints a "blast radius" report before running checks:
  "Your commit touches 3 files. Working tree dirties 47 unrelated files
  owned by agents B, C. Lints will run against ALL 50."

- Red-amber-green storm gauge in status line: green=lone agent, amber=2-3
  agents+clean tree, red=N agents OR stash>10 OR recent commit-eat.
  Behavior changes follow color, not invisibly.

- Autosync emits structured events to `~/.dx/autosync.jsonl` —
  `{event: pre-pull|post-pull|pre-push|push-fail|reset-head, ts, sha,
  files}`. Replayable timeline.

- `dx autosync replay --last 1h` — render the timeline as a Gantt-ish
  ASCII chart. Spot the moment your commit was eaten visually.

- Sentry-for-gin: wire autosync errors to a local Sentry-style feed
  (`dx incidents`) with grouping. "Mode-1 collision" becomes an issue type
  with occurrence count.

- Pre-push prints, for every file the lint will examine, whether it's IN
  your commit range or just contaminating the working tree. The "fix"
  emerges: oh, 90% of failures are working-tree contamination, *now* go
  fix it at the gate.

- Heartbeat file per agent (`/tmp/gin-agents/<id>.heartbeat`) updated each
  Bash. `dx storm-status` reads them to enumerate "live" agents — no
  guessing how many storms are happening.

- Push-rejected → automatic `dx his rate --as=claude
  friction_lost_work=80` with the reject reason as note. Already partial
  in `dx-his-auto-from-bash.ts`; expand to capture the *content* the push
  was carrying.

- "Last words" log: before any destructive autosync op, dump
  `git diff HEAD~1 HEAD` to `~/.dx/last-words/<sha>.diff`. Even if reset
  succeeds, the content is recoverable from a friendly path, not just
  reflog.

- `dx push-readiness` — pre-flight that returns a number (0-100) factoring
  working-tree owner mix, stash count, recent push-fail rate, time since
  last successful push. Read the number, decide.

- Periodic team digest (cron, mailed to Lihu): top 5 commit-eats this week,
  collision modes by frequency, agent push success rates, stash growth
  curve. Patterns pop out.

- Histogram: time-from-commit-to-successful-push, bucketed. Long tail =
  "your work sat unpushed for 40 min" → fixable if visible.

- `dx zettel link --auto-from-friction` — when commit-eats counter bumps,
  open-to-empty a zettel stub with the SHA, reflog ref, files, and a
  TODO note. Friction surfaces as zettels not ghosts.

- Commit-message annotations: autosync appends a footer
  `Autosync-files: <N>`, `Autosync-stranger-files: <list>`, so `git log`
  itself becomes the audit trail. No new tool needed to query it.

- Pre-commit refuses (with override flag) when staged files include any
  file the current agent never edited in this session. "You're about to
  commit work you didn't do" surfaces Mode-1 *before* it lands.

- `dx tree-tail` — like `tail -f` for the working tree. Shows files
  becoming dirty/clean in real time, with agent attribution. Watching the
  storm rather than guessing.

- Reflog dashboard: `dx reflog` filtered to "lost commits" — orphaned
  SHAs that were never pushed. One-command recovery per row.

- Agent identity in PROMPT_COMMAND / shell prompt: every Bash output
  shows `[gin-A1@main:abc123]`. Logs become greppable by agent without
  ceremony.

- Telemetry-first migration: don't change autosync behavior at all in
  v1; just add the observability layer. Run for a week, read the
  patterns, *then* design the fix from data not vibes.

- `dx his` aspect: `friction_silent_loss` — distinct from
  `friction_lost_work`. The first time a human notices "where did my
  commit go" is signal we want trended.

- Pre-push gate produces a structured report: `{passed, failed,
  failed_in_my_commit, failed_in_dirty_tree}`. The 4-tuple, not pass/fail.
  Now the human sees "all my failures are not mine" at a glance.

- "Push budget" telemetry: rolling 1h window of push attempts vs
  successes. <50% triggers an automatic `dx his rate
  friction_claude_devenv=85` so the storm registers in vibe history.

- Annotate every autosync action with a *reason string* it logs:
  "swept 4 files for commit X because: untracked + matched include glob
  + age > 60s". Reasons accumulate; patterns of bad reasons surface.
