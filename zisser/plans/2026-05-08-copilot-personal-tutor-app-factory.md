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
| running code repo | `oria-ai/HandsOnAi-Copilot` (existing, year-of-work) | cloned to `/workspaces/HandsOnAi-Copilot/` |
| this tracker | `zisser/plans/2026-05-08-copilot-personal-tutor-app-factory.md` | this file |

## factory pipeline (10 steps, OCW canonical)

| # | step | owner | status |
|---|---|---|---|
| 1 | dream-card | visitor-center / Zisser-mediated (oria in chat) | **done** — moved to run dir as `01-dream-card.md` (OCW SHA `e554318`) |
| 2 | philosophy | mark-in-philosopher's-seat | **done** 2026-05-08 — `02-philosophy-essay.md` (OCW SHA `d0abc8f`) |
| 3 | design | mark-in-designer's-seat | **done** 2026-05-08 — `03-design-sketch.md` (OCW SHA `5dee12f`) |
| 4 | architecture | mark-in-architect's-seat | **done** 2026-05-08 — `04-architecture-seams.md` (OCW SHA `53fe5e5`) — open questions batched back to oria via Zisser |
| 5 | spec | spec skill | not started — gated on oria sign-off of step-4 open questions |
| 6 | slicing | slicing-specs skill | not started |
| 7 | build | one Wes per slice | not started |
| 8 | QA | Yohai | not started |
| 9 | deploy | deployer | not started |
| 10 | retro | retro team | not started |

## blockers / waiting-on-oria

- **OCW push 403.** all four factory commits (run-dir, philosophy,
  design, architecture) sit on local `main` in `oria-crazy-world/`
  awaiting batch push once `oria-ai` GH token gains write to
  `AskEffi/oria-crazy-world`. local SHAs: `e554318`, `d0abc8f`,
  `5dee12f`, `53fe5e5`. plus the prior `b23de46` (intake landing).
- **architecture's batch of open questions for oria** (step 5 spec
  is gated on these — Mark surfaces them as one package, not
  trickled):
  1. Word vs Excel anchor — recommend **Word** as primary; Excel as
     placeholder-video / "same idea applies" example.
  2. POC variant — recommend **V1** (task-first/buffet); V4
     (prompting-first diagnostic) violates the "no investigation"
     philosophy.
  3. Supabase tenancy — recommend **don't introduce Supabase**.
     existing HandsOnAi-Copilot stack is Prisma + MySQL; adding
     Supabase doubles auth + DB + migration tooling for a POC.
     reuse MySQL via Prisma; one optional `poc_sessions` table.
  4. LLM backend — recommend **Claude default + user pick at q4**
     (Claude / Gemini / OpenAI / no-preference). server already has
     `openai`; we add `@anthropic-ai/sdk` and `@google/genai`.
  5. Capabilities/Skills buffet shape — recommend **mixed** (single
     ranked list with `capability` / `skill` badges per item).
  6. "tell someone else" placement — recommend **both** (q5 in
     onboarding as persona signal + load-bearing moment inside
     prompting lesson, isomorphism named out loud).
- **Doppler reachability** — before slice 1 starts, spec must verify
  `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` are
  reachable from the `HandsOnAi-Copilot` deploy env. no slice-1
  blocker yet (we're at step 4, not 7).
- **the placeholder video.** oria committed to provide one Excel-
  context video + site credentials. lesson works without it (text +
  screenshots); video is enrichment. not a step-5/6 blocker.

## resolved (this turn)

- **running code repo:** `oria-ai/HandsOnAi-Copilot` cloned to
  `/workspaces/HandsOnAi-Copilot/`. Vite + React + TS + shadcn-ui +
  Tailwind + Prisma/MySQL + Express; has author/manager/learner modes,
  i18n (HE+EN), video (@vimeo/player), markdown w/ KaTeX & mermaid,
  @dnd-kit, react-hook-form, confetti. existing seed users:
  `learner@example.com / passowrd123`, `author@example.com / …`,
  `manager@example.com / …`. **POC layers on top, not from scratch.**
- **autonomous browse:** confirmed via `playwright-cli` probe against
  `example.com`. open / goto / snapshot / click / fill all work in
  headless. credentials pasted in chat are enough for authenticated
  sites; no Brown needed unless a site has aggressive bot-detection.

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
