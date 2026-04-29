---
id: z112
title: Silent-bug pattern — SDK caller mutation + silent RLS deny on destination = invisible bug
type: zettel
authored-by: usegin
threads: [~ENG-5483, ~ENG-5484]
created: 2026-04-29
session: 96a63536-c997-4acd-a9ee-3b389dee7c7e
---

A class of production bugs that survives unit tests, lints, and a careful
human review because every single individual operation reports success:

1. **An SDK call quietly mutates its caller.** Example: ``supabase-py``'s
   ``Client.auth.verify_otp`` fires a ``SIGNED_IN`` event; the parent
   ``Client._listen_to_auth_events`` listener overwrites
   ``options.headers["Authorization"]`` and nulls the cached postgrest child.
   The call returns the session you asked for. Nothing throws. Nothing logs.
   The Bearer token on the *same client object* is now a different identity.

2. **Downstream writes hit a destination with silent-deny RLS.** Example:
   ``scheduled_report_runs`` had a SELECT-only policy for ``authenticated``
   and no INSERT/UPDATE/DELETE policy. PostgREST returns ``200 OK`` with
   ``data: []`` on a denied UPDATE. No error code, no exception, no log line.
   The row is unchanged but the client thinks the write landed.

(1) + (2) is a perfect invisibility cloak: the callsite for the SDK call
looks fine, the callsite for the write looks fine, the integration test
fails for reasons no individual log line explains.

## How to recognize it (debugging future-Claude grep targets)

- **"PostgREST returns 200 but the row didn't change."** First question:
  is the client's ``Authorization`` header what you think it is at the
  moment of the write? Inspect ``client.options.headers["Authorization"]``
  at the line above the failing UPDATE.
- **"Row stays at pending forever."** Long-lived clients shared across
  identity boundaries (service-role bookkeeping vs. user-JWT auth flows)
  are the natural habitat.
- **"Test passes in isolation, fails inside the bigger flow."** The mutation
  is path-dependent: only the flow that runs the SDK call between the read
  and the write hits the bug.

## Counter-pattern (what made ENG-5483 quiet)

The bug ate two SLAs (work_started_at sentinel timeout, missed-fire detection)
*before* anyone noticed because the retry-on-failure machinery never tripped:
the writes "succeeded" and the row just sat there. Detection came from
manual inspection of why no email was being sent, not from any alert.

## Three-part fix shape

1. **Structural, not bracketed.** Make the SDK call on a throwaway client
   that's never used for the destination writes. Save/restore around the
   mutation works but pokes private attrs and leaves a window. Throwaway
   makes "caller not mutated" a property of the call shape, not a try/finally
   discipline.
2. **Make silent-deny loud at the destination.** Fix the missing
   INSERT/UPDATE/DELETE RLS policy (or whatever the matching gate should be)
   so the write fails with a permission error instead of returning 200/0.
   ENG-5484 tracks this for ``scheduled_report_runs``.
3. **Pin the contract with a test that reproduces the listener.** Don't
   stub the SDK call to a no-op — faithfully run the same
   ``_save_session`` + ``_notify_all_subscribers`` path that real
   ``verify_otp`` does, then assert the caller's auth state is unchanged.
   A no-op stub would have passed against either fix shape AND against the
   bug.

## Lekach

When two systems both speak in 200-OK on failure (SDK-mutates-caller,
RLS-silently-denies), their composition is undetectable from the inside.
Look for these pairs proactively in code where one client crosses identity
boundaries between operations.

Linked: ENG-5483 (the fix), ENG-5484 (the missing RLS), commits ba1afc96f
(throwaway refactor) and ed712a43b (stub adjustment).
