# Charter — Inbox app walking skeleton (Wes)

## Goal

Build the walking skeleton of the Inbox app: one parked question travels
end-to-end from agent → DB → Lihu's `/inbox` page → answer → readable by
the asking agent via CLI. **S0+S1+S2+S3 today.** S4 (LLM drafts) and S5
(comfort axis) are next-day work.

Full plan: `zisser/plans/2026-04-30-inbox-app-async-qa-surface.md` —
read it first, especially "Domain model" and "Slices."

## Background

Lihu wants an async surface where Gin agents (me, Zisser, Wes, etc.)
can drop questions for him to answer when he's at the keyboard.
Today (2026-04-30) he's driving the human team and won't be at the
keyboard much. He told us this morning to "give me an app that will help
me manage… you can put there an LLM, you can put there another ZSR, you
can send someone to work on it. You should do everything."

This complements (does NOT replace) `tools/bin/question` — that's the
inverse direction, Lihu→Gin, ephemeral, in-session. The Inbox is
Gin→Lihu, persistent, cross-session, with state.

It also materializes one half of z113
(`usegin/zettel/zettels/z113-bidirectional-comfort-feedback-gin-human.md`)
— the bidirectional comfort/feedback channel. S5 of the plan completes
the comfort half.

## Constraints

- **No deploys.** Land on `main`. Lihu promotes to staging/prod.
- **Migrations local-only today.** Don't run against staging/prod DBs.
- **Use existing auth patterns.** Workspace-owner-only check for
  `/inbox` page; don't invent a new model. See
  `nextjs-app/CLAUDE.md` for the pattern.
- **Tests follow the standard CLAUDE.md test layers** — schema/RLS in
  `nextjs-app/tests/integration/`, CLI in unit tests,
  page in component tests.
- **Use the `fix-bug` quality bar minus bug-fix specifics** — companion
  + reviewer + verifier pattern is the team's TDD baseline. Spec is
  `tdd-impl-plan` → `tdd-execute`.
- **Walking-skeleton first.** Resist gold-plating. S0+S1+S2+S3 = one Q
  end-to-end with no LLM. S4 starts only after S0+S1+S2+S3 ships.
- **Per `feedback_always_push`** — push every commit to `origin/main`.
- **Per `feedback_commits_at_every_change`** — commit per slice (or per
  meaningful change within a slice), not one big commit at the end.
- **Per `feedback_use_subagents_for_implementation`** — Wes spawns its
  own sub-agents for substantive code work; doesn't implement the whole
  thing inline.

## Deliverable

### Today (S0+S1+S2+S3)

1. Migration `supabase/migrations/<ts>_create_agent_questions.sql`.
2. CLI `tools/bin/ask-lihu` (bash + supabase insert pattern).
3. Next.js routes `app/inbox/page.tsx` + `app/inbox/[id]/page.tsx`.
4. CLI `tools/bin/inbox-status`.
5. Tests at the standard layers (unit for CLIs, component for pages,
   nextjs-db for the answer flow).
6. End-to-end manual verification:
   ```bash
   ask-lihu "smoke test from Wes" --context "ENG-XXXX" --urgency low
   # → row id printed
   # Lihu opens /inbox locally → sees the question → types answer → submits
   inbox-status --question-id <id>
   # → returns Lihu's answer
   ```
7. Linear: parent + 6 sub-issues already created (ASK-5 parent;
   ASK-6/7/8/9 = S0/S1/S2/S3; ASK-10/11 = S4/S5 stay Backlog).
   Move ASK-6..9 through "In Progress" → "Done" as they complete.

### Stop here today

S4 (LLM-suggested drafts) and S5 (comfort axis) are NOT today's work.
Leave them as Linear sub-issues with the plan slice text in the body.

## Stop condition

Comes back to Zisser when:
- Walking skeleton is green: ask-lihu → inbox → answer → inbox-status
  round-trips for one real question on local.
- All commits pushed to `main`.
- Linear parent + sub-issues exist.
- A short report appended to this charter under `## Returned`.

OR:

- Wes hits a blocker that needs Lihu's call (e.g. "the auth pattern
  for workspace-owner-only doesn't exist, need direction"). Report
  what's blocking + the safer-default action taken.

## Dispatched

- when: not yet — see "Dispatch status" below
- to: Wes (via Gin-main with Agent tool)
- expected back: end of day 2026-04-30, or with-blocker before then

## Dispatch status

**PARKED, NOT DISPATCHED.** This Zisser sub-agent invocation does not
have the `Agent` / `Task` tool exposed in its toolset (4th confirmation
of the cluster — see `usegin/zettel/zettels/z114-...`). The charter is
ready for Gin-main (the parent invocation) to spawn Wes against it
in this same session, using the parent's Agent tool.

If Gin-main can't spawn (e.g. capacity), the fallback is the tmux-spawn
pattern documented in `zisser/CLAUDE.md` ("Known harness gap — Agent/Task
tool unavailable in sub-agent context").

## Returned

(filled when Wes returns)

- when:
- summary:
- next:
