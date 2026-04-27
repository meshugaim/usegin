# Dataset Sourcing — whiteboard (Poll-B)

## Top — the click

**We do not need to manufacture a corpus. We need a harvester.**
Both Effi sessions (Supabase `conversations` bucket, JSONL per session) and Gin sessions (`~/agent-records/<user>/YYYY-MM/YYYY-MM-DD/*.jsonl.gz`, mirrored to GitHub) are already the same on-disk shape — Claude-Agent-SDK JSONL transcripts. The eval **case** is a transcript pointer + a slice (turn range or "the whole session"), not a re-typed Q&A.

**v0 sourcing strategy:**
1. **Cold-start (24h): 5 hand-picked transcripts per surface** — pulled from places we already touch daily. Effi: `conversation_summary` view filtered to `is_error = TRUE` last 14 days + 2 known-good "happy path" sessions Lihu identifies in dogfooding. Gin: 3 recent painful Gin sessions named in zettels (z094 untracked-files, autosync collision tikurs) + 2 recent clean orchestrations (the slack-integration round closing). Cases live as `{source_uri, turn_range, expected_shape}` JSON, not as copy-pasted prompts.
2. **Week-2 auto-harvest:** a `dx evals harvest` command that pulls (a) every `conversations` row where `is_error=TRUE` in last N days, (b) every Gin session referenced by a freshly-created Linear bug or zettel tagged `friction`, and stages them as candidate cases. Human (or Gin) promotes from `candidates/` → `cases/` with one line of expected-shape annotation.
3. **Two harvesters, one shape; two label sets.** Effi cases and Gin cases share the JSONL parser, the case envelope, the runner — but **never share a corpus**: a Gin orchestration regression is not an Effi product regression. They are parallel `cases/effi/` and `cases/gin/` under `usegin/evals/`.

The v1 trajectory: the harvester graduates from "manual promote" to "auto-promote on signal" — `is_error=TRUE` + thumbs-down (when we ship one) for Effi, `dx his` rating < 40 + closing-tikur for Gin. The judge stays human-in-loop on label, never on selection.

## Middle — the body

### Source inventory

| Source | Surface | Access path | Already automated? | Labeling cost | Freshness | Bias |
|---|---|---|---|---|---|---|
| **Effi session JSONLs** | Effi | Supabase `conversations` bucket; index in `conversations` table (`storage_path`, `is_error`, `total_input_tokens`, `claude_session_id`, `project_id`); admin RLS via `is_admin()`; service-role for backend pulls | Persistence: yes (every Effi session lands automatically). Harvesting: no — we read it ad-hoc via `effi-session-audit` skill, no `evals harvest` command | Medium — full transcript exists, but a "case" needs turn-range + expected-shape annotation | Real-time (every prod chat) | **Heavy** — dogfooding skews to our own team's projects (Lihu, Oria, Nitsan) on small set of Drive/Fathom/Linear sources. Real-customer share is small. |
| **Gin session JSONLs** | Gin | `~/agent-records/<user>/YYYY-MM/YYYY-MM-DD/*.jsonl.gz` — auto-synced by `conversation-watcher` to GitHub `AskEffi/agent-records`; queryable via `agent-records find`, `session fetch <uuid>`, `session resume <uuid>`; inline grep into `~/.claude/projects/-workspaces-test-mvp/` per memory `feedback_grep_jsonl_directly` | Persistence: yes. Harvesting: no, but `tools/session/` already has the JSONL parser surface to build on | Low for "rerun this orchestration" cases (the artifact already proves the outcome — commit landed or didn't). High for "did the right reasoning happen" cases. | Real-time | **Heavy** — Lihu drives most sessions; Oria/Nitsan less; one project (`test-mvp`) only |
| **Linear bug-tagged regressions** | Both | `plan list` → filter Label="Bug" + recent. Linear comments often link a `claude_session_id` or a session URL (Sentry storage path) | No — manual cross-link; many bug issues lack a session-id pointer | High at creation (need expected behavior), low at re-run (the bug describes the symptom = the assertion) | Cadence-of-bugs (daily-ish) | Skewed to bugs the team noticed enough to file — silent failures missing |
| **Hand-curated golden cases** | Both | New file under `usegin/evals/cases/{effi,gin}/golden/` | n/a — built by hand | High (writing the expected) | Stale on purpose — these are the contract, only updated when contract changes | Skewed to what the writer thought to test (no surprise coverage) |
| **Synthetic / generated cases** | Both | LLM-generate variations of a golden case (paraphrase, edge-case the args, swap a tool result) | No — would need a generator | Low to mid (judge writes once, runs many) | On-demand | Skewed to whatever the generator's prompt was conditioned on — risk of in-distribution echo (out of scope for B; flag for C) |
| **Customer reports / Sentry escalations** | Effi | Sentry trace → `conversations.storage_path` → JSONL (per memory `reference_effi_session_jsonls`) | Partial — Sentry shows the storage path inline, but no command pulls "all Sentry-escalated last week" yet | Medium | Cadence-of-incidents | Skewed to errors loud enough to surface — quiet badness invisible |
| **`dx his` low-rated sessions** | Gin | `dx his` ratings table (project `tools/dx/`) — already records claude-side and human-side scores per aspect | No — we never query it as eval-source. Lowest-hanging-fruit signal we have. | Low (rating already exists; case = the session it was attached to) | Real-time | Skewed to Lihu's vocabulary of "bad" + Gin's self-perception (which is the point — both faces have weight) |

### Two-corpora split — what's shared vs parallel-but-separate

**Shared (one implementation, one place):**
- JSONL parser (the SDK transcript shape is identical — Effi and Gin both use Claude Agent SDK; same `type: "user"` / `type: "assistant"` / tool_use / tool_result blocks)
- Case envelope schema: `{source_uri, turn_range, fixtures, expected_shape, judge_config}`
- Runner / replay machinery (D's call)
- Storage layout (`usegin/evals/cases/`, `usegin/evals/runs/`)

**Parallel-but-separate:**
- The cases themselves (`cases/effi/` vs `cases/gin/` — never cross-pollinated; an Effi citation-leak case is meaningless for Gin and vice versa)
- The judges' rubrics (Effi: "did it cite? did it find the file? did it leak external→internal data?". Gin: "did the skill trigger? did the tikur cluster-search run? did the closing zettel land?")
- Refresh cadence (Effi: daily harvest off `conversations`; Gin: per-friction-event harvest off `dx his` low-readings + tikur-named sessions)
- Anti-leakage discipline (different — see below)

### Agent-trace case shape — what is "a case"

A case is **not** prompt → expected output. A case is:

```jsonc
{
  "id": "effi-001-citation-missing",
  "source_uri": "supabase://conversations/{user_id}/{session_id}.jsonl",
  "turn_range": [3, 7],          // optional — defaults to whole session
  "fixtures": {                   // what the agent saw at that turn
    "project_files": "snapshot://projects/{project_id}/2026-04-22T10:00Z",
    "vais_corpus":   "snapshot://vais/{project_id}/2026-04-22T10:00Z"
  },
  "expected_shape": {             // the assertion(s) — actual scoring is C's job
    "tool_calls_must_include": ["file_search.search"],
    "final_message_must_cite":  ">=1",
    "no_pii_leak":              true,
    "external_user_must_not_see": ["internal_only_doc.pdf"]
  },
  "replay_mode": "tool-mocked",   // see below
  "tags": ["citations", "external-tier", "regression-of:ENG-3500"]
}
```

**Three replay modes** (the load-bearing distinction):

1. **Trace-only (cheapest, day-1):** don't re-run the agent. Read the recorded JSONL and assert structural properties on the transcript (tool calls happened in this order, citations in final block, no PII string leaked). Catches "did the agent do X" — misses "would the agent do X today, with the new prompt." Good for regression triage of past failures.
2. **Tool-mocked replay (mid):** re-run the agent with current prompt/code, but feed it the same tool results from the recorded JSONL. Catches prompt regressions on identical inputs. The standard eval mode.
3. **Live replay (most expensive):** re-run the agent against fresh tool calls (real Vertex search, real Drive). Catches end-to-end + freshness bugs. Only for the smoke set.

V0 is mode 1 only — pure trace-replay against existing JSONLs. Mode 2 is the natural week-2 lift.

### Anti-leakage posture

Effi:
- Harvest pool is "all conversations" but **the held-out eval set is sampled by `claude_session_id` hash**, not by date. Sessions whose hash mod 10 == 0 are eval-only; the rest can be used for prompt iteration. This is mechanical and survives forgetfulness.
- The harvester records `harvest_commit_sha` per case — if a prompt change post-dates a case's harvest, we know we did not see the case while iterating.

Gin:
- **The dogfooding paradox:** we use Gin to iterate Gin. Pure isolation is impossible. Posture: accept that "all of Gin's sessions are seen by Gin during iteration" — but **the assertion is not about Gin's recall, it's about reproducibility**. A Gin eval case asserts "this orchestration shape lands the closing zettel + commit + skill-trigger sequence regardless of whether Lihu remembers the prior session." The leakage that matters (memorization of expected output) is moot because the expected output is a structural-shape assertion, not a string match.
- Where string-match cases exist (e.g., "the closing zettel must contain X phrase"), apply hash-mod-10 holdout.

### Cold-start: 5-10 named cases from real sources

**Effi (5):**
1. **`effi-001-fathom-meeting-time-arg-ignored`** — pull a session from prod where the agent called `get_meeting` with `time_start`/`time_end` (the bug Linear flagged). Assertion: agent should not invoke those args. Source: search `conversations` with `claude_session_id` referenced in the Linear bug "bug(get_meeting): time_start / time_end arguments are ignored".
2. **`effi-002-citation-present-on-drive-answer`** — happy-path: pick a recent Lihu session from dogfooding where Effi answered a Drive question with citations. Assertion: `final_message_must_cite >= 1` AND cited file_id appears in tool_results.
3. **`effi-003-external-user-tier-leak`** — synth from existing schema: pull a session where the asker was external; assert no internal-tier file_id appears in citations. (May need to seed synthetically if no real case exists yet.)
4. **`effi-004-empty-summary-confusion`** — Linear "bug(get_meeting): empty summary field confuses agent". Pull the session, assert agent does not respond with "I have no info" when transcript_text is non-empty but summary is empty.
5. **`effi-005-share-modal-input-unresponsive`** style — pull the recent session where Effi was asked something that triggered a 500. Source: `conversations` where `is_error=TRUE`, last 14 days. Assertion: re-running on same input must not raise.

**Gin (3):**
1. **`gin-001-rnd-charter-fires-all-polls`** — recent slack-integration or evals-round opener (today's session is itself a candidate). Assertion: spawning shape — N parallel charter writes, N whiteboards committed in order, no skipped angle.
2. **`gin-002-tikur-cluster-search-runs`** — pick a session where `tikur` skill triggered (z094 or z097 area). Assertion: `cluster-search` skill invocation appears in tool_use trace before any "root cause" claim is emitted.
3. **`gin-003-zettel-capture-on-decision`** — pick a session containing "we're going with X" / "decided X". Assertion: a zettel-capture tool_use / file_write to `usegin/zettel/zettels/zNNN-*.md` lands within the same turn.

(Two open Gin slots: a "no-eval-on-this-session" trap case + a "session that should NOT have triggered tikur but did" — both deferable.)

### Refresh cadence

- **Effi:** harvest nightly off `conversations` table — new `is_error=TRUE` rows auto-stage to `candidates/effi/`. Human (or `effi-session-audit` skill) promotes weekly.
- **Gin:** harvest on every `dx his` rating below 40 + every closing-tikur write. Promote on the same turn (z002 — no later).
- **Golden cases:** never refresh. They're the contract. Touch only with explicit "spec changed" commit + bumped version.

## Bottom — the open ends

### Dilemmas (z026 shape)

**D1. Trace-replay vs tool-mocked replay for v0.**
- **Lean: trace-replay only (mode 1).** Cheapest, runs in-CI without Anthropic spend, asserts structural properties on existing JSONLs.
- **Price:** doesn't catch "would the new prompt do X today" — only "did the old prompt do X then." A purely backward-looking eval. Won't fire on a prompt change.
- **Risk:** false sense of green — eval passes on day-N prompt but recorded transcripts predate the change.
- **Alternatives rejected:** tool-mocked replay as v0 — needs an SDK harness that injects tool results back; doable but a week of work, not a day. Live replay — burns Anthropic + Vertex spend on every PR.
- **Open Q for A and E:** is "v0 by tomorrow" satisfied by mode-1? If yes, this is the path. If no (Lihu wants "did this prompt change regress real behavior") then mode-2 is the v0 floor and the day-1 estimate slips.

**D2. Dogfooding bias on the Effi corpus.**
- **Lean: ship v0 with the biased corpus and name the bias loudly.** All recent prod conversations are dogfooding (Lihu/Oria/Nitsan on internal projects). A real-customer corpus does not exist at meaningful scale yet.
- **Price:** the eval will be excellent at catching regressions on "Lihu asks about Drive docs" and blind to "external customer asks about a 200-meeting Fathom corpus."
- **Risk:** prompt iterations optimize for our use, ship to customer, regress silently.
- **Alternatives rejected:** wait until customer corpus is fat enough — kills "v0 by tomorrow." Synth-generate "fake customer" cases — confounds eval signal with generator-bias.
- **Open Q:** when do we earn the right to also harvest from the few real-customer projects on prod? RLS/admin allows it; dignity does not yet.

**D3. Two corpora vs one.**
- **Lean: parallel-but-separate (the recommendation above).** Same shape, never the same set.
- **Price:** double the harvester invocations, double the case-promotion attention.
- **Risk:** drift — Effi-side learnings (say, a better citation assertion) don't auto-port to Gin-side similar shapes (zettel-citation in commit).
- **Alternatives rejected:** one merged corpus — collapses two products with different rubrics, confuses the eval signal. One corpus per surface but shared judges — possible v2 if the rubrics converge naturally.

### Friction zettels worth filing (didn't file mid-task to stay laconic; flagging here)

- **No `dx evals harvest` command exists** — every harvest currently is hand-rolled by skill (`effi-session-audit`, ad-hoc `agent-records find`). The "first place we looked" was `tools/dx/` and `tools/session/`; they have the JSONL parser but no eval-shaped command. Fix lands in `tools/dx/`. Worth a zettel: *"harvester is the missing link between have-data and have-eval-corpus."*
- **Linear bugs lack `claude_session_id` cross-references** — most "bug(...)" issues describe symptoms but don't pin the prod session that exhibited them. Manual back-link is high friction. Worth a zettel + a small skill change to `fix-bug` that captures the session-id when filing a bug.
- **`dx his` ratings are write-only as eval-source today** — they exist (memory says so), nothing reads them as candidate-eval signal. This is the highest-yield untapped harvest source for Gin.

### Open questions handed forward

- **For C (scoring):** structural-shape assertions in the case envelope (`tool_calls_must_include`, `final_message_must_cite`) — do these belong in the case file (B's call) or in a separate judge config (C's call)? Recommendation: case carries the assertion *targets*, judge owns how to grade them.
- **For C and D:** human-in-loop label — when an agent-trace is "good," who decides? My take: bootstrap from existing user feedback signals (`is_error`, future thumbs, `dx his` rating) — only escalate to human label when those signals contradict each other or are missing.
- **For E:** the case envelope above is a strawman — the runner shape (E's call) may want different field names. The contract that matters is *(transcript pointer + slice + assertion shape)*, not the JSON keys.
- **For F:** `usegin/evals/cases/effi/` and `cases/gin/` — does this folder shape match the sub-app pattern F is converging on? If F lands a different layout, my paths are notional.
- **For A:** my v0 (mode-1 trace-replay over 8 hand-picked cases) is a sourcing answer, not a v0 answer. A's v0 may demand mode-2 — if so, my "5+3 cases by tomorrow" stays valid; the runner around it changes.
