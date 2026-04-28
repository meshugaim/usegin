---
id: z109
title: A partial tikur fix is still an unfixed tikur — name the layers
type: zettel
authored-by: usegin
threads: [↑z097, ↑.claude/tikur-records/2026-04-28-multi-gin-checkout-collisions.md, ~tikur-skill-self-tripwire]
created: 2026-04-28
session: claude-opus-4-7-1m-autonomous-2026-04-28
---

## The click

The 2026-04-28 tikur on the multi-Gin checkout cluster specced two layers of
fix: a *loose* tripwire (pre-commit diff-name check) and a *strict* fix
(per-session worktrees). The skill's self-tripwire rule was satisfied: the
record's `System:` field said `system-fix-deferred` for the strict layer
and named the gap explicitly.

But the loose layer was supposed to land *that turn* — and it didn't.
The script `scripts/hooks/check-staging-drift.sh` was committed as part of
the tikur record's commit batch, but never *wired into* `.husky/pre-commit`.
The hook was a no-op until the night of 2026-04-28 (commit `2d85a2828`).

## The lesson

When a tikur prescribes multiple layers of fix, *each layer needs its own
SHA citation*. "Loose tripwire landed (`SHA-X`); strict fix
deferred (`charter-Y`)" is honest. "Tripwire landed (`SHA-X`)" is a half-truth
when the tripwire's wiring is what made it actually fire — the script alone
is just text on disk.

The pattern: an artifact and its *hook-up* are two different commits if
they are in different files. The tikur record should cite both, or it's
making a stronger claim than the system supports.

## The proposed sharper rule

The tikur skill's self-tripwire (rule introduced 2026-04-28) currently reads:
*every record's `System:` field carries a commit SHA, or `Status:
system-fix-deferred` with the named gap*.

Sharper: *every distinct system-fix layer carries its own SHA or its own
deferred-status note*. A single SHA covering "loose tripwire wired into
pre-commit + strict fix designed" is two claims; if only one is true, the
record over-claims.

This is a tightening of the existing rule, not a new rule. The 2026-04-28
record's `Status: system-fix-deferred` was honest about the *strict* layer
but implied the *loose* layer was complete — when in fact wiring it up was
its own un-done step.

## What ships from this zettel

Same turn (z002):

- **Tikur skill edit (TBD next session)**: tighten the self-tripwire rule
  per the sharpening above. This zettel is the input.
- **CLOSE.md § D5 update (this turn, commit pending)**: now reflects that
  the loose layer landed at commit `2d85a2828` and the strict layer is
  charter-ready at `D5.1-charter-session-wt.md`.
- **Cross-link in the 2026-04-28 tikur record**: append a follow-up note
  citing this zettel. Per the tikur skill rule (records are append-only),
  this is a follow-up *zettel*, not an edit to the record itself.

## Threading

↑z097 (the cluster's structural-fix zettel) ·
↑`.claude/tikur-records/2026-04-28-multi-gin-checkout-collisions.md` ·
~tikur skill (self-tripwire rule sharpening) ·
~CLOSE.md § D5 ·
~`feedback_first_place_we_looked` (the missing wire-up was in
`.husky/pre-commit` — the obvious first place to look).
