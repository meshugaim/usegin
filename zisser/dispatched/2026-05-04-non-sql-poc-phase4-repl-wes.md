# Charter — Phase 4: REPL chat surface (Wes)

Pour: `zisser/inbox/2026-05-04-non-sql-poc-data-items.md`
Plan: `zisser/plans/2026-05-04-non-sql-poc.md`
Predecessor: `zisser/dispatched/2026-05-04-non-sql-poc-phase3-kinds-wes.md`
(closed; demo green on 5/5 including both cross-kind questions)

## Goal

Turn the one-shot `demo.ts` invocation into a real human-facing
**REPL chat surface** that holds **conversation context across turns**
— so Lihu can sit down, type a question, then a follow-up like "and
across what kinds?", and get a sensible answer. Same store/index;
only the chat layer evolves.

Phase 4 is what makes this feel like "small Effi" instead of "test
script that prints citations."

## Read-first

1. `experiments/poc-knowledge-store/app/chat/ask.ts` — the Phase 2
   chat layer; understand its return shape before touching it.
2. `experiments/poc-knowledge-store/app/demo.ts` — the regression test
   you preserve.
3. `experiments/poc-knowledge-store/0-friction.md` — target scenarios.

## Build

### `app/chat/session.ts` — conversation memory
- Keeps the last N (default 6) message pairs in memory.
- Each turn: user message + retrieved citations + answer.
- Re-embeds on follow-up: when the user types "and across what
  kinds?", the retrieval query is *the user's literal text + the
  last user-question's text* (light query rewrite — no LLM round
  trip needed for retrieval). This lets follow-ups resolve without a
  full coreference engine; we'll see how far it carries.
- Exposes `Session.ask(question) -> {answer, citations[],
  retrieval_query}`.

### `app/chat/ask.ts` — extend, don't break
- Add an optional `history: ChatTurn[]` parameter.
- When present and `ANTHROPIC_API_KEY` is set, include compacted
  history in the Anthropic call (system prompt anchors:
  "you answer about a project knowledge bag; cite source files").
- When in stub mode, history is ignored — the stub continues to
  return top-K snippet + citations. Same return shape.
- Preserve the existing single-turn signature so `demo.ts` keeps
  working unchanged.

### `app/repl.ts` — the human-facing surface
- Reads from stdin in a loop.
- Prompt: `you> `.
- Slash-commands:
  - `/help` — list commands
  - `/citations` — re-print the last answer's citations with paths
  - `/reset` — clear session memory
  - `/quit` (or Ctrl-D) — exit
- Output shape per turn:
  ```
  effi> <answer text>
        ↳ data/poc-project-0/<kind>/<ulid>.md (kind, score)
        ↳ data/poc-project-0/<kind>/<ulid>.md (kind, score)
  ```
- Pretty enough to read; no TUI library needed (`process.stdin` line
  reader + ANSI dim for citations).

### `app/demo.ts` — extend with one multi-turn check
After the existing 5 questions, run a 2-turn mini-conversation:
- Turn A: "What did we decide about pricing?"
- Turn B: "Across which kinds did that come up?"
- Assert: turn B's citations span at least 2 kinds AND turn B's
  retrieval query contains both turn-A and turn-B text (this is
  what proves session memory routed to retrieval, not just to chat).
- Demo exits non-zero if either fails.

### `README.md`
- Add a "Phase 4 — what this proved" section: the surface is a real
  chat, multi-turn works, and the storage substrate didn't need to
  know about conversation at all.

## Constraints

- **NO new dependencies.** stdin, ANSI, gray-matter, lancedb,
  ulid — that's it. (No readline lib, no chalk, no inquirer.)
- **Architectural invariant from Phase 3 still applies:** `app/store/`
  and `app/index/` MUST NOT change. `app/chat/` MAY change (this
  phase's whole point). `app/kinds/` SHOULD NOT change.
- **Self-contained inside `experiments/poc-knowledge-store/`.**
- Commit small + often. Push to main after each meaningful change.
- If a new auth/secret wall appears: append to `NEEDS.md` and route
  around. Don't stall.
- Total experiment LoC stays under 1500.

## Stop condition

- `bun run app/demo.ts` exits 0 — all 7 checks green (5 originals + 2
  multi-turn turns).
- `bun run app/repl.ts` opens a prompt, accepts a question, prints an
  answer with at least one citation, accepts a follow-up that
  resolves (visible in `/citations` output). Manual sanity by Wes;
  document the exact transcript in the return summary.

## Out of scope for Phase 4

- Web surface (Phase 5 if Lihu wants it for the recorded walkthrough)
- Real provider connections (still synthetic)
- Auth, multi-project, RLS — single project hard-coded
- Persistent session history across REPL invocations (in-memory only)

## Dispatched

- when: 2026-05-04
- to: 1× general-purpose (Wes shape)
- run: background

## Returned

(filled when agent returns)
