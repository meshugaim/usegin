# Distillation Pass 001 — log

Append-only log of findings from the first formal distillation pass over the zettel corpus (47 files, z001–z047).

Process: per `usegin/zettel/organizing-process.md` and z039 / z040. Findings here are *enumerated*, not all fixed inline. Tier 1 (mechanical, no meaning change) findings may be applied directly; Tier 2 (semantic — supersedes / merges / splits / re-titles / re-placements) are logged for Lihu's review.

Format: `## YYYY-MM-DD-NNN — title` then *issue / where / proposed fix / tier*. Forward-only — never edit a finding after writing it; if it changes, append a new dated entry below.

---

## 2026-04-27-001 — Test-fixture zettels are polluting the corpus (z041–z047)

**Issue.** z041–z047 are CLI-test artifacts produced while exercising `dx zettel add` / `link` / placement-form variants. Their titles ("Flow 1 stopwatch", "ThreadTest", "FilepathRefTest", "PlacementChild22", "DoublePlacement", "ShortIdPlacement", "ShortIdPlacement2") are not claims (z015 / Matuschak — title is the API). Their bodies are one-line test descriptions ("Threading test", "Try setting two placements"). They occupy real ids, fragment the address space, and dilute density measurements (z040 — clusters are *observed*; noise zettels create false signal).

**Where.** `usegin/zettel/zettels/z041-flow-1-stopwatch.md` … `z047-shortidplacement2.md`.

**Proposed fix (Tier 2).** Per principle 02 we don't delete. Two viable routes:
1. *Mark them inert.* Add a `kind: test-fixture` (or similar) front-matter field; teach `dx zettel list` and graph traversal to suppress that kind by default. Keeps history; removes graph noise.
2. *Renumber-archive.* Move them to a `usegin/zettel/zettels/_test-fixtures/` subfolder so the main index stays clean. Same kind=fixture marker for consumers that walk the whole tree.

Lean: (1) — lighter, no path churn, lets `--all` reveal them when debugging the CLI itself.

Whichever Lihu picks, **also fix the CLI**: `dx zettel add` invocations from a test harness should default to a non-corpus output dir, not the production zettel store. (That's a Linear issue, not a zettel.)

---

## 2026-04-27-002 — z044 has both ↑ and ~ to the same target (z022)

**Issue.** `threads: [↑z022, ~z022]` — duplicate edge to the same neighbor in two different roles. Per `zettels/README.md`, placement (`↑`) and cross-reference (`~`) are kept distinct; same-target-in-both-roles is not idiomatic and confuses graph queries.

**Where.** `usegin/zettel/zettels/z044-placementchild22.md`.

**Proposed fix (Tier 1, but withheld).** Drop the `~z022` cross-ref; placement subsumes it. *Withheld* because z044 is itself a CLI test fixture (finding 001) — the duplicate likely *is* the test case. Resolve with finding 001.

---

## 2026-04-27-003 — z046 and z047 use non-canonical short-id thread forms

**Issue.** `↑22` (no `z`, no zero-pad) in z046; `↑z22` (no zero-pad) in z047. Convention is `z022`. These trip the dangling-ref check (`comm -23 refs exists` flagged `z22`).

**Where.** `z046-shortidplacement.md`, `z047-shortidplacement2.md`.

**Proposed fix (withheld).** Same as 002 — these zettels' *bodies* explicitly say they are testing the short-id form; rewriting the thread defeats their purpose. Resolve with finding 001 (mark as fixtures and exclude from corpus checks), or open an `dx zettel link` validation issue: should the CLI accept these forms (and normalize on write) or reject them?

---

## 2026-04-27-004 — z020 has TWO placement (↑) parents

**Issue.** `threads: [↑principle-02, ↑principle-01, ~z002, ~z015, ~ENG-5392, ~ENG-5335]`. README is explicit: *"`placement` — exactly one per zettel."* z020 picks both principle-01 and principle-02.

**Where.** `usegin/zettel/zettels/z020-decision-shape-in-claude-md.md`.

**Proposed fix (Tier 2).** This is a genuine semantic call — does "decisions have a shape" sit primarily under principle-02 (decisions-preserved) or principle-01 (intuitive-workflows)? Lean: **principle-02** is the load-bearing parent (the entire body is about the decision-preservation trail); demote `↑principle-01` → `~principle-01`.

---

## 2026-04-27-005 — z041 has empty placement (no parent)

**Issue.** `threads: []`. Per z040, every zettel sits *somewhere* — at minimum a placement parent. z041 has neither placement nor cross-references.

**Where.** `usegin/zettel/zettels/z041-flow-1-stopwatch.md`.

**Proposed fix.** Resolves with finding 001 (test fixture). If kept as a corpus zettel, it'd need a parent — likely `↑z038` (it's a slice-1 stopwatch / dogfood test, sibling to the race observation).

---

## 2026-04-27-006 — z022 (two-faces) and z019 (comfort-axes) overlap

**Issue.** z022 says "anything in Gin can have human-side and Gin-side, when suitable." z019 says "comfort axes — speaker × addressee shapes the language." z019 is the more developed claim — it explicitly *generalizes* the speaker/addressee dimension that z022 only gestures at via "two faces." z022 reads as the parent / pre-game version; z019 as the distilled successor.

**Where.** `z022-two-faces-when-suitable.md`, `z019-comfort-axes-per-addressee.md`.

**Proposed fix (Tier 2).** Don't merge. Per z039, distillation tightens the same claim; these are *different* claims:
- z022: "artifacts can have multiple consumer-faces."
- z019: "the same content has different optimal shape per addressee."

But the threading should reflect the lineage: **z019 should `↑z022` as placement** (it currently `↑principle-01`). The principle is fine as a `~`. Re-place z019 under z022.

---

## 2026-04-27-007 — z028 contains TWO atomic decisions (D1 + D3)

**Issue.** Per z015 / Matuschak — title is the API; one zettel = one claim. z028's title says "foundational decisions" (plural) and the body holds two distinct z020-shape decisions: *D1 (build-from-scratch-using-what-helps)* and *D3 (one-shared-brain, no privacy)*. They thread differently — D1 is about engineering approach; D3 is about access model. A future zettel that wants to thread to "the no-privacy decision" can't address it cleanly.

**Where.** `usegin/zettel/zettels/z028-zettel-app-foundational-decisions.md`.

**Proposed fix (Tier 2 — split).** Two new zettels, each carrying one decision verbatim, with `↑z028` placement. z028 stays as the hub (z040 — clusters earn the name) listing them.

---

## 2026-04-27-008 — z032 contains TWO atomic decisions (D-coord + D-doc)

**Issue.** Same shape as 007: D-coord (build first, coordinate later with Oria & Nitsan) and D-doc (defer doc-method until pgvector lands) are independent decisions bundled into one zettel.

**Where.** `usegin/zettel/zettels/z032-coord-and-doc-decisions.md`.

**Proposed fix (Tier 2 — split).** Same shape as 007.

---

## 2026-04-27-009 — z031 self-declares atomicity violation

**Issue.** Body opens with *"Two distinct things to capture:"* — the zettel itself names the split. (1) `effi ask` default timeout too short for synthesis sweeps. (2) Existing R&D whiteboards as Effi-substitute pattern.

**Where.** `usegin/zettel/zettels/z031-effi-ask-timeout-default.md`.

**Proposed fix (Tier 2 — split).** The first is a Linear-shaped complaint about a CLI default. The second is a methodological claim ("R&D whiteboards are reusable as Effi-substitute") that wants to be a real zettel placeable under z006 (things-we-grow) — Effi Historian whiteboards as a thing-we-grow.

---

## 2026-04-27-010 — z023 (sub-Gins inherit spawn) contradicted by z029 (harness blocks it)

**Issue.** z023 declares: *"Sub-Gins inherit the same right to spawn. So a spawned professor … can spawn its own three sub-Gins."* z029 documents this is not true via the Agent tool: *"sub-Gins inherit the right; the harness denies them the tool."* z029 is observation; z023 is intent. They contradict on the operational claim.

**Where.** `z023-spawn-as-instantiation.md`, `z029-spawned-gins-lack-Agent-tool.md`.

**Proposed fix (Tier 2 — supersedes-or-clarify).** Two paths:
1. *Distill z023 in place* (z039) — bump version, soften the inheritance claim from "sub-Gins inherit the right to spawn" to "sub-Gins are also Gins; whether they can themselves spawn depends on how they were instantiated (Agent tool = leaf; headless = full)." Re-thread `~z029`.
2. *New decision zettel* in z020 shape: **decided: prefer orchestrator-side decomposition (z029 lean #2) over deep nesting; supersedes the deep-recursion expectation in z023.** Threads back to both.

Lean: (2). The contradiction is exactly the z020 shape ("we decided X because Y; the alternative was Z which the harness blocks"). Worth its own claim.

---

## 2026-04-27-011 — Frontmatter `session:` field has drifted to four shapes

**Issue.** `session:` values across the corpus include:
- Short hex `5d7f3c80` (z001–z033 mostly)
- Full UUID `5d7f3c80-227d-4d0e-87ac-1574f3501c93` (z035, z038, z041–z047)
- Full UUID `a2f5af80-303b-4c26-957b-ddb5bfeb61e3` (z037, z039, z040)
- `current` (z019, z020)
- `unknown` (z036)

**Where.** Across the corpus.

**Proposed fix (Tier 2 — but bounded).** This is authoring-time provenance; rewriting it is rewriting history (principle 02 violation). The right move is *forward*: standardize NEW zettels on full UUID via `dx zettel add` (already does this), and accept the legacy values as the trace they are. *No backfill.* Log here so the next pass knows it's deliberate, not missed.

---

## 2026-04-27-012 — `authored-by: gin` survives in z029, z030, z031 after the gin→usegin rename (z033)

**Issue.** z033 renamed Gin → UseGin. z029/z030/z031 carry `authored-by: gin (doc-method-team)`. They were authored before the rename; rewriting them is history-rewriting (principle 02).

**Where.** z029, z030, z031.

**Proposed fix.** No fix. Log only. Same logic as 011: authored-by records who wrote it under what name at the time. Forward-only — new zettels use `usegin`.

---

## 2026-04-27-013 — Threads to non-zettel addresses are de-facto OK

**Issue.** Many zettels thread to non-`zNNN` addresses: `↑principle-0X`, `~ENG-XXXX`, `~SLICE-1`, `~D1`, `~D3`, `~zettel-custom-future`, `~feedback_concise_answers`, `~tools/dx/CLAUDE.md`, `~gin (umbrella)`. The README sanctions this (*"zettel ids and other addresses"*). Reviewing them: all are real addresses *somewhere* (Linear issue, principle file, dx CLI doc, memory entry, in-flight slice). None are dangling.

**Where.** Across the corpus.

**Proposed fix.** None. Confirms the README convention is working. The single dangling ref (`z22` in z046/z047) is the test-fixture issue (003); no real dangling refs in the production corpus.

---

## 2026-04-27-014 — z033 supersedes z021 but downstream zettels still ↑z021

**Issue.** z033 carries `supersedes: z021` for the rename. Per `zettels/README.md` ("If a zettel is superseded, write a new one with `supersedes:` and link both ways. Never silent-overwrite"), this is correct — z021 stays. But z022, z024, z025 still placement to `↑z021`, not `↑z033`. Is z021 still the right parent for "umbrella" downstream-of, or should they re-place to z033?

**Where.** z022, z024, z025 (and z028 has `~z021`).

**Proposed fix.** No mechanical fix. z033 supersedes z021 on the *name* only; z021's umbrella-claim is still the load-bearing parent for "Gin owns its house" downstream concepts. Re-placing them under z033 would conflate "naming decision" with "umbrella structure." Leave threads where they sit. Log to settle the convention: **supersession on a narrow axis (here: name) does not propagate to placements**; full-claim supersessions would.

---

## 2026-04-27-015 — z015 (pre-game manual) and z028 (build-from-scratch-using-what-helps) overlap on the "manual first" idea

**Issue.** z015: "only systematize what we've actually done by hand at least once." z028 (D1 portion): "build from scratch but lift any working piece; no do-twice." They share the discipline of *not over-systematizing ahead of evidence*, but z015 is a methodological claim (general rule) and z028 is a specific decision shaped by it. z028 should `↑z015` as placement (currently `↑ENG-5379` for D1 / `↑z028` for itself — actually z028 placements `↑ENG-5379`).

**Where.** `z028-zettel-app-foundational-decisions.md`.

**Proposed fix (Tier 2).** When 007 splits z028, the D1 child should `↑z015` (or `↑z028` with `~z015`). Defer until 007 is acted on.

---

## 2026-04-27-016 — Friction captured: distillation passes need a "fixture vs corpus" distinction at the tool layer

**Issue.** Most of the mechanical findings here (001/002/003/005) are downstream of one root cause: `dx zettel add` was used as a CLI test driver, writing test fixtures into the production corpus. The distillation loop has no way to mark "this isn't a real zettel" without violating principle 02 (no delete) or inventing a `kind:` field.

**Where.** Tool-layer (`tools/dx/src/zettel/`), surfaced by this pass.

**Proposed fix.** Already captured as finding 001. Logged again here as *friction* (z009) to feed the loop: a future organizing pass should not have to distinguish fixtures from real zettels by reading their bodies.

---

## 2026-04-27-017 — Friction captured: I (the distiller) wanted to renumber-and-merge but couldn't

**Issue.** Several Tier 1 fixes I'd normally apply (canonicalize z046's `↑22` → `↑z022`, drop z044's duplicate `~z022`, give z041 a parent) became Tier 2 because the zettels are *test fixtures whose body documents the very form the fix would erase*. Touching them would be vandalism of the test, not improvement of the zettel. The distillation loop has no formal handle for "looks fixable, isn't."

**Where.** This pass.

**Proposed fix.** Eaten — logged finding 016 covers the root cause. This entry exists so the loop's notion of "Tier 1 mechanical" is on record as *not* including "edit the body the front-matter is testing."

---

## 2026-04-27-018 — Several real zettels are missing placement (↑) — not just fixtures

**Issue.** Beyond the test fixtures (z041, z042, z049, z051, z052, z054), real-content zettels also have no placement parent:
- z018 (investigate-then-ask-narrowly) — only `~`s.
- z036 (be-laconic) — only `~`s.
- z050 (slice-2 schema deviations) — only `~`s.
- z053 (slice-2 embedding-model dilemma) — only `~`s.
- z055, z056, z057 (auto-pop friction trio) — empty `threads: []`.

z040 says every wire is local, every cluster is observed — but a zettel with no `↑` doesn't sit anywhere; it floats. The recursive-walk reachability from any seed depends on inbound placement edges existing somewhere; pure-`~`-graph zettels are reachable only by name-luck.

**Where.** z018, z036, z050, z053, z055, z056, z057.

**Proposed fix (Tier 2, per-zettel call).**
- z018 → `↑z014` (semantic-vs-how — the click-vs-report split is the same axis).
- z036 → `↑z027` (unlimited-resources — be-laconic is the discipline that pairs with the budget).
- z050, z053 → `↑z034` (slice-1 markdown decision; slice-2 is downstream of it).
- z055, z056, z057 → `↑z028` (zettel-app foundational decisions) or a slice-3 hub zettel that doesn't yet exist (z040 — write the hub when the cluster has earned it; this trio + AUTO-POP-DESIGN.md already qualifies).

---

## 2026-04-27-019 — Findings 002 and 003 are already captured as their own zettels (z060–z063)

**Issue.** After writing this log I noticed `z060-friction-short-id-forms-not-normalized-in-stored-threads.md`, `z061-friction-placement-passed-twice-silently-picks-last.md`, `z062-friction-placement-thread-to-same-target-produces-duplicate-edge.md`, `z063-friction-thread-accepts-arbitrary-file-paths-and-unknown-labels.md`, etc. The CLI-friction findings I logged as Tier 2 (002, 003) were *already* zettel-ized as z060/z062. My findings duplicate captured work.

**Where.** Findings 002 + 003 of this log; z060, z061, z062, z063, z064, z065, z067, z069 in the corpus.

**Proposed fix.** No fix on the corpus side — those friction zettels are the right shape. *On the loop side*: a future organizing pass should `dx zettel list` *all* zettels first (currently the corpus is 70 files, not the ~40 the pass was scoped to) and grep for "FRICTION:" prefixes before duplicating findings. Logging here as a process-loop friction so it doesn't recur.

---

## 2026-04-27-020 — Corpus is 70 zettels, not 40 — pass scope was incorrect

**Issue.** This pass was scoped to "about 40 zettels" but the corpus contains 70 (z001–z070). z048–z069 were authored in parallel during slice-2/slice-3 design and friction-capture and were not in the initial reading set. Findings 001–017 are based on the z001–z047 subset; some may be partly invalidated by the z048+ content (specifically: 002/003 — see 019).

**Where.** This pass.

**Proposed fix.** Re-scan z048–z070 in the next pass. Notable observations from a quick second-pass scan that are NOT yet logged here:
- The friction-zettel pattern (z058–z069 inclusive) is its own emergent cluster — z040 says write the hub when a cluster earns the name. **Candidate hub zettel: "FRICTION: as a recognized zettel kind — capture pattern for in-flight tool defects"** placed under z009.
- z048 ("DX detects DX") and z066 ("save-to-effi is one-off-shaped") are themselves candidate hubs; both reach for principle-01 placement and could earn a meta-cluster about *DX-as-detector*.

---

## Summary

- **Tier 1 (mechanical) findings applied:** 0. Three looked Tier 1 (002, 003, 005) but became Tier 2 once the test-fixture origin was visible (finding 016 + 017). Two (002, 003) turned out to be already-captured (finding 019).
- **Tier 2 (semantic) findings logged:** 18 total. Of those: 7 splits/re-placements (006, 007, 008, 009, 015, 018), 2 contradictions/clarifications (010, 014), 4 fixture cleanup (001, 002, 003, 005), 3 log-only / no fix (011, 012, 013), 2 process-loop notes (019, 020).
- **Friction zettels surfaced (this pass):** 016, 017 logged inline; one new zettel emitted via `dx zettel add` — z070 (distillation Tier-1 fixes can't touch test-fixture bodies).

Next pass should pick up after Lihu reviews 001 (fixture handling at the tool layer) and 010 (the z023↔z029 contradiction) — those unblock the largest cluster of follow-on work. And it should re-scope to the full 70-zettel corpus per finding 020.
