---
title: copilot personal tutor — app-factory run tracker
dreamer: oria
opened: 2026-05-08
status: dream-card landed in OCW intake; awaiting Mark dispatch
factory-run: oria-crazy-world/space/app-factory/intake/2026-05-08-copilot-personal-tutor.md (will move to runs/2026-05-08-copilot-personal-tutor/ when Mark mints)
---

# plan — copilot personal tutor (OCW app-factory run)

## one-line

prove that AI can personally teach Copilot-in-Word usage by helping a
user solve their *actual* Word task, not by running a course. POC, not
product. demo for oria's boss.

## artifacts (where things live)

| artifact | location | status |
|---|---|---|
| raw pour (verbatim brainstorm) | `zisser/inbox/2026-05-08-copilot-personal-tutor-pour.md` | landed |
| dream-card | `oria-crazy-world/space/app-factory/intake/2026-05-08-copilot-personal-tutor.md` | landed, awaiting oria eyeball |
| factory run dir | `oria-crazy-world/space/app-factory/runs/2026-05-08-copilot-personal-tutor/` | not yet minted (Mark's job on dispatch) |
| running code repo | TBD — default new repo `AskEffi/copilot-personal-tutor` | not created |
| this tracker | `zisser/plans/2026-05-08-copilot-personal-tutor-app-factory.md` | this file |

## factory pipeline (10 steps, OCW canonical)

| # | step | owner | status |
|---|---|---|---|
| 1 | dream-card | visitor-center / Zisser-mediated (oria in chat) | **done — awaiting oria eyeball** |
| 2 | philosophy | university (philosopher sub-agent) | not started |
| 3 | design | designer | not started |
| 4 | architecture | architect | not started — surfaces repo + Supabase + LLM-backend questions |
| 5 | spec | spec skill | not started |
| 6 | slicing | slicing-specs skill | not started |
| 7 | build | one Wes per slice | not started |
| 8 | QA | Yohai | not started |
| 9 | deploy | deployer | not started |
| 10 | retro | retro team | not started |

## blockers / waiting-on-oria

- **eyeball the dream-card.** if oria says "good, go", Zisser dispatches
  Mark next turn → Mark mints the run + walks step 2 (philosophy).
- **video + site password.** oria committed to provide; not a step-1/2
  blocker, becomes load-bearing at design/build.
- **at architecture (step 4):** confirm running-code repo location +
  Supabase tenancy + LLM-backend choice. these are real keys/decisions.

## non-blocking opens (architects + spec team to resolve)

- Word vs Excel POC anchor (default Word; Excel video can be post-POC
  example or POC anchor swap)
- POC variant pick (default V1; V4 is the strong alternate)
- Capabilities/Skills buffet shape (mixed vs split)
- "Tell someone else" question placement (onboarding vs prompting lesson)

## zisser orchestration plan

1. **this turn:** capture inbox + write dream-card + open this tracker +
   commit OCW + reply tightly to oria with what I placed.
2. **next turn (when oria green-lights or 24h passes):** dispatch Mark
   with charter pointing at the dream-card. Mark mints the run, walks
   philosophy, surfaces step-4 architecture questions back through Zisser
   to oria.
3. **architecture stage:** Zisser brings the architect's open questions
   (repo / Supabase / LLM backend) to oria as one batch. oria provides
   keys + direction. architecture lands.
4. **spec → slicing → build:** Mark drives, slices issued via Linear
   (`plan create`), one Wes per slice. Zisser holds the line on commits
   landing in OCW factory record + the running-code repo.
5. **QA + deploy + retro:** standard pipeline; Yohai gates green.

## key rules zisser holds

- factory record = OCW commits (each step's artifact under `runs/<slug>/`)
- running code = separate repo (architects confirm at step 4)
- never edit production code (`nextjs-app/`, `python-services/`)
- ground OCW commits in `oria-crazy-world/` working dir (per OCW CLAUDE.md)
- one wes per slice, sequential where seams chain, parallel where independent
- friction = signal — if a step's charter felt vague, file zettel + queue template update

## related

- `zisser/inbox/2026-05-08-copilot-personal-tutor-pour.md`
- `oria-crazy-world/space/app-factory/intake/2026-05-08-copilot-personal-tutor.md`
- `oria-crazy-world/space/app-factory/agent/factory-orchestrator.md` (Mark's run-of-show)
- `oria-crazy-world/space/app-factory/pipeline/README.md`
