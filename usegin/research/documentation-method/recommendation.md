# Recommendation — shape for Gin-internal-but-cross-session documentation

In z026 dilemma form. Findings backing this are in `findings.md`.

---

**Decision needed:** What's the shape for Gin-internal cross-session
documentation — the layer above zettels (atomic, methodological) and
below Linear (shipping work)?

**Options:**

- **A. Promote the skill-lab `purpose.md` + `retro-guide.md` pattern
  out of `.claude/skill-lab/` into a sub-app at `gin/lab/<topic>/`** —
  any Gin-internal initiative (a sub-app being built, a convention
  being trialed, a workflow being prototyped) gets a folder with the
  same trio: `purpose.md` (intent + empirical anchors + success
  signals + known limits + ideas + changelog), `retro-guide.md` (how
  to grade a session that touched it), and a thin operational doc
  pointing into the codebase. Re-uses the *single most-evolved doc
  form we have* (Tier 1 in findings.md), generalised beyond skills.

- **B. Make `gin/zettel/RD/<topic>/whiteboard.md` the canonical form
  for everything bigger than a zettel** — keep using the R&D-whiteboard
  shape (the 8 we already have) for any cross-cutting Gin work, with
  the explicit pattern that the *cross-cutting synthesis* lives as a
  comment on a Linear umbrella issue (the ENG-5379 model).

- **C. Build a new `gin/log/` sub-app** — append-mostly per-session
  log entries (`gin/log/2026-04-27-documentation-method.md`) that
  capture decisions + rationale + link-out. Zettels for the
  distillations, log entries for the trail.

**Gin's lean: A.**

**Why:**
- Skill-lab is the only Tier-1 doc form in `findings.md` that is
  *deliberately living*: it has a structural seat for "Known
  Limitations" and "Changelog", a sister `retro-guide` to grade
  sessions against the doc, and a citation discipline (every claim
  hangs off an ENG-NNNN, session id, or memory-entry name) that the
  team has already proved it can sustain on `tdd-execute`,
  `worker-reviewer`, `liaison`, `implementing-specs` etc.
- Generalising it from "per skill" to "per Gin-internal initiative"
  is a small move — the sub-folder structure stays, the trio stays,
  only the *parent path* moves from `.claude/skill-lab/` to
  `gin/lab/`. That fits z021 (Gin is the umbrella) without needing
  any new convention.
- It clears all five "Tier 1" properties from findings.md:
  auto-loadable (when Lihu/Gin opens the sub-app, the `purpose.md`
  is the orientation doc per z010), atomic + named-as-claim
  (per-topic folder), frontmatter-traversable (skill-lab purpose.md
  already uses headed sections that are mechanically scrapable),
  append-mostly + explicit supersede (the Changelog table is exactly
  this), two-faced when needed (purpose.md is Gin-facing, retro-guide
  is human-facing — the natural split).
- Cross-cuts cleanly with what we already have: zettels stay atomic
  (one thought, two sides), `gin/lab/<topic>/` is the *workshop* for
  ideas that take more than one zettel to develop, Linear stays for
  shipping. Three layers, clear addressing.

**Price:**
- New top-level folder `gin/lab/`. One more place to navigate (z001
  cost — fewer concepts is better).
- Generalising "skill-lab" semantics may dilute the original meaning
  (skill-lab was specifically *about* skills — purpose, success
  signals, retro-guide all assume "session ran the skill"). Some
  topics in `gin/lab/` won't have sessions in that sense, so the
  retro-guide column may stay empty for them.
- Open-to-empty (z003) handles this — a `gin/lab/<topic>/` can ship
  with `retro-guide.md` empty until the topic accumulates sessions
  worth grading. But it does mean the trio looks asymmetric for
  pure-design topics.

**Risk:**
- The skill-lab pattern *succeeds because skills are auto-triggered*.
  Pulling it out of `.claude/skills/` removes the auto-load lever — a
  `gin/lab/<topic>/purpose.md` only gets read when someone navigates
  there. Mitigation: make the sub-app's READMEs (per z010) point into
  `gin/lab/`, so any Gin orienting in the parent sub-app finds the
  lab folder by routine. Also: if a `gin/lab/<topic>/` matures into a
  triggerable workflow, *promote* it into `.claude/skills/` — that's
  the natural graduation path and we already do it for skills under
  R&D.
- We commit to a third name (`gin/zettel/`, `gin/consultant/`,
  `gin/lab/`). Per z021 the umbrella is supposed to absorb sub-apps
  cleanly; one more sub-app is cheap, but the *meta-rule* — "if
  unsure where it goes, here's the sub-app for that" — needs to be
  stated explicitly in `gin/README.md` or it will erode.

**For you to weigh:**

1. **UX for capturing a thought mid-session.** Zettels are ~30s
   capture (one file, append). A `gin/lab/<topic>/` is heavier — you
   must decide it's worth a *folder*, not just a zettel. The boundary
   is: *one thought = zettel; multiple threaded artifacts on one topic
   = lab folder.* You'll feel whether that boundary is crisp enough
   to not stall capture. (B and C are cheaper at capture time —
   B reuses an existing folder, C is one append per day.)

2. **Cross-team coordination.** Right now Lihu is the only zettel
   author. When Oria and Nitsan join, do they navigate to
   `gin/lab/<topic>/` to find current state of a Gin-internal effort?
   `gin/lab/` is more discoverable than zettel front-matter
   threading, but discoverability stops mattering if nobody has the
   habit of opening it. Worth weighing: do they prefer the `gin/lab/`
   browse-to-find model, or the Linear-comment model (option B's
   syndication path), or a daily-log skim (option C)?

3. **Scope drift into "everything-bin".** The biggest risk in
   findings.md is `docs/` — 60/85 files stale because every "I should
   write this down" thought went into `docs/<feature>.spec.md`. If
   `gin/lab/` becomes the new `docs/`, we've moved the graveyard, not
   solved it. The skill-lab discipline (mandatory Changelog,
   explicit Known Limitations, anchored citations) is what kept it
   alive — that discipline must be *required by the README* in
   `gin/lab/`, not aspirational.

4. **Longevity vs the system you're already building.** ENG-5381's
   Postgres+pgvector zettel substrate is the next big build. If
   zettels become *queryable* in 1–2 months, the case for a separate
   `gin/lab/` weakens — you might just want richer multi-zettel
   topics (a "z-cluster") rather than a sibling folder. **You may
   want to defer this decision** until ENG-5381 dry-runs are far
   enough along to know if zettels-as-graph absorbs the use case.

---

## What "going with A" looks like, concretely

(Included for size-checking the lean. Cut if you adopt B or C.)

- New folder: `gin/lab/`. Sibling to `gin/zettel/`, `gin/consultant/`,
  `gin/research/`.
- One `gin/lab/README.md` stating: *"Cross-session Gin-internal work
  that's bigger than a zettel and not a research charter. One folder
  per topic. Each folder has `purpose.md` (intent + anchors + signals
  + limits + changelog) and optionally `retro-guide.md` (how to grade
  a session that touched it). When a topic matures into a triggerable
  workflow, promote it into `.claude/skills/`."*
- First seed: this very research moves from
  `gin/research/documentation-method/` into
  `gin/lab/documentation-method/` once the dilemma is resolved — and
  the resolution is the first Changelog row.
- `things-we-grow.md` gets a row.
- One zettel — `z028-gin-lab-as-workshop` or similar — to record the
  decision shape (per z020).

---

## What I deliberately did not include

Per z026 — no implementation-detail trade-offs (folder names,
markdown templates, ESLint rules), no menu-without-recommendation,
no hedging ("could", "might", "depends"). The four "for you to weigh"
items are the only manager-only decisions; everything else is Gin's
to figure out once you pick A vs B vs C.
