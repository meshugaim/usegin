---
id: z090
title: Wispr corrector is unrigged — confirmed by cold-read sub-agent experiment; dictionary is load-bearing but lives outside any auto-applied path
type: zettel
authored-by: usegin
threads: [↑z087, ~z088, ~z078, ~z065, ~z083]
created: 2026-04-27
session: 73e20f04-8572-4b59-8fe9-fa241be758a2
---

## Human side

Lihu, 2026-04-27, paraphrased: *"What you should see is whether the Wispr-flow [corrector] is rigged into a hook or not. And if not, was it only because I happened to be talking? Do some experiment — use another agent, send a message, see if it reads the skill, the vocabulary."*

We did the experiment. Spawned a fresh sub-agent (no priming about Wispr) and gave it the corrupted prompt: *"tell again to settle it about the new dx app principles."*

- **Phase 1 (cold read, no dictionary):** sub-agent interpreted "again" as the temporal adverb and "settle it" as "resolve the question" — coherent-sounding but completely wrong speech act.
- **Phase 2 (auto-loaded context audit):** sub-agent's system prompt + CLAUDE.md + MEMORY.md + `.claude/rules/*` had zero references to Wispr, the corrector, or `again` / `settle it` as corruption candidates.
- **Phase 3 (dictionary read):** sub-agent re-decoded as *"tell **Gin** to **zettleit** about the new dx app principles"* — the actual instruction.

**Verdict: corrector is purely interpretive. Not rigged.** Evidence: no UserPromptSubmit hook (only `dx-his-arm-on-wrapup`), no auto-triggered skill, no CLAUDE.md mention, no memory entry surfacing the dictionary. A sub-agent gets the corrections only if it happens to read the dictionary file.

## UseGin side

Operational consequences:

- **Pour-protocol risk (z087, z088):** the human-pours/Gin-paces cadence depends on Gin understanding the pour. If the pour is Wispr-corrupted and Gin doesn't know to consult the dictionary, the pour gets *coherently misread* — which is worse than a clean error. Phase 1 of the experiment is the proof: the sub-agent didn't doubt itself.
- **Spawned-Gin failure mode:** every time we spawn a sub-Gin (R&D professors, consultants, code-reviewers), they cold-read user-quoted context. None of them know about the dictionary unless their charter says so. The R&D charter template doesn't currently include "consult the wispr-corrector for any user-quoted text" — that's a charter-template gap.
- **Findability gap (z083):** the dictionary is well-placed (`usegin/wispr-flow-corrector/dictionary.md` — grep-friendly, on-tree), but discoverability fails the cold-land test. A future Gin landing in a session with corrupted input won't know to look. The fix lives upstream — auto-load via memory or hook, not "remember to read it."
- **The hook design will need to be careful.** The dictionary mixes always-rules (`settle → zettel`), context-dependent rules (`Cloud → Claude OR UseGin`), and explicit non-substitutions (syntactic conventions z004, mid-sentence drift z016). v0 hook should only auto-apply the *always* rules; surface candidates for the others as `additionalContext` rather than rewriting the prompt. Don't lose the original.

This zettel is the friction record (z009 friction loop). The fix lands in the enhancement phase — it's a real piece of work, not a one-line tweak.
