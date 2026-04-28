# z094 — autonomous collision: untracked files can vanish on `git reset --hard`

**Date:** 2026-04-27
**Author:** Gin-C3 (autonomous, ENG-5416)
**Threads:** z085 (ghost regressions / git fetch first), `reference_autosync_concurrent_collisions`

## Click

When two autonomous Gins are working in the same checkout and one of them runs
`git reset --hard HEAD~1` (e.g. to undo a commit it didn't mean to keep), it
also wipes the **other** Gin's freshly-Written-but-not-yet-committed files.
The casualty isn't just "uncommitted edits to tracked files" — it's any
**untracked new file** sitting in the working tree at reset time.

## What happened

C3 session wrote three new files:
- `nextjs-app/app/actions/project-slack.ts`
- `nextjs-app/app/projects/[projectId]/config/slack-channel-picker-modal.tsx`
- `nextjs-app/app/projects/[projectId]/config/slack-integration-card.tsx`

Plus modified two tracked files (integrations-tab + project-config-client) and
created one untracked mock file. Between the Writes and the next read, the git
reflog showed: `HEAD@{0}: reset: moving to HEAD~1`. The reset was made by
another agent (likely the autosync companion) undoing an unrelated commit
(`0e481167c skills: consult`).

After the reset:
- The two **modified tracked files** survived (working-tree edits weren't part
  of HEAD~1, so reset didn't touch them).
- The three **untracked new files** were **gone** — `git reset --hard` blasts
  the working tree to match HEAD, which means newly-Written files that weren't
  in HEAD just disappear.
- One untracked file (`tests/__mocks__/project-slack-actions.mock.ts`)
  survived. Probably because it was Written **after** the reset.

## The lesson

`commit-at-every-change` (existing memory) isn't just a quality habit — in an
autonomous-collision world it's the only way to make work durable. The window
between "I wrote the file" and "another Gin ran `git reset --hard`" is the
loss window, and it's measured in seconds when multiple Gins are alive.

## Concrete rule

After every `Write` of a NEW file in a multi-agent session:
1. `git add <file>` immediately.
2. Commit the staged set as soon as the file is internally coherent — even
   if the broader task isn't done. A WIP commit is better than a wiped file.

Editing tracked files is safer because reset only wipes them if the edit
overlaps with a reverted commit — but new files have no protection.

## Open ends

- Should autosync take a `git stash --include-untracked` snapshot before any
  `reset --hard`? That would make reset non-destructive across agents.
- Should the watcher refuse to reset when the untracked-file set is non-empty?
  Cheap, fail-loud alternative.

Both are infrastructure-level fixes — until they exist, the discipline is
"commit-on-Write, not commit-at-end-of-task" for new files in any session
where another agent might be running.
