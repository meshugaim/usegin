---
name: gap-check
description: Assess gaps between expectations and current app state for a given target (Linear issue, feature area, spec). Always takes a target. Triggered by "/gap-check", "gap-check on X", "what's missing on X", "how close is X to spec", "expectation gap on X", or by your own judgment when about to claim something is "done" and want to pressure-test that claim.
---

# Gap-check

Pressure-test "is X actually where we said it should be?" against the real codebase, docs, and team memory. Always run with a target — a Linear issue, a feature area, a spec doc, a sub-app. Open-ended "what gaps exist" without a target is out of scope; ask for one.

## How it runs

Layered, cheapest-first. Always do L1+L2. After each layer, decide: **fail-fast or go deeper**.

- **Fail-fast:** if L1 or L2 surfaces an obvious big gap (missing AC, dead code path, contradiction with the spec on its face), stop and report. No point in pulling Drive docs to confirm what's already obvious from `git grep`.
- **Go deeper:** if L1+L2 look clean — or only nits — *propose* L3+ to the user with one line each on what they'd add. Don't run them silently; the deeper layers cost real time and Effi/session quota.

### The layers

1. **Linear issues vs code** — open ACs on in-flight/recent issues for the target, compared against HEAD. `plan show <id>` + read the actual files referenced.
2. **Repo docs/specs** — `docs/`, `docs/decisions/`, slice plans, any `*.md` alongside the target's code. ACs and constraints often live here, not in Linear.
3. **dogfooding-effi** — `effi ask` for things agreed in meetings, emails, or Drive that may never have made it to Linear. Use the `dogfooding-effi` skill.
4. **Git history** — `git log` + `session code-history` on the target's files. What was attempted, reverted, half-landed. HEAD lies about intent.
5. **Previous Claude sessions** — `session` CLI / grep `~/.claude/projects/` for the target keyword. Nuance and asks captured mid-session that never made it to a ticket.
6. **Cross-source contradictions** — explicitly compare what L1–L5 said. Specs vs meetings vs emails vs Linear. Flag conflicts; don't silently pick a winner.
7. **Run the app & see the ACs** — `app-sanity-test` style: execute the code, observe the AC actually doing the thing. The static-artifact pass can miss "the button exists but does nothing".

## Output

Two-part:

1. **Gap table** — one row per gap. Columns: `gap`, `source` (which layer surfaced it), `severity` (blocker / nit / contradiction).
2. **What was checked** — one line per layer actually run, plus the proposed deeper layers that weren't run yet ("L3 dogfooding-effi — would add forgotten asks from team meetings; ~30s, want me to?").

End with one short offer to drill into a specific row.

## Don't

- Don't skip L1+L2 because "I already know this code". The point is the pressure-test.
- Don't run L3–L7 by default. Always propose; only run on confirmation or when L1+L2 is clean enough that going deeper is the actual ask.
- Don't curate gaps by "obvious relevance" — list them, let the user prioritize. (Cascade-scope-exploration discipline applies.)
- Don't declare "no gaps" without naming which layers you ran. "Clean per L1+L2; deeper layers not yet run" is the honest shape.

## Last-resort places gaps hide

When the seven layers come back clean but something still smells off, reach into this bag. None are default; pick by target shape.

- **Tests** — what the tests actually assert vs the spec's ACs.
- **Sentry / prod errors** — the AC is "implemented" but throwing in prod (use the `sentry` skill).
- **Telemetry / logs** — the code path exists but is never reached in prod.
- **DB schema / migrations** — local has the column, staging/prod doesn't.
- **Feature flags / toggles** — code is there, gate is off, users see nothing.
- **Env / config drift** — env var set on dev Railway, missing on staging/prod.
- **RLS / permissions** — works for service-role, blocks the real user role.
- **CI status** — claim of "done" while `main` is red.
- **Open-to-empty zettels** — `usegin/zettel/` addresses we said we'd fill and didn't.
- **In-flight sub-agents / worktrees** — adjacent unmerged work the static pass would miss.
- **Cron / scheduled jobs** — feature depends on a recurring task; verify it actually fires.
- **Generated types / API contracts** — TS types vs route shape vs DB row drift.
- **Vendor / OAuth status** — Slack app installed? Unified.to redirect URI live? Drive scopes granted? (Slack channels themselves come in via L3 dogfooding-effi.)
- **Effi session audits** — real user sessions where the feature went sideways (use the `effi-session-audit` skill).
