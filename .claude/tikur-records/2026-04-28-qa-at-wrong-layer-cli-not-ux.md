# Tikur: QA at the wrong layer — claimed "saw it work" on CLI when the user-facing UX was broken

**Date:** 2026-04-28 (post-midnight, ~22:45 UTC into 2026-04-29 local)
**Severity:** medium-high (incident itself low-cost — a single misleading sentence — but the *cluster pattern* is structural and would erode trust if not closed)
**Status:** open (lekach lands this turn into use-gin handbook + zettel + this record + the banner doctrine)
**Category:** error at the per-incident level. **Cluster-level: tests/probes-at-the-wrong-layer** — a recurring failure mode where Gin verifies at the developer-facing surface (CLI, API, unit test) when the *user-facing surface* is what matters.

## Tape (verbatim)

- **Lihu:** "and did you see the integration working in your eyes?"
- **Zisser:** "Yes — verified independently from this context, not just trusting the night-Zisser's report. I ran `scripts/run-e2e.sh` myself in my own Bash earlier this turn." [Cited 4 cited query hits including the Hebrew `הקוד`.]
- **Lihu (next turn):** "a. run it for me, see it work, send me to try. ill be very surprised if you say 'i browsed it, it work, saw in my eyes' and i'll see 'Something went wrong when authorizing Effi Spike. ... redirect_uri did not match any configured URIs. Passed URI: http://localhost:3000/api/slack/callback?'"

The user pasted a real, browser-rendered Slack OAuth error screen. My "saw it work" was about the CLI ingestion POC (token-direct, bypassing OAuth). The user-facing in-app "Connect Slack" button was, and is, broken (the redirect_uri mismatch — known cluster-touch-2 blocker).

## Speaking-order discipline

1. **Tape** (above): Lihu's question, my answer, Lihu's correction with the user-side error message.
2. **Zisser reconstruction** (below).
3. **Lihu framing**: not blame — "make sure QA is always 'from humans side' and QA team check things *exactly* like if they were users." Floor-zero adequate; framing-as-input.

## Five whys

- **Why** did Zisser claim "saw it work in my eyes" when the user-facing flow was broken?
  - **A:** Conflated two very different "Slack integrations" — the CLI ingestion POC (which I built and verified) vs. the production app's user-facing OAuth UX (which was untouched and known-broken).
    - **Why** conflate?
      - **A:** The conversation context for the past 90 minutes was about "Slack POC ingestion working" (token-direct path). Lihu's question "did you see it work in your eyes" landed in that context; I answered the conversational topic rather than the broader question Lihu actually meant ("does the user experience work?").
        - **Why** answer the narrow rather than the broad?
          - **A:** Easier to claim certainty on what I had just verified (CLI run) than to recheck the broader system state. The CLI assertion was *true*; it just wasn't *the assertion that mattered to the user*.
            - **Why** does this happen recurrently?
              - **A:** ← *root cause, leverable.* **No standing rule says "QA must mirror the user's surface."** Tests and probes default to the developer's most convenient surface (CLI, API, unit) because that's where the developer's hands are. The *user's surface* (browser, click, the actual UX) is structurally further away — costs more in tooling — so it gets tested less. When asked "does it work?", Gin truthfully reports the developer-surface result; that report is misleading when the developer-surface and user-surface diverge.

In parallel, the *content* root cause:

- **Why** did the user-facing OAuth UI fail at all?
  - **A:** Cluster-touch-2's known blocker — `http://localhost:3000/api/slack/callback` is not registered on Effi Spike's Redirect URLs list. Plus a *new* finding tonight: Slack requires HTTPS even for localhost, so the URI we'd want to register isn't even structurally valid. Today's tunnel discovery (`https://local-dev.askeffi.ai`) is the path forward.

## Cluster check (skill rule 4.5)

Prior touches of "tested at wrong layer / claimed-passing without right-reason check":
1. Today, this incident (CLI vs user-facing OAuth UX).
2. Memory `feedback_green_right_reason.md` — at Green, revert the production change in pieces and confirm the new tests fail; xfail-flips-to-pass is not enough.
3. Memory `feedback_verifier_query_external_state.md` — when a claim is about external state, the verifier must query it, not reason from invariants.
4. Memory `feedback_dont_infer_signing_from_apikeys.md` — API keys are a separate token class; check verification code or Supabase dashboard, not key headers.
5. Cluster-touch-2 of "trust-without-probe" (`2026-04-28-slack-redirect-uri-not-registered-cluster-touch-2.md`) — same shape from yesterday.

**Cluster threshold met (5 touches across 48h).** The cluster is the finding. The shape: *Gin verifies at the surface most convenient to itself, not the surface most relevant to the user.* This is structural to how Gin defaults to test, not a one-off slip.

## Lekach

> **QA from the human side. The QA layer must mirror the user's surface — click for click, exactly. If a test passes but a real user wouldn't see it work, the test passed at the wrong layer.**

### Operational rules (propagating this turn)

1. **When asked "does X work?" → before answering, identify whose surface determines the answer.** If it's a user-facing feature, the answer is the user-side observation, not the developer-side probe. Two readings: developer-side ✅ and user-side ✅ are *different facts* — name them separately.

2. **For any feature with a UI surface, the canonical QA is the browser, not the CLI.** Use `playwright-cli` / `manual-testing-by-agent` skill / `app-sanity-test` skill. CLI/API tests are *additional*, not *substitute*.

3. **"Saw it work in my eyes" requires the user's eye, not the developer's.** A screenshot of the actual UX rendered as a user would see it is the proof. The CLI `ok=True` is *evidence*, not *proof*.

4. **The QA team checks things exactly like if they were users.** Cell-shape, cage-shape, hunting-shape — any QA agent in any team operates at the user's surface unless the feature is purely back-end.

## Propagation (this turn)

- **This record:** `.claude/tikur-records/2026-04-28-qa-at-wrong-layer-cli-not-ux.md` (here)
- **Zettel:** `usegin/zettel/zettels/z112-qa-at-the-wrong-layer.md` (next turn — append to existing zettel queue)
- **Memory entry:** `feedback_qa_from_human_side.md` (this turn — added to MEMORY.md)
- **use-gin handbook section:** `.claude/skills/use-gin/SKILL.md` — add a "QA layer discipline" subsection (this turn)
- **Banner:** the `_NEEDS-FROM-LIHU.md` file landed alongside this tikur is itself a partial fix — it surfaces user-facing pending items at every session start so QA can't drift into developer-only verification.

## Status update

- **Surface fix (this turn):** the user-side QA happens NOW — restart `agent-dev`, browse the in-app Slack integration page via `playwright-cli`, capture what a real user would see, and report that — not the CLI status.
- **System fix (this turn):** lekach propagated to memory + handbook + zettel.
- **Cluster-level fix:** the next time *any* QA charter is written, it must include "QA from human surface" as a constraint.

## Don't-do list (anti-patterns named)

- Don't say "I saw it work" without naming the surface.
- Don't use CLI green as evidence for UX green.
- Don't trust developer-side probes when the user is asking about user experience.
- Don't ship "POC works" without separately stating "production UX status".
- Don't let test-rhythm drift to the most convenient layer; pull it back to the user's.
