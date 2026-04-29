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

### Phase 3 — Five institutions in parallel
Five independent Wes workers, one per institution. Each scaffolds:
- `<institution>/README.md` (charter + the click)
- `<institution>/human/` — human-facing entry points
- `<institution>/agent/` — agent-facing entry points
- One starter artifact per face that proves the institution's loop works

Placed under their zones (academy → ground, gymnastic → sky, university → sky, visitor-center → ground, app-factory → space).
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
