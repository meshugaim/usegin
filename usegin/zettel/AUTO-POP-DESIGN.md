# Auto-pop — design for "pull a wire, find the rope" mid-session

**Status.** Design only. Aspiration goal — *not* slice 3's scope, written so slice 2's retrieval API is sized to support this.

**Frame.** UseGin notices the human (or itself) is touching a clustered area, and the cluster *pops* into context — unsolicited, without a query. This is the consume side of the substrate. The Zettelkasten Professor calls it the cure for box-as-archive. The Psychologist calls it cued retrieval via spreading activation under encoding-specificity. The Deep-Graph Professor gave us the SQL for it. This doc decides *when*, *how*, and *to whom* the pop happens.

Read alongside: `principles/01..04`, `RD/zettelkasten-professor/whiteboard.md` §1.1/§1.6/§2.4, `RD/psychologist/whiteboard.md` items 2/5/7, `RD/deep-graph-professor/whiteboard.md` §2 + `notes/why-spreading-activation.md`. Touchpoints into existing zettels: z003 (open-to-empty), z022 (two faces), z025 (consultant in scope), z028 (one shared brain), z034 (slice-1 markdown substrate), z036 (laconic), z038 (concurrency), z040 (clusters emerge).

---

## 1. The trigger — when does auto-pop fire?

### Options

- **A — `UserPromptSubmit`.** The human just submitted a turn. Hook reads the prompt text, derives seeds, queries the substrate, injects matches. One pop per human turn.
- **B — `PreToolUse` on `Read` / `Edit` / `Write` / `Grep`.** UseGin is about to touch a file or symbol. Hook reads the tool input (path / pattern), derives seeds from it, injects matches. Many pops per turn possible.
- **C — Background watcher.** A long-running process tails session JSONLs (or `dx his`), debounces, and emits pops via `system-reminder` when it sees a clustered touch-point. Pop is async to the action.
- **D — Hybrid: `UserPromptSubmit` + sparse `PreToolUse`.** Always pop on prompt submit (human gave us a fresh cue). Additionally pop on `PreToolUse` only when the tool input introduces a *new* touch-point not already covered by this turn's earlier pops (per-turn dedup).

### UseGin's lean: D — hybrid, prompt-primary, tool-secondary.

Reasoning:
- **Prompt submit is the cleanest cue surface.** The human just spoke; their words contain intent (z028 "one shared brain" — no privacy walls to navigate). Encoding-specificity (Psychologist #2) says cues that overlap encoding context win — prompt text is rich in *people, file names, error fragments, concept words*, all of which were probably present when the relevant zettels were written. It also fires once, deterministically, per human turn — easy to reason about budget.
- **Pure prompt-submit misses the long autonomous stretch.** A turn that spans 30 tool calls into a new subsystem won't see any pops between submit and the next human turn. That's exactly the "we touched the cluster, didn't surface it" miss. Hence the secondary tool trigger.
- **PreToolUse-only would be too noisy.** Every Read fires a query, every grep fires a query — even when the human's prompt already pinned the topic and the relevant cluster already popped. The hybrid's per-turn dedup (track which seed-keys we've already popped this turn, suppress repeats) keeps this tractable.
- **Background watcher is operationally heavy** for slice 3, defers cleanly to "later if hybrid proves insufficient."

Reject A alone: misses autonomous stretches.
Reject B alone: too noisy, wrong cost shape (every Read pays a query).
Reject C alone: process-management cost too high for first ship.

**Slice-2 API implication.** The retrieval endpoint must accept *either* a free-text blob (prompt) *or* a structured touch-point (file path, symbol, error string) and return a ranked list — same query backend, two callers.

---

## 2. The signal injection — how do popped zettels reach Claude?

### Options

- **a — `<system-reminder>` injection** via hook stdout (precedent: `director-auto-inject.ts` returns `hookSpecificOutput.additionalContext`). Claude sees it inline, treats it as a system note.
- **b — Inline tool-output decoration.** The hook prepends popped-zettel text to the actual tool result (so a `Read` returns the file *plus* "by the way, these zettels are clustered here").
- **c — Dedicated slot in CLAUDE.md.** A managed section the hook rewrites between turns; Claude re-reads CLAUDE.md and sees it.
- **d — Separate file Claude must read.** Hook writes `usegin/zettel/.surfaced` and Claude is told (in a stable instruction) to read it when working in a clustered area.

### UseGin's lean: a — `<system-reminder>` injection.

Reasoning:
- **Precedent works.** `director-auto-inject.ts` is doing exactly this shape — `additionalContext` on `PreToolUse`, output as a system message. The reminder format Claude already takes seriously (the harness wraps it, the model treats it as authoritative-but-not-user). Pop fits cleanly.
- **It's transient.** A pop is encoding-cued retrieval (Psychologist #2): it should be *present* at the moment relevant to it and *not persist* into unrelated context. CLAUDE.md slot (c) violates this — it stays after the cue is gone. Inline decoration of tool output (b) couples pop to a specific tool call and contaminates the tool's normal contract. Separate-file (d) requires Claude to remember to read it — high friction, brittle.
- **It composes with the trigger.** `UserPromptSubmit` and `PreToolUse` both already accept `additionalContext` outputs from hooks. One injection mechanism, two firing points.
- **Two-faces (z022) story is clean** — see §5.

**Slice-2 API implication.** The retrieval endpoint should return zettel results in a shape that's cheap to render into a `<system-reminder>` block (id, title-as-claim, 1–3 line excerpt, optional reason-for-surfacing). Don't make the caller fetch full bodies just to render the pop.

**Format sketch (UseGin-side rendering):**

```
<system-reminder source="auto-pop">
You're touching an area where these zettels exist:

  z038 — Concurrent dx-zettel-add race observed in the wild
    (cued by: "dx zettel add" in your prompt; activation 0.84)

  z034 — Slice 1 of dx zettel = markdown + git; defer Supabase to slice 2
    (cued by: thread from z038; activation 0.50)

  z028 — Zettel sub-app foundational decisions
    (cued by: thread from z034; activation 0.30)

Pull any: `dx zettel show <id>`. If a popped zettel is wrong/stale,
that's a distillation cue (z039), not a system bug.
</system-reminder>
```

The footer is intentional — it both invites the testing-effect re-encounter (Psychologist #7: "does it still hold?") and tells Claude what to do if a pop is bad (write a zettel, don't open a ticket).

---

## 3. The query — given a touch-point, which zettels are clustered here?

The Deep-Graph Professor's spreading-activation query (`RD/deep-graph-professor/whiteboard.md` §2.3) is the mechanism. Restated for slice 3's needs:

### Inputs the API must accept

1. **Free-text seed** — the prompt body, or a tool's payload (file body, error string). Used to compute a query embedding.
2. **Structured seed list** — explicit zettel ids the caller already knows are relevant (e.g., zettels linked from the file Claude is reading). Used as known starting nodes.
3. **Context bag** — file path(s) being touched, current session id, current author, current topic if known. Used to bias edge-weight selection (e.g., `co_occurred_with` weighted higher for zettels from the same session; `about_artifact` for zettels mentioning the touched file).

### What the query does (the recipe)

1. **Seed.** Top-k vector-similarity matches against the free-text seed, plus any structured-seed ids passed in. (Per `notes/why-spreading-activation.md`: vector ranks the seed, walk does the magic.)
2. **Walk.** Recursive CTE over `zettel_edge`, hop limit 3, decayed by 0.6 per hop, weights respect edge kind. Use the kinds enumerated in deep-graph §2: `links_to`, `thread_continues`, `thread_branches`, `supersedes`, `contradicts`, `tagged`, `similar_to`, `co_occurred_with`. Empty zettels (z003) participate in the walk even with no embedding — they're reachable through threads, that's the whole point of open-to-empty.
3. **Score.** Aggregate activation per zettel (max across paths). Demote `retired` (don't drop — principle 02). Demote zettels that have been *already popped this session* (anti-spam, see §4 threshold). Promote frustration-clustering signals (principle 04) — when ≥3 frustration zettels share a hub, the hub itself surfaces with a "you may be fighting this area" tag.
4. **Return.** Top-N (N small — see §4) with: id, claim-title, 1–3 line excerpt, the *reason chain* ("matched seed via similar_to → reached via thread from z038"). The reason chain is what makes the pop legible; without it, Claude gets cards with no provenance and the pop feels like noise.

### What slice 2 must build to make this possible

- Materialized `similar_to` edges (so the recursive walk never makes an ANN call inside itself).
- An RPC like `zettel_recall(query_text text, seeds uuid[], context jsonb, limit int)` returning the result shape above.
- Edge-weight tunables held in one place (so slice 3 can sweep the decay factor without a migration).
- A `pop_log` table (or similar) so we know what was already popped this session — fuels the dedup in §1 and the threshold in §4. Cheap to add now; expensive to retrofit.

### Out of scope for this design

- The exact embedding model.
- Tuned weights / decay numbers.
- Pop performance budgets.

---

## 4. The threshold — when do we surface vs stay silent?

**Bring as a z026 dilemma.** The threshold IS the design decision that determines whether auto-pop is loved or muted.

> **Decision needed:** What's the surfacing threshold for auto-pop — how aggressive should it be?
>
> **Options:**
> - **A. Always-pop.** Every prompt submit returns top-N regardless of activation score. Predictable, generous, noisy. Cluster-dense areas drown signal in volume.
> - **B. Activation-floor.** Only pop when the top result's activation > θ. Below θ, stay silent. θ is a tunable. Quiet by default, loud when the cluster is real.
> - **C. Adaptive — no-pop unless cluster is dense.** Surface only when ≥k zettels exceed θ — i.e., a *cluster* exists, not just one nearby zettel. (z040: clusters emerge from threading; this surfaces emergence, not individuals.)
> - **D. Calibrated by recent dismissal.** If the human or Claude has dismissed (or ignored) recent pops in this area, raise the floor for that area. Reinforcement-by-engagement. Highest sophistication, hardest to reason about.
>
> **UseGin's lean: C — adaptive cluster threshold.**
>
> **Why.** The whole framing is "pull a wire, find the *rope*" — the unit of value is the rope (cluster), not the wire (single zettel). z040 ratifies this: clusters emerge from threading. If we pop on a single near-match, we're surfacing a wire, not a rope — that's just search-without-the-search-bar, which is what every dead PKM tool already shipped. Single-zettel matches are better served by the human running `dx zettel show` when curious. Auto-pop earns its keep when it surfaces *the trail*: 3-5 zettels that together tell a story (frustration → diagnosis → fix → revert → resolution, per Zettelkasten §2.4). Below cluster density, silence is the right answer — silence preserves presence (Psychologist #10) and avoids the "another to-do list" failure mode.
>
> **Price.** New, sparse areas of the graph never auto-pop because they don't yet have density. Mitigation: (a) early use leans on `dx zettel show` and grep — that's already shipped; (b) when `co_occurred_with` weights cluster a recent session's zettels together, density forms quickly even for new areas.
>
> **Risk.** Threshold tuned wrong = either still noisy (cluster small enough to be everywhere) or always silent (cluster too rare). Mitigation: log every pop *and* every would-have-popped-but-below-threshold to `pop_log`; review weekly for a few weeks; adjust θ and k from data, not from gut.
>
> **For you to weigh:**
> - **Pop ergonomics for *humans*.** This design assumes pops appear in chat / status line / both. If pops are too frequent, presence (Psychologist #10) suffers — that's a direct hit on principle 01 (intuitive workflows). You're the one who'll feel that first; the tunable matters more to you than to me.
> - **Anti-fighting interaction.** A frustration cluster (principle 04) is *exactly* the case where we want a pop even if it's the only one nearby — "you wrote 4 frustrations against this area." Carve-out: density rule *or* frustration-cluster signal triggers pop. Confirm that carve-out is wanted.
> - **Cross-author dynamics (z028).** A pop authored by another team member (or by Consultant per z025) lands in your context unsolicited. That's by design — shared brain — but you may want a "show me only Lihu-authored" mute toggle for some windows. Decision: ship without per-author mute; revisit if it bites.

---

## 5. Two-faces (z022) — human-readable too, or Claude-only?

**Auto-pop has two faces. Both are needed. They differ in form, not content.**

### UseGin-facing

The `<system-reminder>` from §2 — id, claim-title, excerpt, activation, reason chain, footer instruction. UseGin reads this and either invokes a zettel via `dx zettel show`, threads a new zettel against it (the distillation step from Zettelkasten §2.3), or notes it as already-known and continues. The format optimizes for *Claude legibility under context-pressure* (laconic per z036 — claim, why-it-popped, what-to-do-next).

### Human-facing

The same pop, surfaced to Lihu in two complementary places:

1. **Status line.** A compact form — `pop: z038, z034, z028 (cluster: dx-zettel slice rollout)` — visible without taking attention. Confirms to Lihu that the brain is working without forcing a context shift.
2. **Chat-side notice** (only when the human's *current prompt* triggered the pop). Below the agent's reply, an unobtrusive line — `(usegin auto-popped: z038, z034 from cluster around "dx zettel add")`. Lihu can grep his own conversation later by "auto-popped" to find re-encounters.

The status line and chat-notice cite *the same ids* the system-reminder cited. This means: when Lihu and Claude debrief, they're talking about the same set of pops. Common ground (Psychologist #9, distributed cognition) is preserved by construction.

### When to suppress the human face

- Status-line update only changes when the popped *set* changes (no churn-per-tool-use).
- Chat-side notice only on prompt-triggered pops, not tool-triggered. Tool-triggered pops are mid-turn UseGin business — surfacing them in chat would feel like noise to Lihu and make every long autonomous turn end with a wall of "popped 14 zettels."

This is z022's "when suitable" applied: both consume the artifact (Lihu uses pops to feel the brain working; UseGin uses pops to actually retrieve), but they have different needs (Lihu wants reassurance + searchability; UseGin wants actionable context). One face would shortchange one consumer.

---

## 6. Out of scope (this design pass)

Stated for the orchestrator: this doc decides *when*, *how the signal travels*, *what shape the query takes*, *the threshold framing*, *the two-faces split*. It explicitly does not decide:

- The hook implementations (which file, which language, which exact stdin/stdout shape).
- The SQL of the actual queries (the deep-graph professor wrote the recipe; slice 2 turns it into RPC).
- Performance budgets (p95 latency, query cost ceilings).
- How `pop_log` is structured — only that it's needed.
- The exact embedding model / dimensions (out of scope for the whole substrate per deep-graph §3.7).
- The status-line implementation and its rendering rules (the existing `statusline.ts` is the integration point; this design doesn't prescribe how).

These are slice-3 implementation work, *informed by* this design but not bound by it.

---

## 7. Summary — what slice 2 must therefore expose

So slice 2 sizes its retrieval API correctly, the things slice 3 will need:

1. **`zettel_recall(query_text, seeds, context, limit)`** — returns ranked results with id, claim-title, excerpt, activation, reason chain.
2. **Materialized `similar_to` edges** so the walk is pure graph traversal.
3. **`co_occurred_with` populated at write-time** (same session id → mutual edges) — fuels the cluster-density rule in §4 and the frustration-detection carve-out.
4. **`pop_log` table** — what was popped, when, to whom, at what activation, with what seed. Required for §1 dedup, §4 threshold tuning, and human-side searchability.
5. **The query must be cheap enough to run on every `UserPromptSubmit`** (Claude latency budget, not zettel-system budget — humans wait).
6. **Edge weights and decay live in one place** so slice 3 can tune without a migration.

If slice 2 ships those, slice 3 is "wire the hooks, render the two faces, log everything, tune θ and k from `pop_log`."

---

## Surfaced dilemmas (for the orchestrator)

- **§4 threshold dilemma** — z026-shaped, lean = C (cluster-density), with a frustration-cluster carve-out and a manager-side ergonomics question Lihu has to weigh.

The other three §s (trigger, injection, query) carry leans confident enough to ship as design — they're not dilemmas, they're decisions documented in z020 shape implicitly.
