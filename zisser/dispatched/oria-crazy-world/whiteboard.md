# Oria's Crazy World — build whiteboard

**Director:** Zisser
**Started:** 2026-04-28
**Charter:** Extract oria's crazy world out of `usegin/`, deploy as standalone repo `AskEffi/oria-crazy-world`, divide into three zones (ground/sky/space), populate with five dual-faced institutions (academy, gymnastic, university, visitor-center, app-factory). Self-spawn physics expansion + anthropology department. Pilot the app-factory with a Gemini voice-to-voice translator. **Process is the artifact; outcomes are byproduct.**

## Posture

- Laconic — least required, not less, not more.
- No constraints — endless time, endless resources, all the world from ground to space.
- Process matters — many teams, many steps, but each team's charter is tight.
- World holds the answers — if a question comes up, route it to a team (philosophers, university, visitor-center). Don't escalate to Oria.
- Two-faced everywhere — every institution has `human/` and `agent/`. Each side reads the other.
- Append-mostly — never delete a placement; supersede.

## The five institutions (dual-faced)

| Institution | Charter | Zone home |
|---|---|---|
| **academy** | teach agents/new dreamers the canon | ground |
| **gymnastic** | train them — drills, sparring, eval corpora | sky |
| **university** | research, distill, expand the latent world | sky |
| **visitor-center** | teach newcomers (human or agent) how to dream | ground |
| **app-factory** | dream → spec → design → build → QA → ship, a-z | space |

## The three zones

- **ground** — substrate. Personas, principles, philosophy, norms, culture, things-we-grow, academy, visitor-center, team definitions. Walked daily.
- **sky** — in-flux. Gymnastic, university research, drafts, persona-lab, team-lab, half-baked ideas, open zettels.
- **space** — load-bearing or far-reaching. App-factory, anthropology (reflexive — observers observed), norms-changing proposals, anything touching external systems.

## Phases

### Phase 0 — Whiteboard + Linear (DOING)
- [x] Whiteboard opened
- [ ] Linear parent issue created (`plan create "world: build oria-crazy-world"`)

### Phase 1 — Aliases (DONE)
Add `zisser`, `yohai`, `mark`, `poll` aliases mirroring `c`'s mechanism (justfile recipe → claude-canonical → opus[1m] high effort, with persona pre-loaded via read-first list).
- Worker: Wes
- Reviewer: Ron
- Verification: each alias actually wakes the right persona on a fresh shell.
- [x] Recipes added (`_persona` helper + 4 wrappers in `justfile`).
- [x] Aliases added (`.devcontainer/aliases.sh`).
- [x] Static + dry-run verified. Aliases fully active on next devcontainer rebuild (baked in via Dockerfile L122 → `/etc/bash.bashrc.d/20-aliases.sh`, also re-sourced from `~/.bashrc` to win over Ubuntu defaults).
- 2026-04-28 — chose `--append-system-prompt` over first-message fallback (flag exists in current `claude --help`).
- 2026-04-28 — DRY shape: parameterized `_persona name *args` helper with one Zisser branch (only persona needing extra read paths). Underscore-prefix hides it from `just --list`.
- 2026-04-28 — **Reviewed by Ron** — verdict: ship with one fix. `--append-system-prompt` confirmed live; persona files all present (zisser/yohai/mark/poll, plus ron/wes/sam ready); zisser/ branch paths exist; aliases.sh wired in Dockerfile L122 (corrected — not `/etc/profile.d/`); `just --list` cleanliness verified. **Fix applied:** added `[a-z][a-z0-9-]*` guard to `_persona` to close path-injection pinhole — `just _persona ../../etc/passwd` would have been substituted into the read-list inside the system prompt. Arg-passthrough whitespace-splits, but matches `c`'s existing behavior — consistent, not a regression.

### Phase 2 — World skeleton (DONE)
Charter `oria-crazy-world/` as a sibling of `usegin/` locally. Top-level dirs: `ground/`, `sky/`, `space/`. README explaining the world. CLAUDE.md teaching agents how to walk it.
- Worker: Wes (single, sequential — small)
- Reviewer: Ron
- [x] Skeleton landed (`9b84bd5e6`): 8 files — top-level README + CLAUDE.md, 3 zone READMEs, 3 `.keep` placeholders.
- 2026-04-28 — top-level README opens with the click ("outcomes are byproduct"); same phrase grep-confirmed in all 4 READMEs + CLAUDE.md.
- 2026-04-28 — agent CLAUDE.md names the four wake-up aliases (`zisser`/`yohai`/`mark`/`poll`) so an agent invoked here knows their door.
- 2026-04-28 — voice: lowercase / fragments where they land naturally; readable cold; no Examples / FAQ / Glossary sections (charter explicit refusal honored).
- 2026-04-28 — kept zones at top level (`ground/sky/space/`) — not nested under `zones/<name>/`. Charter shape held; no shape-change escalation needed.
- 2026-04-28 — **Reviewed by Ron — Phase 2** — verdict: ship with two fixes applied. Click present in all 5 files; aliases & zone semantics & sibling-of-usegin framing all load-bearing-correct; inhabitants placeholders consistent; no FAQ/Examples/hedging; whiteboard accurately reflects landed shape. **Fixes applied:** (1) `space/README.md:6-7` — "outcomes are byproduct" clause was softened with a *but*-clause that re-lionized byproducts ("byproducts here can ripple") in the one zone where the world exits to external surfaces; rewritten to keep the click clean ("even here … tend the process all the more carefully, and the ripple takes care of itself"). (2) Bare forward-refs to non-existent institution paths in all 3 zone READMEs (academy/visitor-center/gymnastic/university/app-factory/anthropology) phase-tagged with *(scaffolds in Phase 3.)* so a fresh reader doesn't expect to walk to a missing dir. **Notes (no fix; for Oria's call):** CLAUDE.md voice register is all-lowercase / fragment-leaning vs `usegin/CLAUDE.md` + `zisser/CLAUDE.md` sentence-case; declarative + posture-naming intact, only case-style differs. Read-first item 4's "(`usegin/personas/<name>.md`)" parenthetical is partial — alias also pre-loads `.claude/agents/<name>.md`, and zisser additionally loads zisser-tree files. Persona is already injected via `--append-system-prompt`, so a literal walker isn't misled.

### Phase 3 — Five institutions in parallel (DONE)
Five independent Wes workers, one per institution. Each scaffolds:
- `<institution>/README.md` (charter + the click)
- `<institution>/human/` — human-facing entry points
- `<institution>/agent/` — agent-facing entry points
- One starter artifact per face that proves the institution's loop works

Placed under their zones (academy → ground, gymnastic → sky, university → sky, visitor-center → ground, app-factory → space).
- [x] All five institutions landed (`4a95d56d1` academy, `c8e7a5298` gymnastic, `01fbbc357` university, `356c7a0df` visitor-center, `ca7a6fbf7` app-factory).
- 2026-04-28 — voice held across all five workers: lowercase / fragment-leaning, declarative posture, click present in every README. No FAQ / Examples / Glossary / Appendix.
- 2026-04-28 — two-faced doctrine lived: every institution's `human/` and `agent/` files explicitly read each other.
- 2026-04-28 — pipeline coherence verified: visitor-center's `dream-intake.md` writes to `space/app-factory/intake/<date>-<slug>.md`; app-factory has that exact path with matching schema (`pipeline/step-templates/01-dream-card.md`); step 8 names Yohai correctly (matches `.claude/agents/yohai.md` + `usegin/personas/yohai.md`); 11 step-templates are genuinely 11 different artifacts.
- 2026-04-28 — `university/departments/.keep` and `university/papers/.keep` are intentionally empty (open-to-empty addresses; physics + anthropology plant in Phase 6). `app-factory/intake/.keep` and `app-factory/runs/.keep` carry usage docs.
- 2026-04-28 — **Reviewed by Ron — Phase 3 cross-cut sweep** — verdict: ship with seven fixes applied (no blockers).
  - **Stale phase tags fixed.** Zone READMEs (`ground/`, `sky/`, `space/`) and the top-level `README.md` still tagged the now-landed institutions as *(scaffolds in Phase 3.)*; rewritten as inhabitants. Visitor-center's cross-ref to `space/app-factory/intake/` was tagged *(scaffolds in Phase 7.)* — wrong; intake/ scaffolded in Phase 3, only the *first run* lives in Phase 7. Corrected.
  - **Anthropology mis-tagged.** `space/README.md` listed anthropology as *(scaffolds in Phase 3.)*. Anthropology is a Phase 6 university department; corrected to point at `sky/university/departments/anthropology/` with the Phase 6 birth tag and the gradient note (promotes to space when load-bearing).
  - **University ↔ app-factory coherence gap.** University README didn't acknowledge that philosophers own pipeline step 2. Added an "adjacent rooms" section naming step-2 ownership and clarifying that philosophy essays live in the run dir, not `papers/`.
  - **All cross-references resolve** — verified by direct path-walk of every link. **No filler**, **no "later"**, **no FAQ/Examples/Glossary/Appendix**.
- 2026-04-28 — **Notes for awareness (no fix):**
  - Visitor-center intake/ exists as Phase 3 scaffold but the orchestrator that polls it (Mark, in `space/app-factory/agent/factory-orchestrator.md`) doesn't actually run yet — Phase 7 is the first run. The "polls this dir" language is aspirational-but-honest, flagged in `factory-orchestrator.md:103` as "this file describes how it *will* run."
  - Academy's first-read step 8 points at `usegin/personas/README.md` — confirmed exists.
  - Gymnastic's `spawn-vs-execute.md` drill is sky-correct (failure-as-curriculum), not space-load-bearing — zoning held.
  - The 11 step templates each have step-specific schema. dream-card has *what hurts now / smallest version / non-goals*; philosophy has 2-paragraph discipline + threads-for-designers; design has *the click / flow / surfaces*; architecture has seams table + Doppler row; spec mirrors Linear; slices has slice map + cross-slice verification; build is logbook; QA is 3 axes; deploy has rollback; retro is tikur with cluster check + propagation. Not copy-paste rename.
- Reviewer: one Ron sweeps all five diffs.

### Phase 4 — Migration
Move `usegin/oria-crazy-space/` → `oria-crazy-world/ground/` (or wherever each piece lives). Pull canonical personas, principles, philosophy from `usegin/personas/`, `usegin/`, `usegin/zettel/principles/` as world ground.
- Worker: Wes
- Reviewer: Ron
- **Don't break `usegin/`** — leave breadcrumbs / symlinks if needed so old paths still resolve until rewired.

### Phase 5 — GitHub repo
`gh repo create AskEffi/oria-crazy-world --private --source=oria-crazy-world --push`. Wire `usegin/` to clone it as a git submodule (or sibling — TBD by what feels least friction).
- Worker: Wes
- Reviewer: Ron

### Phase 6 — Self-spawning departments
Two parallel R&D teams (Poll + Wes):
- Expand the **physics** department in `oria-crazy-world/sky/university/physics/`
- Create the **anthropology** department in `oria-crazy-world/sky/university/anthropology/`
- Each: 3-5 angle-Polls research → 1 Sam synthesis → 1 Wes structure → 1 Ron review.

### Phase 7 — App-factory pilot: Gemini voice translator
Only after world is alive (institutions populated, processes tested).

**The dream:** "I want to talk to Claude from my phone instead of my terminal." Voice → text (Gemini) → Claude → text → voice (Gemini). Gemini key in Doppler.

**The point isn't the app.** The point is the a-z process: dream-intake → idea → design → spec → goals/methods/processes → project plan → infra → build → QA (Yohai's team) → deploy. Many teams, many steps. Laconic each.

Pipeline shape (each step owned by a different team, each emits an artifact under `space/app-factory/runs/2026-04-28-gemini-voice/`):
1. **Visitor-center** — receives the dream, asks the right questions, writes the dream-card.
2. **Philosophers** (sky/university) — what is this dream really? What's its shape? Two-paragraph essay.
3. **Designers** (a team to be created, ground or sky) — sketch the experience.
4. **Architects** — pick the seams: what's voice, what's transport, what's Claude, what's deploy.
5. **Spec team** (`spec` skill) — formal acceptance criteria.
6. **Slicers** (`slicing-specs` skill) — vertical slices.
7. **Builders** (Wes per slice) — implement.
8. **Yohai's team** (QA, comptroller) — verify against spec + code-quality + process-quality.
9. **Deployers** — ship to a real URL Oria can hit from his phone.
10. **Retro team** — tikur after delivery: what did the world learn about itself?

## Decisions log
- 2026-04-28 — repo target: `AskEffi/oria-crazy-world` (private). Justification: world is for our team; can be opened later. (Z's call, no contradiction.)
- 2026-04-28 — world scope: substrate (personas, principles, philosophy, teams) goes to world; machinery (`evals/`, `comptroller/`, CLI tools, hooks) stays in monorepo.
- 2026-04-28 — local-first then GitHub: shape it locally, push when phase 5 lands, not before.
- 2026-04-28 — alias spelling: canonical (`zisser`, double-s) — matches existing files. Oria's "ziser" treated as casual ref, not target name.

## Open-to-empty addresses
*(filled as we go — no "later"; placeholder artifacts created at each deferral)*
