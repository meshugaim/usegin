---
id: z099
title: Autonomous-run protocol — what made tonight's Slack push productive
type: pattern
created: 2026-04-28
threads: [z091-autonomous-vibe, z098-mock-leak-pattern, z093-aad-on-insert, z094, z095, z096, z097]
authored-by: orchestrator-gin
---

# z099 — The protocol Lihu's "go on, autonomous Gin" turned into

Lihu went on vacation around 22:00 with the instruction *"work all night, endless resources, but use them efficiently and laconically. Stop only if you need me — and even then, see if you can leave the task to me async without compromising quality."* Plus: *"between phases trig an unbiased mevaker (Yohai) to check if you're still focused, working clean, not fighting anything."*

What landed in the ~3 hours after that:

- **D track full set:** `dx slack whoami` + `send` + `read` + `inbox` + `post` (outbox) + ENG-id auto-link both directions. ~108 tests in `tools/dx/src/slack/`.
- **C track 5 slices:** OAuth callback + slack_installs + channel_bindings + workspace install card + project-level binding card + channel-picker modal + Events route + 3 lifecycle handlers (`app_uninstalled`, `tokens_revoked`, `channel_rename` strict-break). ~80 tests across `nextjs-app/`.
- **z089 token-encryption:** AES-256-GCM helper + encrypt-on-write + decrypt-on-read with discriminated failure modes. ~20 tests.
- **5 Yohai audits**, 4 GREEN + 1 YELLOW, all verdict-correlated correctly.
- **Docs:** DEMO.md (250-line end-to-end recipe), FOR-TOM.md (running Lihu/Tom task list), use-gin handbook updated, Yohai persona + lab.
- **Zettels:** z091 (autonomous vibe), z098 (mock-leak pattern, third recurrence + structural fix), this one.

The session reached an honest stopping point — Yohai-5 implicitly named it: every remaining slice (C4 ingestion, marketplace polish, tikur on autosync) requires Lihu/Tom input not yet provided.

## What made it productive — the protocol

These are the postures that produced consistent shipping. They're not novel individually; the ROUND that emerged from running all of them together is what's interesting.

### 1. Single-agent vs parallel — read the fight signal, not the slice size

The first round used 5 parallel sub-Gins for the R&D phase. Big shipping wave but it surfaced 4 autosync collision modes (z094, z095, z096, z097). Yohai-1 RED-flagged the fight; subsequent rounds went strictly single-agent.

Single-agent didn't slow the run. It accelerated it: every slice landed in one push without rebase pain, attribution stayed correct, no reset-wipes, no working-tree-block-by-sibling. The "lost time" of running serially was less than the lost time of recovering from a single Mode-1 attribution swap.

**Pattern:** when the structural collision risk is unfixed, a parallel batch is *slower* than a sequential one — even when the slices are independent.

### 2. Yohai between phases is the orchestrator-conscience

Five audits, false-green-rate 0%, false-yellow-rate 0%. Yohai caught the C3 half-slice that the orchestrator was about to rubber-stamp (Gin-C3 returned with an API error mid-flow; the orchestrator's "API error means partial" intuition didn't fire on its own). Yohai also confirmed direction in 3 of 5 audits — it's not always a course-correction tool, sometimes it's a calibration mirror.

The convergence signal is the most valuable part: in audits 4 + 5, the orchestrator and Yohai INDEPENDENTLY arrived at the same next-2-slices while Yohai was auditing in parallel. That's a positive control on autonomous-vibe — when both faces converge on the same answer without coordination, the protocol is working.

**Pattern:** Yohai is paid for several times over by one catch. The audit-cost isn't an overhead, it's an insurance premium that pays out about every other audit.

### 3. Lib-extract for testability beats fighting `mock.module` (z098)

The action-level test for `listSlackChannelsAction` failed in the full suite because a sibling component test legitimately registered `mock.module("@/app/actions/project-slack", ...)` for `server-only` import bypass. Inner functions of substituted modules are unreachable.

Fix: extract pure logic to `nextjs-app/lib/<feature>.ts`. Tests live next to the lib. Zero collision surface. Same pattern caught in three other places mid-run — promoted to z098 as a structural recurring rule.

**Pattern:** when an action surface is `mock.module`-substituted by another test, the *logic* lives in `lib/` and the *I/O surface* lives in the action. They have different testability profiles. Don't try to test both in the same module.

### 4. Quality-gated stops, not blocked stops

The autonomous-vibe charter (z091) names the fork: *will continuing without the human silently degrade quality? Yes → stop. No → leave a small async task list, keep moving.*

The fork fired correctly maybe 4 times tonight. The token-encryption helper landed but refused-loud on missing env var — Lihu generates the key async, no quality compromise. The Slack apps need registration — async, no quality compromise. The autosync structural fix is a posture decision Lihu owns — paused parallel batches and kept single-agent moving. The marketplace `[LIHU UNKNOWN]` items — left in a checklist, no fabrication.

The stops that did happen were all soft: park-and-keep-shipping. The hard stop happened only at the natural end (Yohai-5 implicitly: the next slices each need Lihu).

**Pattern:** the right metric isn't "how often did Gin stop" — it's "how often did Gin stop *without leaving a clean async task list*?" That metric was zero tonight.

### 5. Documentation as a deliverable, not a chore

DEMO.md emerged because Yohai-3 named "polish for Lihu's return" as a candidate. It's 250 lines that turns "register apps + set secrets + run smoke commands + observe encryption gate" into a bullet-pointed recipe. When Lihu lands tomorrow, that's the page he reads. Nothing he writes himself, no synthesis he has to do — just three phases of [X] checkboxes.

FOR-TOM.md grew through every phase as a running Lihu/Tom task list. Every sub-Gin's "what needs Lihu" lands there. By session end it's the canonical "what's blocked on the human."

**Pattern:** in autonomous-vibe, the docs you write **for the human's return** are as load-bearing as the code you ship. Without them, the human walks back into a code change they have to reverse-engineer. With them, the human walks back into a checklist they execute.

### 6. The fights-we-named beat the fights-we-suffered

The autosync fight (z094 → z095 → z096 → z097) bit four times before it became "captured + escalated to Lihu posture-decision + parallel-paused." That's the right ratio: capture every recurrence, escalate when the same structural cause keeps surfacing, surface a cleanup recommendation when the human can act on it.

The mock-leak fight (z098) bit three times before getting promoted from "friction we capture" to "structural pattern we can name + how to avoid." Same posture, different fight.

**Pattern:** friction-zettels aren't a pile of complaints — they're an early-warning system that asks "is this a one-off or a structure?" Three is the magic number. Three recurrences = structural.

## What this protocol is NOT

- **Not a workflow.** No prescribed phase sequence. No mandatory artifacts. The slices were chosen by Yohai's between-phases reads, not by a top-down plan.
- **Not "just keep shipping."** The single biggest catch (Yohai-1 on C3 half-slice) was the orchestrator about to declare done on something only half-shipped. Without the audit, the autonomous run would have shipped lower-quality work confidently.
- **Not parallel-everything.** When the structural collision risk is unfixed, parallel costs more than sequential (z099 §1).
- **Not Lihu-free.** Lihu's task list is now nine items long. The work is real — the autonomous Gin moved everything that could move without him, but the things that need him are the next bottleneck.

## When to invoke this protocol

- **Long-horizon work** (overnight, multi-day) where the human can't iterate every slice.
- **Well-bounded scope** (a feature track, not "improve the codebase").
- **Existing R&D / SYNTHESIS / recommendation** as the upstream — the autonomous Gin needs a click to start from. Cold "go figure out what to ship" is not autonomous-vibe; that's R&D.
- **Yohai (or equivalent audit voice) available** — the protocol needs the conscience.

## When NOT to invoke

- **Architecture/product calls** that aren't already settled. The autonomous Gin can ship past tactical dilemmas with z091's "lean unless one fires hard," but strategic dilemmas need the human.
- **No upstream click.** Without a SYNTHESIS to operate against, the orchestrator's path-selection is too high-variance.
- **Without Yohai.** The orchestrator-conscience needs to be external to the orchestrator, otherwise drift goes uncaught.

## Shipping target — what the human sees on return

DEMO.md is the front door. Three phases:
- Phase 0: generate `TOKEN_ENCRYPTION_KEY` (one openssl command).
- Phase 1: register UseGin Slack app, set bot token, run `dx slack post "hi"` → message lands in #usegin.
- Phase 2: register AskEffi-Slack app (distinct), set OAuth + signing-secret, demo the customer flow (workspace OAuth → project channel-bind → unbind).

If Lihu does Phase 0 + Phase 1, the UseGin demo works in ~10 minutes. Add another ~15 minutes for Phase 2 and the customer demo works too.

That's the click of the night.
