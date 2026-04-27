# Close — Slack integration autonomous run

**Run:** ship a functional Slack integration — UseGin (team-internal, Gin-mediated) and AskEffi-Slack (customer-facing, 1 channel ↔ 1 project).
**Closed at:** 2026-04-28 by Gin session `c2f48116-8355-4edf-969f-e9e85239cc46` running autonomous-vibe (z091).
**Status:** **Code done up to the encryption gate. Five of six decisions resolved 2026-04-28; D5 (multi-Gin checkout fight) running through `/tikur`. Demo recipe ready in `DEMO.md`.**

## Decisions resolved (2026-04-28 by Lihu)

| # | Topic | Resolution |
|---|---|---|
| **D1** | Pilot trust posture (encryption strength) | **DECIDED: ship pilot on current AES-GCM**; KMS upgrade triggers only on a Fortune-500 questionnaire that demands HSM-rooted custody. Lihu acknowledged the explanation; lean stands. |
| **D2** | Customer Slack: read-only at MVP | **DECIDED: yes, read-only.** Team gets bidirectional via UseGin first; customer surface graduates only on competitive pressure. |
| **D3** | Marketplace listing timing | **DECIDED: start now.** Linear ENG-5417 created with the full prep list + Zisser-mediated reminder for next work session. |
| **D4** | Channel-binding cardinality positioning | **DECIDED: 1:1 in customer help, N:1 in schema (already shipped).** Flip help when ≥30% of pilots ask. |
| **D5** | Multi-Gin checkout structural fight | **IN FLIGHT: tikur running** on z094/z095/z096/z097. Distilled questions for Lihu surface mid-tikur if any genuine input is needed. |
| **D6** | Cadence | **DECIDED: interactive next session.** Run the demo (Phases 0/1/2 of `DEMO.md`) live with Lihu, react to what we see. Handoff comment + resume prompt below. |

## What landed

Both demo paths reachable the moment the env vars are set. UseGin: `dx slack whoami / send / read / inbox / post` with ENG-id auto-link both directions. AskEffi-Slack: OAuth callback + workspace install card + project-level channel-binding picker + Events route handling `app_uninstalled` / `tokens_revoked` / `channel_rename`. AES-256-GCM token encryption with a quality gate that refuses to write raw. ~250 new tests, full unit suite green.

For specifics: read `DEMO.md` (~10-min recipe to demo). For history: `SYNTHESIS.md`, `recommendation.md`, the eight angle whiteboards, and `usegin/comptroller/audits/` for the five between-phases audit reports.

## What's blocked on you

Six decisions. All in management language; pick a lean, override a lean, or ask for more — whatever you do, the next Gin can carry on the moment you've answered.

### D1 — Pilot trust posture: how strong does our security story have to be on day one?

**What:** AskEffi-Slack will be the first integration where we hold a customer's third-party token in our DB ourselves (Drive/Linear/Fathom delegate to Unified.to). The encryption is real, but pilot-grade — single key, app-side, no HSM. Question is whether the pilot ships on that, or we hold for a stronger root-of-trust before any customer connects.

**Why:** Pilot conversations sometimes bring out customer questionnaires. Some Fortune-500 questionnaires demand HSM-rooted keys. If a pilot customer asks and we say "single-app-key today, KMS later," we either get permission or lose the slot. The cost of waiting for KMS is a cloud-account decision (we're AWS-free today; adopting KMS adds AWS as a subprocessor on every existing customer's DPA).

**Recommendation:** Ship pilot on the current encryption. The helper interface is intentionally KMS-swappable later — no customer-visible migration when we cut over. If a Fortune-500 prospect asks, treat that as the upgrade trigger, not the default.

**Cost:** Future cutover work when KMS becomes the answer (one-shot re-encrypt, ~1 day). Customer-visible: zero.

**Risk:** A first-customer-blocker question lands on day one and we don't have time to react.

**What to worry about:** A customer security review asking specifically about KMS / HSM / key-custody before we have a pilot in. Watch the first three customer conversations.

### D2 — Customer Slack scope: read-only at MVP, or bidirectional from day one?

**What:** Customers connect their Slack and Effi reads channels. The choice is whether Effi can also write back into Slack (replies, slash commands) at MVP, or whether we deliberately ship read-only first.

**Why:** Bidirectional is what competitors demo. It's also a different scope set in Marketplace review, designs prompt-injection defenses for hostile channel content, and forces a billing decision (does asking Effi from Slack count toward the workspace's seats?). Read-only ships a cleaner pilot but loses the "ask Effi from Slack" demo moment.

**Recommendation:** Read-only at MVP for customers. Use UseGin-Slack on the team's own Slack as the bidirectional sandbox — harden the prompt-injection posture there, on our own blast radius. Graduate the customer surface only when competitive pressure on this specific axis lands.

**Cost:** Sales answers "v2" to "can I just ask Effi in Slack?" for a quarter or two. The team feels that pressure first.

**Risk:** A competitor ships native bidirectional and wins demos on it specifically. Track Glean / Notion AI / Slack's native AI on this exact axis.

**What to worry about:** Sales reporting that the question lands every demo, not just some.

### D3 — Marketplace listing: start the calendar now or wait for first customer?

**What:** Slack's May-2025 ToS throttles the message-history API to 1 req/min for non-Marketplace apps. Full enforcement is March 2026. We can't run a customer-facing Slack at scale without listing. Question is whether we start the (multi-week) submission process now, or react when the first customer is signed.

**Why:** Listing review takes 2-6 weeks. If we react when a customer signs, we're racing a clock against the customer's onboarding window. If we start now, the questionnaire/screencast effort is ~a few hours/week of someone's time before we have anyone to onboard.

**Recommendation:** Start now. The OAuth flow + lifecycle handlers + scope set are stable; that's the listing-review bar. Use the prep already on disk (`usegin/research/slack-marketplace/`) — listing draft, security questionnaire, submission checklist.

**Cost:** A few hours/week through review. Six unknowns in the security questionnaire need your answers (`security-questionnaire.md` § Appendix).

**Risk:** A reviewer-flagged change forces a code change we didn't anticipate. Most likely candidate: a scope they want us to drop.

**What to worry about:** Privacy policy / terms — they need Slack-specific clauses we haven't written. That's legal's seat, not Gin's.

### D4 — Channel binding cardinality: lock the schema?

**What:** A customer's project might bind one Slack channel, or several. The schema can support multiple-per-project (already does) and the UI can default to one (it does). Question is whether we promise customers "one channel per project" in the help docs / sales conversation, or whether we deliberately keep it open.

**Why:** Promising 1:1 is simpler to explain. Keeping it open lets us discover the real customer pattern. The team already wants N:1 internally (engineering channel + design channel feeding one project) — that's evidence the team's pattern likely generalizes.

**Recommendation:** Document as 1:1 in the customer-facing help (cleaner UX promise). Keep the schema N:1 (already done — that's a one-time write). When ≥30% of pilot customers ask for multiple, flip the help and the UI adds a "Bind another" button.

**Cost:** Negligible. The schema decision is already irreversible-cheap.

**Risk:** None — this is purely positioning, not architecture.

**What to worry about:** Nothing. Mark this decided unless you see something I don't.

### D5 — Multi-Gin checkout: pick a fix, or accept the friction?

**What:** Three structural autosync collisions hit during the run (zettels z094, z095, z096, z097). Multiple Gins on one repo + autosync companion = occasional reset-wipes, attribution swaps, cross-agent push blocks. We worked around it by going single-agent, but if we want parallel batches again, we need a fix.

**Why:** Single-agent is slower. The autonomous-vibe protocol becomes 2-3x more productive when parallel batches are safe. The fight is unfixed today.

**Recommendation:** Run a tikur (post-mortem) on the three modes (z094/z095/z096/z097 captured the data). Tikur points at three candidate fixes in z095 — you pick one. The cleanest is per-session worktrees so each Gin has its own `.git/index` (z097's lean).

**Cost:** Tikur takes ~30 min of a session. The fix itself: per-session worktrees is ~2 hours of tooling work.

**Risk:** Picking the wrong fix and finding a fourth failure mode in the next parallel batch.

**What to worry about:** Anyone running a 4-Gin parallel batch today is going to lose work. Until this is fixed, hold the parallel runs.

### D6 — When does Lihu come back into the loop?

**What:** This is a meta-decision about cadence. The autonomous run produced a lot — does the next 24h see another autonomous run, an interactive pairing on the demo, or full pause?

**Why:** Autonomous-vibe is good for shipping breadth. Interactive is better for the demo polish moments and the calls only Lihu can make (the five above). Full pause is right if the next decisions need stakeholder conversations (legal for marketplace ToS, etc.).

**Recommendation:** Interactive next session. Run the demo (Phases 0-1-2 of `DEMO.md`) live, see Slack actually working, react to what you see. Then decide what to fan out next based on what felt right or wrong — not based on what the autonomous Gin guessed would feel right.

**Cost:** ~30 min of your time on the demo. Catch any latent issues the unit tests didn't.

**Risk:** A demo-time surprise (Slack-side mis-config, a UI rough edge) eats more time than expected. Mitigation: the failure-modes table in `DEMO.md` Phase 3 covers the predictable ones.

**What to worry about:** If the demo feels off and you can't tell why, *that* is the next R&D round.

## How to continue

1. **Read this file cold.** Five minutes.
2. **Make the calls on D1-D6** (any order; D6 affects whether you run the next 24h interactive or autonomous).
3. **Tell the next Gin** how to act:
   - Same session: `claude --resume c2f48116-8355-4edf-969f-e9e85239cc46`
   - Fresh session: point it at this file + `DEMO.md` + `FOR-TOM.md`.
4. **The next Gin's first move:** ack each decision in chat (so the trail is in the next session too), update FOR-TOM.md / DEMO.md / Linear if any decision changes them, then continue from "Next action" below.

## Next action — if all six decisions land on the recommendation

The next session, in order:

1. **You generate** `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`), set in Doppler + Railway sealed env. (~30 seconds, can't be Gin.)
2. **You register** the two Slack apps per `DEMO.md` Phase 1a + 2a. Set `USEGIN_SLACK_BOT_TOKEN`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`. (~15 minutes, can't be Gin.)
3. **Run the smoke** — `doppler run -- dx slack post "ENG-5399 demo from Gin"` should land in `#usegin` with the ENG-id rendered as a clickable Linear link.
4. **Run the customer flow** — install AskEffi-Slack on team Slack as if you were a customer admin; verify install row encrypted in DB; bind a channel from a project's Integrations tab.
5. **Once both demos work,** the next slice is C4 (Events ingestion → message data items → Effi can answer questions about Slack messages). That's a big slice (~1-2 weeks single-agent or one autonomous run with the autosync fix from D5).

## Pointers — cold-reader legibility

- **Front door for the demo:** `usegin/research/slack-integration/DEMO.md` — checklist-shaped recipe.
- **Round entry:** `usegin/research/slack-integration/RESUME.md` — round-level overview, marked CLOSED.
- **Synthesis (the 10 convergent findings + the load-bearing May-2025 ToS):** `SYNTHESIS.md`.
- **Z026-shape recommendations from the round:** `recommendation.md` (these are the original five Lihu-asks; this CLOSE.md is the post-shipping six).
- **For Tom (running task list, longer-form):** `FOR-TOM.md`.
- **Marketplace prep (4 docs):** `usegin/research/slack-marketplace/`.
- **Token-encryption decision research:** `usegin/research/token-encryption/recommendation.md`.
- **Linear parent + 17 sub-issues:** ENG-5399.
- **Yohai (Comptroller) audit ledger:** `usegin/comptroller/audits/` — five between-phases audits, all verdict-correlated.
- **Closing zettels from the run:** z091 (autonomous-vibe protocol), z098 (mock-leak structural pattern), z099 (what made this run productive).
- **Resume the same Gin:** `claude --resume c2f48116-8355-4edf-969f-e9e85239cc46`.

## Resume prompt for next session

Paste the block below into a fresh Claude Code session (or as the first message after `claude --resume c2f48116-8355-4edf-969f-e9e85239cc46`). It tells the next Gin everything it needs to know to start the interactive demo without re-deriving context.

```text
We're picking up the Slack integration where last session left off — autonomous-vibe run closed clean.
Read in this order before doing anything:
  1. usegin/research/slack-integration/CLOSE.md   (the six decisions, five resolved + D5 tikur status)
  2. usegin/research/slack-integration/DEMO.md    (the recipe we're about to run live together)
  3. ENG-5399 latest comment                       (the run summary)

We're in interactive mode (D6 decision). Cadence: I drive, you keep me out of trouble. Don't fan
out parallel sub-Gins until /tikur lands the structural fix on the multi-Gin checkout fight (D5).

First action: walk me through DEMO.md Phase 0 (TOKEN_ENCRYPTION_KEY setup). I'll generate the key
and set Doppler/Railway. You verify, then we go to Phase 1 (UseGin app registration + smoke). Then
Phase 2 (AskEffi-Slack app + customer flow demo). React live to anything that surprises us.

If /tikur (background from the previous session) surfaced distilled questions in CLOSE.md § D5
follow-up questions, ack them at the start. If the tikur landed a fix that needs my action, say so
before the demo.

I'm Lihu. Session id of the prior run: c2f48116-8355-4edf-969f-e9e85239cc46.
```

That prompt + reading the three pointers gets the next Gin to "ready to demo with Lihu" in ~5 minutes of cold-context absorption.

## A note on language

Per the `close` skill: every decision above is at the altitude where the answer doesn't change if we swap the underlying technology. D1 is "trust posture", not "AES vs envelope". D2 is "scope at MVP", not "scopes inventory". D3 is "calendar", not "submission steps". The implementation details are downstream — Gin owns those.

If you want any decision pulled up further or pushed deeper, say so. The protocol is forgiving — close docs evolve.
