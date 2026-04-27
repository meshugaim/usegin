---
id: z098
title: A server action substituted by `mock.module` cannot host unit tests in the same module — extract pure logic to lib/
type: pattern
created: 2026-04-27
threads: [z091-autonomous-vibe, z095, z096, z097]
authored-by: orchestrator-gin
---

# z098 — Tests cannot live alongside server actions that get `mock.module`-substituted

## The pattern

In `nextjs-app/`, a server action file (`@/app/actions/foo.ts`) cannot host its own unit tests in the same suite as **any** component test that legitimately registers `mock.module("@/app/actions/foo", ...)` to bypass `server-only` imports.

Bun's `mock.module()` is process-wide and module-load-timed. Once a sibling test file calls it at top level, every subsequent import of that path — *including from inside the action's own test file* — resolves to the mocked surface, not the real implementation. Inner private functions are unreachable. The action-level test silently exercises the mock.

The repo's `nextjs-app/tests/CLAUDE.md` already documents `mock.module` for server actions as the **legitimate exception** (server actions transitively import `server-only` / `next/headers` / `next/cache` and can't be loaded directly from a test). The exception is correct. The follow-on consequence — that the same actions can't be unit-tested in their own module — is the new lesson.

## How it bit, three times

- **First** (z095): pre-push tests fail in the full working tree because of an unrelated agent's WIP, not because of any agent's actual commit.
- **Second** (z096): three Mode-1 attribution swaps inside a single batch — the *commit message* and the *files* belong to different sessions.
- **Third** (this turn, ENG-5413): wired token-decryption into `listSlackChannelsAction`, wrote 3 tests for the action's decrypt branches via the `options.{supabaseClient,fetchImpl}` injection seam. Tests passed in isolation, failed in the full suite — the sibling component test's `setupProjectSlackMock()` substituted the action surface, so my "real" import was the mock.

The first attempt to fix it inline (export the inner `listSlackChannelsImpl` and test it directly) failed — the `mock.module` substitution returns only the four functions the mock exposes; the impl is just absent from the substituted module. There's no way to reach the inner code from outside the file once the outer file is substituted.

## The resolution

**Extract the pure-functional pieces to `nextjs-app/lib/<thing>.ts`.** The lib file is not server-action-shaped, doesn't import `server-only`, doesn't get substituted, and tests can import it directly with no mock-leak surface.

For ENG-5413: `decryptSlackInstallToken` lives in `nextjs-app/lib/slack-token-decrypt.ts`. Five tests cover all branches (round-trip, legacy raw, AAD mismatch, tampered ciphertext, missing env). The action calls into the helper. Action-level integration is implicitly covered by component tests (which mock the action) plus the helper's unit tests (which exercise the real logic). No third location needed.

## How to apply

When wiring a non-trivial logical decision into a server action:

1. Write the pure-functional core in `nextjs-app/lib/<feature>.ts` with a typed return shape that names each failure mode (e.g. `{ ok: true, ... } | { ok: false, reason: "<discriminant>", ... }`).
2. Test the helper there (`nextjs-app/tests/unit/lib/<feature>.test.ts`).
3. The action calls the helper and surfaces clean errors per branch + Sentry-tags the failure mode distinctly (so legacy-leak vs real-decrypt-fail are separable in production).

This costs one extra file. It buys testability without the mock-leak land mine.

## What this does NOT mean

- **Don't lift everything to `lib/`.** If the action's logic is just glue around supabase + a single-shot Slack call, there's nothing to lift; the component tests' coverage is enough.
- **Don't break the server-actions mock-module exception.** It's correct. The `mock.module` is required because `server-only` cannot be loaded in tests.
- **Don't try to fix bun's mock.module to be scope-local.** That's upstream work; the repo-local move is to extract.

## The deeper finding

The third recurrence promotes this to a structural pattern: **process-wide mocks reach further than the test author intended**. The fix is always the same — move the *logic* you want to test to a file that isn't substituted. The mock substitutes the *I/O surface*; tests of the substitute surface live in component tests; tests of the *logic* live next to the logic.

Cross-link to `nextjs-app/tests/CLAUDE.md`'s "Exception: server actions in shared mocks" section — that's where this pattern's mitigation belongs in the canonical doc.

## Status

Captured the third time it bit. If a fourth occurrence happens after the lib-extract pattern is in `nextjs-app/tests/CLAUDE.md`, that's evidence the pattern wasn't loud enough — escalate to a hook that nudges the test author at write-time.
