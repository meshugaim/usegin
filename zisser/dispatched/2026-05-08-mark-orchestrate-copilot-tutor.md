---
date: 2026-05-08
dispatcher: zisser
dispatchee: mark (subagent_type)
target: oria-crazy-world/space/app-factory pipeline run
slug: copilot-personal-tutor
status: dispatched
---

# charter — Mark, orchestrate copilot-personal-tutor factory run (steps 2 → 4)

## who you are

You're **Mark**, factory orchestrator for the OCW app-factory.
Read your persona + run-of-show before doing anything:
- `/workspaces/test-mvp/oria-crazy-world/space/app-factory/agent/factory-orchestrator.md`
- `/workspaces/test-mvp/oria-crazy-world/space/app-factory/pipeline/README.md`
- `/workspaces/test-mvp/oria-crazy-world/CLAUDE.md`

## the dream

> A personal tutor that teaches Copilot inside the user's real Word
> task. Embedded learning — the user solves his actual problem and
> learns AI as a side effect. Two personas (No-AI, Know-AI). POC to
> prove to oria's boss that personalized AI teaching is cheap.

Read the dream-card in full:
`/workspaces/test-mvp/oria-crazy-world/space/app-factory/intake/2026-05-08-copilot-personal-tutor.md`

It contains 8 open questions tagged for downstream — philosophy/design
hold them, architecture answers them.

## scope of THIS dispatch

Walk steps 2 → 3 → 4 of the factory pipeline:
- **Step 2:** philosophy — dispatch a philosopher sub-agent. emit
  `02-philosophy-essay.md` per `pipeline/step-templates/02-philosophy-essay.md`.
  two paragraphs.
- **Step 3:** design — dispatch designer(s). emit `03-design-sketch.md`.
- **Step 4:** architecture — dispatch architect(s). emit
  `04-architecture-seams.md`. external surfaces use Doppler key names,
  never literal secrets.

**STOP after step 4** and return to me (Zisser) with a tight summary +
the architect's batch of open questions. I take those to oria as one
package; we don't trickle.

Do NOT advance to step 5 (spec) yourself — that's an oria-gated step.

## key context for the architects (step 4)

The running code does NOT start from scratch. There is an existing
year-of-work foundation already cloned at:

- `/workspaces/HandsOnAi-Copilot/` (private repo `oria-ai/HandsOnAi-Copilot`)
- Stack: Vite + React + TS + shadcn-ui + Tailwind + Prisma/MySQL +
  Express + i18n (HE+EN) + @vimeo/player + react-markdown
  (KaTeX, mermaid) + @dnd-kit + react-hook-form + confetti.
- Existing modes: learner, author, manager (seed users in
  `server/scripts/seed.ts`).
- The POC **layers on top** of this codebase — onboarding flow,
  persona inference, AI-ranked priority cards, task feedback loop.
  Architects should read enough of that repo to know what's reusable.

Open questions for architects to resolve (batched back to oria via Zisser):
- Word vs Excel as POC anchor (default Word; Excel is the placeholder
  video oria will provide)
- POC variant pick (V1 task-first/buffet default; V4 prompting-first
  the alternative)
- Supabase tenancy: new project (default) vs reuse existing
- LLM backend: Claude API, Gemini API, or both with user choice at
  onboarding
- Capabilities/Skills buffet shape (mixed vs split)
- "Tell someone else" question placement (onboarding vs prompting lesson)

## decision-rights envelope (oria, verbatim)

> "Resolve aggressively. Verify direction at load-bearing artifacts.
> Block only on missing keys/credentials."

Your default: ship the artifact, surface ambiguity in the artifact's
"open questions" section, keep moving. Halt only if (a) genuinely
ambiguous direction at a load-bearing fork, or (b) need a credential
you don't have.

## constraints

- **OCW push is currently 403.** `oria-ai`'s GH token lacks write to
  `AskEffi/oria-crazy-world`. **Commit locally to the OCW worktree
  but don't push** — Zisser will batch-push once oria grants access.
  Don't try to push and don't get stuck waiting.
- **Monorepo (`test-mvp`) push is fine.** The plan tracker at
  `zisser/plans/2026-05-08-copilot-personal-tutor-app-factory.md` lives
  there — append a row when each step's artifact lands.
- **HandsOnAi-Copilot push is fine** but you shouldn't be touching
  running code at steps 2–4. That starts at step 7 (build).
- **Never edit `nextjs-app/` or `python-services/`** — that's product
  code, not factory.
- **One artifact per step**, named `02-philosophy-essay.md`,
  `03-design-sketch.md`, `04-architecture-seams.md`, in
  `runs/2026-05-08-copilot-personal-tutor/` (you mint that dir on first
  step).
- **Append-mostly.** Never overwrite — revisions add dated sections.
- **Commit each artifact as it lands.** Commit message format:
  `factory: copilot-personal-tutor — step N <name>`.

## deliverable shape (your return to me)

When you stop after step 4, return:

```
Run dir: <path to runs/.../ dir>
Step 2 artifact: <path to 02-philosophy-essay.md, 2 paragraphs summary>
Step 3 artifact: <path to 03-design-sketch.md, 2-line summary>
Step 4 artifact: <path to 04-architecture-seams.md, 3-line summary>
Open questions for oria (batched):
- <q1>
- <q2>
- ...
Local commits awaiting OCW push: <count, SHAs>
Friction encountered: <if any — vague templates, gaps in the dream-card,
  missing personas. file as zettel/template-update if structural.>
```

Tight. Don't write a wall of text. Zisser distills further before
oria sees it.

## stop condition

Step 4 artifact committed locally to OCW worktree + tracker row
appended in the monorepo + your return summary delivered.

If you hit a hard blocker before that (e.g., the dream-card itself
turns out unbuildable, or a sub-agent returns garbage), stop earlier
and return what you have with the blocker named.
