# Tikur: Browser-agent prompt baked stale Linear-comment OAuth client IDs as live state

**Date:** 2026-04-27
**Severity:** medium  (recurrence vector clear; blast radius limited because the browser agent surfaced the gap mid-flow rather than committing damage; cost = wasted agent run + interrupted user attention + trust in the prompt UseGin generates)
**Status:** fixed
**Category:** error  (missing safeguard — no preflight rule for external identifiers in dispatched prompts)

## Timeline

**Tape sources:** session transcript above; gcloud auth state; curl probes against Google auth server; ENG-5186 Linear comment dated 2026-04-23.

- 2026-04-23 — Nitsan/Lihu's Linear comment lists three "live" GCP OAuth client IDs (prod / staging / dev) under "Next concrete steps".
- 2026-04-27 (this session) — UseGin reads ENG-5186 + comments. Probes Unified API for env=Production/staging/dev; receives an OAuth URL with a `client_id` for each, matching the Linear comment. Concludes "all three live."
- UseGin follows **only the Production URL** through Playwright to a Google sign-in page → confirms unified.to branding and the prod client is alive.
- UseGin reports state to Lihu, naming three client IDs as the targets.
- Lihu asks for a browser-agent prompt.
- UseGin drafts the prompt, hardcoding all three client IDs from the Linear comment as authorized targets.
- Lihu dispatches the browser agent.
- Browser agent: PROD ✓; STAGING → Google Console error *"The client that you're trying to edit has been deleted"*; DEV not started.
- UseGin curls Google auth server with each client_id directly. Staging returns `authError=Cg5kZWxldGVkX2NsaWVudBId…` ("deleted_client"). Dev renders sign-in page (alive).
- Lihu interrupts the next gcloud audit-log query: *"Let's stop a second. Let's do a quick tikur about those errors."*

## Five whys

- **Why did the browser-agent prompt name a deleted OAuth client as a live target?**
  → UseGin sourced the IDs from a 5-day-old Linear comment without re-verifying.
  - **Why was the Linear comment treated as live state?**
    → UseGin's posture for "external resource named in a frozen-in-time document" wasn't gated on a verification step before action.
    - **Why was that posture absent?**
      → No skill or hook converts the existing principle (CLAUDE.md *"Before recommending from memory… verify first"*; `feedback_verifier_query_external_state`; `feedback_verify_before_claiming_dead`) into a **mechanical preflight on prompts dispatched to external agents**. The principle is documented; nothing makes it fire.
      - **Why is the principle documented but not mechanically enforced?**  ← root cause (leverable)
        → The cluster of "verify external state" lessons (4 prior touches) accumulated as separate posture notes targeting the *speaker* (UseGin), never as a **prompt-dispatch checklist** that runs at the moment a multi-step external-action prompt is being authored. Posture notes work for the speaker's own next sentence; they don't reach the prompt that travels into another agent's run.

## Cluster check

Searched: "verify external", "stale", "frozen", "claim*external" across `usegin/zettel/zettels/`, `zettelkasten/zettels/`, `~/.claude/projects/.../memory/`, prior tikur records.

Touches: **4 prior** + this incident.

- `feedback_verify_before_claiming_dead.md` — cleanup proposals, ENG-5035 EFFORT_LEVEL env var
- `feedback_verifier_query_external_state.md` — verifier prompts, ENG-4979 prod UUID collision
- `z085-ghost-regressions-git-fetch-origin-before-assuming-local-dam.md` — git-state-version of the same pattern
- CLAUDE.md memory section *"Before recommending from memory"* — directly names this case ("If the user is about to act on your recommendation, verify first")
- THIS — agent-prompt authorship; identifiers from Linear comments

**Cluster shape:** *Frozen-in-time external claims (memory files, Linear comments, prior-session notes, prior tikur records) get treated as live state when authoring an action artifact (commit, prompt, recommendation). Each instance has been filed standalone. The cluster is the finding.*

The previous fixes targeted the speaker's own posture. None installed a **mechanical preflight at the dispatch boundary** — where a stale claim costs more (you've now armed another agent with it).

## Root cause

(At cluster level.) **Verify-external-state lessons live as posture notes targeting UseGin's own next sentence. They do not propagate to the dispatch boundary — the moment UseGin authors a prompt for an external agent (browser, Wes, headless Claude, sub-Gin) that names external identifiers.** A prompt is an *amplifier*: stale claims that would only cost a second of friction inside UseGin's own flow become a full external-agent run when dispatched. The dispatch boundary lacked a preflight step that verifies each external identifier the prompt commits to.

## Fixes

- **Immediate:** Drop the dead-client-ID branch of the in-flight task. Carve staging+dev into a separate Linear sub-issue. Proceed with prod only. (Already done in chat above; no commit needed for the incident itself.)

- **System:** New feedback memory `feedback_preflight_external_identifiers_in_dispatched_prompts.md` — when authoring a multi-step prompt for an external agent that names specific external-system identifiers (OAuth client IDs, project IDs, Linear ticket IDs, file paths in another repo, …), each identifier MUST be probed against the actual external system *before* dispatch, using the same primitive UseGin would use to verify after-the-fact. The memory cites this tikur and the cluster.
  Commit SHA: see `git log --oneline -1` on the same turn this tikur lands.

- **Tripwire:** Same memory's *"How to apply"* section names the canonical preflight primitives per identifier type (OAuth client → `curl https://accounts.google.com/o/oauth2/auth?client_id=…`; GCP project → `gcloud projects describe`; Linear ID → `plan show`; remote path → `git ls-remote` or branch fetch). Recurrence vector: if a future tikur lands and its timeline shows a stale identifier baked into a dispatched prompt without a preflight probe, the memory's existence didn't make the rule fire — the system change needs to escalate from feedback memory to a hook (e.g., a skill-scoped pre-Agent-call check, candidate `update-config`/skill-lab follow-up).

## Zettel

Threading via the new feedback memory + this record. No new zettel filed for this incident standalone — the cluster zettel shape would belong in `usegin/zettel/zettels/`, but this dev tree's zettelkasten is `zettelkasten/zettels/`. Memory is the right home given this is per-Lihu posture, not per-team canon.

## Notes on the prerequisite check (skill rule "when *not* to run a tikur")

- **Highest-authority debrief first:** Lihu invoked the tikur skill himself, not after framing UseGin's mistake; framing was *"those errors"* — system-shaped, not person-shaped. ✓
- **No reputational cost:** UseGin can't be fired. Browser-agent is stateless. ✓
- **Tape exists:** transcript + curl-probe outputs + Linear comment + Google auth server response. ✓

Speaking order honored: Google's deleted_client response (tool), then UseGin reconstruction (timeline above), then Lihu's framing (interrupt phrasing).
