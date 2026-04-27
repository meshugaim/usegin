# Researcher (Missing) — Whiteboard

**ENG-5386.** Negative-space hunt: sessions where a shared 2nd brain
*would have helped* but didn't exist. Counterpart to ENG-5385.

## Sources searched

- `~/.claude/projects/-workspaces-test-mvp/*.jsonl` (~249 sessions, ~6 weeks)
- `~/.claude/projects/-workspaces-test-mvp/memory/*.md` (~57 entries — read
  as "what had to be saved because there was no other home")
- `~/agent-records/{lihub,oria-masas,nitsan-avni}/2026-{03,04}/...jsonl.gz`
  (sampled, ~6.9k archive files; cross-team friction is the same shape)

Method: ripgrep + zgrep into JSONLs (per the team's own
`feedback_grep_jsonl_directly` memory entry), then read full session
context around each hit. The current session
(`5d7f3c80-227d-4d0e-87ac-1574f3501c93`, 2026-04-27) is excluded — it IS
the work.

---

## TOP — distilled reading: the patterns of pain

A 2nd brain would dissolve, in roughly descending frequency / cost:

### 1. The "ghost decision" problem (highest cost)

Decisions that *were* made — sometimes *by Claude itself in a prior
session* — vanish into JSONLs nobody can find. The next session re-derives,
re-questions, or worse, *contradicts* the prior decision because it has no
way to know it exists.

**Worst observed instance:** ENG-5186 was authored by Claude on **2026-04-20**
declaring 7 steps. On **2026-04-23** another Claude session
(`84dc0d4d-...`) discovered "**ENG-5186 was authored, but didn't know the
OAuth-client registration step had already been completed. It's working
from stale premises. So we're already partway through ENG-5186 and nobody
marked it. ~Step 3 of the 7 in ENG-5186 is done.**" Three days, two
sessions, partial-state invisible to both. The fix wasn't a clever prompt;
the fix was a missing zettel: *"OAuth client for askeffi-staging registered
2026-03-31 → step 3 of ENG-5186."*

### 2. Decisions that get re-litigated *into the memory file itself*

The smoking gun is in the team's own memory entries. Two consecutive entries:

- `feedback_always_re_review.md` (11 days old): *"Always re-review after
  fixing review findings... Even if nitpick remain, we need to fix them
  too; only then move on. User explicitly requested this (twice — original
  session + 2026-04-06 reinforcement)."*
- `feedback_single_iteration_review.md` (5 days old, supersedes the above):
  *"Relax the per-phase review loop to a single iteration: spawn reviewer
  once, apply every finding, then move to the next phase. Do NOT re-spawn a
  reviewer."*

Same humans, same surface ("review-fix loop discipline"), opposite
verdicts six days apart. The first entry literally records that the user
had to say it **twice** before it stuck. The reversal lives in plain text
in `MEMORY.md` as *"SUPERSEDED by single-iteration; kept for history"*.

This is principle 02 ("preserve, don't delete") working — and *also* a
loud signal that the brain was relitigating a decision the team thought
was settled. A zettel cluster around "review loop discipline" with the
trajectory threaded would have made the reversal a 30-second read instead
of an N-token re-derivation.

Other re-litigation hits: the email-splitter LLM-vs-regex decision was so
exposed to re-raising that an explicit memory entry exists
(`project_email_splitter_no_llm.md`) saying *"if a future session suggests
'maybe an LLM pass' or proposes reopening ENG-5214, don't"* — defensive
zettel, written *because the team kept being asked the same thing.*

### 3. Lessons learned via pain that had nowhere to go but `~/.claude/memory/`

Every `reference_*.md` in memory is, by structure, the answer to: *what
got us so badly that we had to write it down so it doesn't happen again?*

| Memory entry | The pain it commemorates |
|---|---|
| `reference_browser_integration_build_cache.md` | A stale `.next/` cache silently passed a right-reason check. Worker noticed only on second run. |
| `reference_react_18_dropped_unmounted_setstate_warning.md` | Wrote a "ghost test" that passed regardless of whether the guard existed. *Found only after the test was shipped.* |
| `reference_bun_changed_alias_gap.md` | Pre-push reported "passed" with **0 tests run** because `bun --changed` doesn't follow `@/*` aliases. CI later caught what pre-push lied about. |
| `reference_autosync_concurrent_collisions.md` | Two distinct failure modes — one wrote a doc under a stranger's commit message; the other silently reverted 182 lines of committed work. |
| `reference_fake_timer_cleanup_order.md` | A subtle afterEach ordering bug caused intermittent CI hangs, passed locally; tried to preempt the same fix elsewhere and broke a different test in CI for unknown reasons. |
| `reference_playwright_cli_orphans.md` | `kill-all` didn't kill orphans; 20+ chrome processes leaked across runs. |
| `reference_workspace_gmail_routing.md` | Domain-wide forward rules invisible to `gcloud`. |
| `reference_supabase_auth_signing.md` + `feedback_dont_infer_signing_from_apikeys.md` | Two memory entries for the same family of misunderstanding — JWT signing inferred from API key class. |

These are *zettelkasten by emergency*. The auto-memory subsystem is acting
as the leaky bucket where lessons land because no other surface exists.
The shape ("don't do X again, here's the symptom, here's the remedy") is
*exactly* what an atomic zettel looks like — but trapped in a per-user,
per-project flat-file folder with no associative threading and no other
human's awareness.

### 4. The "fighting Claude" loop (principle 04)

Sessions where the user repeatedly re-asserts a constraint Claude keeps
drifting from. Verbatim:

- *"why staging? i told you its happenning locally"* — `cdbf51f5-...`,
  user mid-session having to re-anchor environment context Claude already
  knew.
- *"i believe i only asked for local dev with no commits and i told you
  to stash, right? give me a status of what we did here"* —
  `459dc1c2-...` subagent, user has lost trust the agent remembers its
  own commitments.
- *"q3 - Phase 2: just let's, I told you, let's design phase 1, 2, 3
  cleanup and phase 1 of the feature. Leave phase 2 aside; we'll discuss
  it later"* — `6ed647b7-...`, user has to re-narrate scope boundaries
  *within the same session*.
- *"involves production code should be written tdd really like I told
  you"* — `fe41663a-...`, principle being repeated rather than retrieved.

These are sessions where a shared zettel `"this user, this codebase →
TDD-by-default for production code; stash-don't-commit when scoped to
local dev"` would have surfaced upstream and prevented the re-explanation.

### 5. "Didn't know" + ad-hoc fixes that left no trace

Verbatim discoveries with no obvious capture:

- *"This was the custom wrapper I didn't know about from the docs alone"*
  — `0205f287-.../agent-ab566f45...` (Railway CLI wrapper)
- *"Didn't know about Node.js undici's internal HeadersTimeout (default
  ~2 min). The Python service timeout (5+ min) exceeds the HTTP client
  timeout"* — `1fb9f0c4-.../agent-a7d6e2e`. Caught in retro; no zettel.
- *"Searched Sentry project python-services (wrong slug — it's
  python-fastapi), concluded Python had zero production traces. Didn't
  know Sentry had rich span trees... Didn't check both Sentry projects"*
  — `c6d31007-.../agent-a305023`. Three discoveries in one paragraph;
  one of them eventually became `reference_sentry_cli.md`, the other two
  didn't.
- *"didn't know to export WEBHOOK_PUBLIC_URL before running set-env"* —
  appears in *three different sessions* (`f69a2f1e-...`, `2ebb9f89-...`,
  `492bbe5f-...`). Same trip-wire, three different feet. No zettel.

### 6. Friction lessons captured *for the next agent* with no place to put them

Zettel-shaped fragments that ended up inlined in commits / specs because
there was no shared brain:

- *"a lot of friction; seems like didn't know about set-env"* —
  `2201dd62-.../agent-affe5cbd...`, an inline TODO inside another doc.
- *"Mistake: Unit tests mocked everything, missed the inheritance
  issue. Catch: Integration tests with real env vars exposed the bug.
  Lesson: Test with realistic environment (Doppler, real tokens..."* —
  `459dc1c2-.../agent-ab27461`. A self-authored zettel buried in a PR
  body.
- *"They should not need to remember service names, environment names,
  or that --since/--until exist. The happy path must be zero flags"* —
  `5a40f91c-.../agent-a587f07f...` (Railway CLI design note). A
  principle being articulated; lives only in the design doc.

---

## MIDDLE — pattern catalog

### Pattern A — "Who decided this?" (re-litigation)

Defining shape: a session opens a question that was answered weeks ago in
a session nobody can find.

- **A1 — Review-loop discipline reversal** (memory archaeology):
  `feedback_always_re_review.md` (date: 11d ago) → superseded 6 days later
  by `feedback_single_iteration_review.md`. Quote from the second:
  *"Supersedes: feedback_always_re_review.md — the 're-review until only
  nitpicks' rule is now 'review once.'"* The fact that this had to be
  written as a memory entry — instead of *threaded into* the original — is
  the gap.
- **A2 — Defensive memory entries against re-raising:**
  `project_email_splitter_no_llm.md` exists *because* the team feared
  future sessions would propose re-opening ENG-5214. *"If a future
  session suggests 'maybe an LLM pass would be more robust' or proposes
  reopening ENG-5214, don't."* This is a zettelkasten function (preserved
  decision trajectory) hand-rolled into the wrong substrate.
- **A3 — In-session relitigation:** session `5d7f3c80-...` (the parent of
  *this* very work) prep notes: *"He will just bring up everything we
  already discussed about it. We have unlimited time, unlimited tokens.
  Create a linear issue with the distilled goal."* — the user explicitly
  builds *separation* into the workflow because they expect the topic to
  resurface. The 2nd-brain absence has become a workflow constraint.

### Pattern B — Stale-premise issues (working from a snapshot of reality that's already stale)

- **B1 — ENG-5186 partial-completion blindness**:
  - 2026-04-20: ENG-5186 spec authored.
  - 2026-04-23 (`84dc0d4d-...`, 11:27 UTC): *"ENG-5186 was authored, but
    didn't know the OAuth-client registration step had already been
    completed. It's working from stale premises. So we're already partway
    through ENG-5186 and nobody marked it. ~Step 3 of the 7 in ENG-5186
    is done."*
  - The OAuth client was registered 2026-03-31 — three weeks before the
    spec was written *about the registration*. Both the spec author and
    the executor were operating without the prior zettel.

- **B2 — *"So even that session didn't know where they came from"*** —
  `b0cd7d0d-...` cross-session investigation: agent searches a *different
  prior session's* messages and finds *that* session also lacked the
  context. Recursive ghost-decision.

### Pattern C — Re-debugging the same trap

- **C1 — `WEBHOOK_PUBLIC_URL` set-env trip-wire** — three sessions
  (`f69a2f1e-...`, `2ebb9f89-...`, `492bbe5f-...`) all hit *"failed
  silently for anyone who didn't know to `export WEBHOOK_PUBLIC_URL`
  before running set-env."* The fix in each session was the same. A zettel
  *"set-env requires WEBHOOK_PUBLIC_URL exported, fails silently
  otherwise"* would have collapsed three debugging arcs into one.
- **C2 — Sentry project slug wrong** — `c6d31007-...` discovered
  `python-services` is actually `python-fastapi`. Eventually became
  `reference_sentry_cli.md` (the *answer* — but only after how many
  sessions tripped on the slug?). The reference entry itself frames it as
  *"use `sentry` on PATH, not the long path"* — a workaround zettel. The
  underlying *project-slug* zettel is implicit.
- **C3 — `feedback_dont_infer_signing_from_apikeys.md`** is described as
  the corrective companion to `reference_supabase_auth_signing.md` — two
  memory entries for the same family of bug, written separately because
  there was no thread to attach the second to the first.

### Pattern D — "I told you" friction (constraint repeats within or across sessions)

- **D1 —** *"why staging? i told you its happenning locally"* —
  `cdbf51f5-...`. User had already provided environment context; agent
  drifted.
- **D2 —** *"i believe i only asked for local dev with no commits and i
  told you to stash, right?"* — `459dc1c2-.../agent-a80eebd`. User asks
  the agent to confirm its own commitments.
- **D3 —** *"q3 - Phase 2: just let's, I told you, let's design phase 1,
  2, 3 cleanup and phase 1 of the feature. Leave phase 2 aside"* —
  `6ed647b7-...`. Scope re-narration *within* a session.
- **D4 —** *"production code should be written tdd really like I told
  you"* — `fe41663a-...`. Principle re-asserted instead of retrieved.

These map directly to principle 04 (fighting vs. asking): every "I told
you" is a frustration zettel in plain sight that nothing is currently
indexing.

### Pattern E — Memory as accidental zettelkasten

A structural reading: **57 markdown files** in
`~/.claude/projects/-workspaces-test-mvp/memory/` form a primitive zettel
graph. Each entry has:
- a `name` (the atomic claim)
- a `description` (one-line distillation)
- a `type` (`feedback`, `reference`, `project`, `user`)
- an `originSessionId` (provenance)
- prose (the lesson)

This is a zettelkasten missing only the *threading layer*. Today,
`MEMORY.md` is a hand-curated index. Cross-references are by free-text
mention (*"SUPERSEDED by single-iteration; kept for history"*) — there is
no automatic surfacing when you touch a related area. The shape is right;
the substrate is solo, flat, and per-user.

Distilled implication: the team has *already* been building a 2nd brain
**by emergency** for ~6 weeks. The shared, threaded version is the
already-felt missing layer.

---

## BOTTOM — raw inventory

Quotes are verbatim with session ID + date (UTC where available). All
sessions live under `~/.claude/projects/-workspaces-test-mvp/`. Subagent
paths are relative to that.

### Re-litigation / ghost decisions

| Session | Date | Quote |
|---|---|---|
| `84dc0d4d-103d-...` | 2026-04-23 11:27 | *"ENG-5186 was authored, but didn't know the OAuth-client registration step had already been completed. It's working from stale premises. So we're already partway through ENG-5186 and nobody marked it. ~Step 3 of the 7 in ENG-5186 is done."* |
| `b0cd7d0d-...` | n/d | *"So even that session didn't know where they came from. Let me check the sessions that were running concurrently with `95838913`"* — agent excavating prior sessions for context that should have been a zettel |
| `5d7f3c80-...` | 2026-04-27 | *"He will just bring up everything we already discussed about it. We have unlimited time, unlimited tokens. Create a linear issue with the distilled goal."* — user designs around expected re-litigation |
| `68909a59-...` & `ba5518a3-...` | n/d | *"I don't need an agent to research what we already discussed and decided. Let me just present the ACs directly."* — appears across multiple sessions, identical wording |

### Memory entries as zettel-by-emergency

| Memory file | Type | Captures |
|---|---|---|
| `feedback_always_re_review.md` | feedback | "Always re-review until nitpick-level remain. User explicitly requested this (twice)" |
| `feedback_single_iteration_review.md` | feedback | "Single iteration. SUPERSEDES feedback_always_re_review" — *6 days later* |
| `project_email_splitter_no_llm.md` | project | Defensive zettel: *"if a future session suggests 'maybe an LLM pass'... don't"* |
| `reference_browser_integration_build_cache.md` | reference | False-pass right-reason check on stale `.next/` cache |
| `reference_react_18_dropped_unmounted_setstate_warning.md` | reference | "Ghost test" — passed regardless of guard presence |
| `reference_bun_changed_alias_gap.md` | reference | Pre-push reported "passed" with 0 tests run |
| `reference_autosync_concurrent_collisions.md` | reference | 182 lines silently reverted by stranger commit |
| `reference_fake_timer_cleanup_order.md` | reference | CI-only intermittent timeouts; preemptive fix attempt broke other tests |
| `reference_playwright_cli_orphans.md` | reference | `kill-all` leaked 20+ chrome processes |
| `reference_sentry_cli.md` | reference | Project slug `python-fastapi`, not `python-services` |
| `reference_workspace_gmail_routing.md` | reference | Domain-wide rules invisible to `gcloud` |
| `reference_supabase_auth_signing.md` + `feedback_dont_infer_signing_from_apikeys.md` | reference + feedback | Two entries for same family of misunderstanding |
| `feedback_grep_jsonl_directly.md` | feedback | "When asked to find a session by topic, rg/zgrep directly" — meta: the team had to write down *how to find prior sessions* because it kept getting wrong |

### "Didn't know" / silent failure modes

| Session / agent | Quote |
|---|---|
| `84dc0d4d-...` 2026-04-23 | *"didn't know the OAuth-client registration step had already been completed"* (B1 above) |
| `0205f287-.../agent-ab566f45...` 2026-04-01 | *"This was the custom wrapper I didn't know about from the docs alone"* (Railway CLI) |
| `1fb9f0c4-.../agent-a7d6e2e` | *"Didn't know about Node.js undici's internal HeadersTimeout (default ~2 min). The Python service timeout (5+ min) exceeds the HTTP client timeout"* |
| `c6d31007-.../agent-a305023` 2026-03-26 | *"Searched Sentry project `python-services` (wrong slug — it's `python-fastapi`), concluded Python had zero production traces... Didn't know Sentry had rich span trees... Didn't check both Sentry projects — only searched one side"* |
| `c6d31007-.../agent-a305023` | *"Didn't know Railway logs have ~24h retention and need to be saved urgently"* |
| `f69a2f1e-...`, `2ebb9f89-...`, `492bbe5f-...` | *"failed silently for anyone who didn't know to `export WEBHOOK_PUBLIC_URL` before running set-env"* — three sessions, same quote |
| `f9f26562-...` | *"Three things are also now clear that I didn't know before: 1. `index_time` and searchability are not the same thing..."* |
| `2201dd62-.../agent-affe5cbd...` | *"a lot of friction; seems like didn't know about set-env"* — inline note in another doc |
| `f7af3c9b-...`, `f9f26562-...` | *"Good pushback — I conflated two different mechanisms when I said..."* |

### "I told you" friction (D1–D4)

| Session | Quote |
|---|---|
| `cdbf51f5-870c-...` | *"why staging? i told you its happenning locally"* (user → agent) |
| `459dc1c2-.../agent-a80eebd` | *"i believe i only asked for local dev with no commits and i told you to stash, right? give me a status of what we did here"* |
| `6ed647b7-...` | *"q3 - Phase 2: just let's, I told you, let's design phase 1, 2, 3 cleanup and phase 1 of the feature. Leave phase 2 aside; we'll discuss it later"* |
| `fe41663a-...` & `9765edf6-.../tool-results/bcg56ojco.txt` | *"everything that involves production code should be written TDD, really like I told you"* (the same human input replayed across two sessions) |
| `161d068e-...` | *"That commit is the ENG-4918 Tooltip hoist I told you earlier was a red herring. It was a red herring for your click bug... but it's a real fix for a 'Maximum update' loop"* — agent re-correcting its own prior framing |

### Self-authored lessons that ended up in the wrong substrate (PR bodies, design docs)

| Session / agent | Quote |
|---|---|
| `459dc1c2-.../agent-ab27461` | *"Mistake: Unit tests mocked everything, missed the inheritance issue. Catch: Integration tests with real env vars exposed the bug. Lesson: Test with realistic environment (Doppler, real tokens..."* — zettel-shaped, buried in PR body |
| `5a40f91c-.../agent-a587f07f...` | *"They should not need to remember service names, environment names, or that --since/--until exist. The happy path must be zero flags."* — design principle inlined in a CLI design doc |
| `2d1764c1-...` | *"Combined latency picture (if all three fixes ship)... we already discussed"* — references prior discussion that lives only in the prior JSONL |
| `eb412a56-...` & `05e0ed14-...` | *"were sound — I didn't need to relitigate them. Did the spec hold up as a contract? — I didn't need to invent criteria beyond what the AC + test plan"* — meta-zettel about why relitigation was avoided this time, only because the spec was unusually rigorous |

---

## What this points the prototype at

A prototype that *just* gave the team:

1. **Claim-shaped capture** — "decided X because Y; rejected Z because W" — one keystroke from terminal/editor.
2. **Atomic + threaded** — entries link by `supersedes`, `relates-to`, `caused-by-pain-in`.
3. **Surfacing on touch** — when a session opens a file, a Linear ID, a CLI tool, a service slug, or an env var that has zettels attached, those pop in-context.
4. **Cross-user + cross-session by default** — solving the "this lesson is stranded in lihub's archive" problem.

…would have prevented or compressed every example above. The team is
already *trying* to do this with the auto-memory files; they've already
distilled the shape (front-matter + atomic claim + provenance). What's
missing is: shared, threaded, and surfaced contextually.
