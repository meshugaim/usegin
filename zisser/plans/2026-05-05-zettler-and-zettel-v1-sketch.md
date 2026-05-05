---
plan: zettler-and-zettel-v1-sketch
authored-by: zisser
created: 2026-05-05
inputs:
  - usegin/zettel/zettler/findings/2026-05-05-v0-pass.md (Zettler V0 report)
  - experiments/poc-knowledge-store/VERDICT.md (substrate decision pending)
  - usegin/zettel/SLICE-2.md, EFFI-SYNC-DESIGN.md, AUTO-POP-DESIGN.md (paper)
  - z040, z069, z065, z053, z109 (load-bearing zettels)
status: sketch — for Lihu reaction, not a charter
---

# V1 sketch — Zettler agent + Zettel sub-app

Two paired artifacts. Zettler V1 (the reader) and Zettel V1 (the
substrate). They co-evolve because Zettler can only deliver what the
substrate exposes.

## Click

V0 produced **value evidence**. V1 should produce **consumption surface**.
The corpus has 114 atomic notes, 9 fixed friction points, ~17 open ones,
and *zero* recall infrastructure. Without a way to *pull a wire*, the
producing-side investment compounds at zero. V1 closes that loop.

Two calls Lihu owns before V1 charters land:

- **Substrate** — markdown-on-disk-only forever, OR plug into the
  poc-knowledge-store's LanceDB index? Decision A unblocks Zettler V1's
  semantic-recall capability; decision B keeps zero-infra simplicity.
  Lean: A (the poc just proved the substrate; zettels are already
  markdown-on-disk; one-step move; LanceDB index is derived/disposable
  per VERDICT §reproduction).
- **Slice 2 (Supabase + pgvector)** — paused or unowned? z053's
  embedding dilemma still open. Lean: **abandon** in favor of the
  LanceDB-substrate path above; close SLICE-2.md with a dated
  superseded-by pointer (z039 forward-only).

## Zettler V1 — the reader

V0 = one-shot full-corpus pass that produced a report.
V1 = **on-demand topical reader** the team and other agents can call
during work, plus an **emergent-cluster watcher** that surfaces hubs
without being asked.

### Three modes

| Mode | Trigger | Output |
|---|---|---|
| `zettler ask "<topic>"` | Human or agent asks a question over the corpus | ≤300-word answer with id-cited claims; lists the 3-5 most-relevant zettels with one-line clicks each |
| `zettler hubs` | Periodic / on-demand | Today's top 10 inbound-density nodes; flags new hubs vs last run; names emergent clusters per z040 |
| `zettler watch <topic>` | Set-and-forget; fires on capture | When a new zettel touching `<topic>` lands, surface the cluster it just joined with one-line click |

All read-only. No capture. No distillation (humans + UseGin keep that
loop per organizing-process.md).

### Why this shape

- Solves z069 (inbound invisible) and z065 (no search) at the
  consumption layer — the substrate fixes are still cheap stopgaps
  worth shipping in parallel (`dx zettel search`, `dx zettel show
  --inbound`), but V1 Zettler reaches past those into *synthesis* —
  he doesn't just find files, he composes the click across them.
- Honors z040 (clusters emerge): `zettler hubs` *observes* density,
  never imposes categories.
- Honors z110 (Gin owns *how*, human owns *what*): Zettler answers
  "what does the corpus say about X" without reaching past his slot
  into "should we do X."

### What V1 does NOT do

- No writes. Still read-only.
- No proactive interrupts. Pull-on-demand or set-and-forget — never
  unsolicited push (z103).
- No claims past the corpus. If the corpus is silent on something,
  Zettler says "silent" — no confabulation.

### Soul

`usegin/zettel/zettler/zettler.md` bumps to v1 (z039 — append, don't
edit; new file `zettler-v1.md` with `supersedes: zettler.md`).

## Zettel sub-app V1 — the substrate

Three deliverables, ordered by leverage. Each is an independent dispatch.

### 1. Cheap stopgaps — same week, ~50 LoC

Wes-shaped, parallel-safe (different files):

- `dx zettel search "<query>"` — literal-substring + simple ranking
  over title+body. ~10 LoC. Closes z065. Zettler V1 `ask` builds on
  this.
- `dx zettel show <id> --inbound` — `grep -l zNNN` pass, list ids that
  thread back. ~5 LoC. Closes z069.
- `dx zettel add` flock — file-lock on id-allocator. ~15 LoC. Closes
  z038/z073/z082-missing.
- `dx zettel add --no-title` — accept body-only capture, derive a
  title slug. ~10 LoC. Closes z072 (the most-friction friction).
- Resolve the 4 open `gaps.md` entries with dated resolution
  paragraphs. Two-faced (z022) where suitable.

Total: one Wes, one commit-cluster, one push.

### 2. Semantic retrieval — plug into LanceDB substrate

Substrate decision A goes here.

- One ingestor: walk `usegin/zettel/zettels/*.md`, write to the
  poc-knowledge-store store layer with `kind=zettel` and frontmatter
  carried into kind_meta.
- Index rebuild on commit (post-commit hook? dx subcommand?
  CI? — Lihu's call).
- `dx zettel search` upgrades from substring to hybrid (vector + FTS
  + RRF fusion) — same call signature, better recall.
- Zettler V1 `ask` becomes possible (calls the same retrieval layer
  the chat surface in poc-knowledge-store proved out).

Cost: bounded by the LanceDB-on-Bun stack already proven (`bunfig.toml`
hoisted, etc.). Bounded by the embedding decision (z053): pick
text-embedding-3-small or a local FastEmbed; the PoC ran on a mock
embedder and still demonstrated the pattern.

### 3. Auto-pop — when V1 retrieval is alive

`AUTO-POP-DESIGN.md` is good paper; flesh it out only after #1+#2 land.
The pop-log + reason-chain (z055/z056) is what makes pops auditable
rather than magic. Frustration-cluster carve-out (z057) is the
density-floor override.

Out of scope for V1. Stage as V1.5.

## What V1 explicitly is NOT

- **Not Effi-sync.** EFFI-SYNC-DESIGN.md ships the corpus to Effi's
  canon; that's a separate consumer of the substrate, not a V1
  blocker. Defer until V1 retrieval is alive and the team wants
  Effi-mediated zettel queries.
- **Not Supabase + pgvector.** Slice 2 paper is superseded by the
  LanceDB-substrate path *if* Lihu confirms substrate decision A.
- **Not multi-tenant / RLS.** z028 still holds: one shared brain.
- **Not a UI.** CLI + agent surface. Browser comes later, or never.

## Honest residual

- LanceDB-on-Bun runs (PoC proved it) but is unproven at our actual
  capture rate. 114 zettels indexes in milliseconds; 10⁴ in seconds;
  10⁵ unknown. We're nowhere near that yet.
- The `type` field stays dead weight unless V1 gives it a retrieval
  job (e.g. `dx zettel search --type=feedback`). Worth a one-zettel
  decision.
- z107 vs CLAUDE.md "default don't act" — V1 Zettler is read-only
  AND pull-on-demand, so this dialectic doesn't bite him. But it
  bites every other Gin and is worth a separate Lihu decision.
- May 1–5 capture silence is unexplained. If the producing side is
  choking, V1 retrieval matters less. Worth a probe (Zettler
  proposed a Wes-shaped agent-records grep for `dx zettel`
  invocations vs missed-capture moments).

## Decision shape (z020)

**Decided:** Zettler V1 = on-demand topical reader + hub watcher.
Zettel V1 = stopgaps + LanceDB-substrate retrieval.

**Because:** the producing side is mature; the consuming side is the
load-bearing gap; the LanceDB substrate just proved out one room over;
the cheap stopgaps unblock both Zettler V1 and dogfood-friendly
capture.

**Price:** ~1 Wes for stopgaps; ~1 Wes-or-rnd for the LanceDB
ingestor; one Lihu decision on the substrate question; one Lihu
decision on slice 2 abandonment.

**Risk:** LanceDB substrate is still PoC-grade (verdict=Iterate, not
Adopt). If iteration reveals a blocker, V1 falls back to substring
search and Zettler V1 `ask` degrades to extractive citation.

**Alternatives rejected:**
- Slice 2 (Supabase + pgvector) — heavier stand-up, second store,
  loses the "index is derived" win the PoC just argued for.
- Skip Zettler V1, ship only substrate — leaves Lihu with `dx zettel
  search` but nothing that *synthesizes* across hits. The
  consumption gap is about composition, not lookup.
- Wait until corpus reaches 200+ — it has stopped accruing for 5
  days; waiting risks atrophy. Build the consumption surface now
  to re-incentivize capture.

## Next moves (Zisser, after Lihu reacts)

If Lihu confirms direction:

1. Charter Wes — stopgap pack (~50 LoC) → `zisser/dispatched/`
2. Charter Wes-or-rnd — LanceDB ingestor + retrieval upgrade → `zisser/dispatched/`
3. Bump `zettler.md` → `zettler-v1.md` with `supersedes:` (z039)
4. Close SLICE-2.md with dated `superseded-by:` pointer (if substrate decision A wins)
5. Open one zettel: "Zettel V1 plan landed; substrate = LanceDB; consumption-side = Zettler V1"
