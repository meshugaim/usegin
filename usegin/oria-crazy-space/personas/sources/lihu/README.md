# Sources — Lihu

Primary-source evidence anchoring `../../lihu.md`. Quotes verbatim from
session JSONLs in `~/agent-records/lihub/` (per memory
`reference_agent_records.md`, persists via conversation-watcher) and from
git history.

## Session excerpts

### S1 — `lihub/2026-04-13/084235-conversation-b394484d-201f-4a62-bfec-4b2ede51e32a.txt`
Session ID: `b394484d-201f-4a62-bfec-4b2ede51e32a`. Topic: finding a
remote session archive.

> **Lihu:** "hey Claude."
> **Claude:** "Hey! What's up?"
> **Lihu:** "Can you find session edee908f? Not in this environment, in
> another environment, but you should be able to use the Session CLI with
> the remote option to find it, I hope."
> ...
> **Claude:** [searches, reports nothing]
> **Lihu:** "No, there is also another archive, another repo, in which we
> currently save JSONL.gz."
> ...
> **Lihu:** "search for jsonl.gz / where are they saved?"
> ...
> **Lihu:** "it exists. **search with conviction**."

Anchors: opening style ("hey Claude"); two-line correction ("No, there is
also…"); the *search-with-conviction* directive — held position when
agent declared "I'm out of places to look," which forced 178-repo
enumeration.

### S2 — `lihub/2026-04-09/...txt`
Topic: ntfy notification skill design + Fathom integration hardening.

> "I work with several agents in parallel. Moreover, sometimes I get up
> from my computer and walk away. Many times an agent is actually waiting
> for me for something. When it happens, I want to unblock the agent as
> quickly as possible…"
>
> "Let's see what you built. **Have you tried it yourself in the local
> environment? In general, things are not done unless we verify them and
> stress test them.**"
>
> "**Wait a second before we continue.** We just saw that disconnecting
> has a bug, right? It didn't really soft delete everything it was
> supposed to. **Let's harden this first.**"
>
> "**Are you using the interactive dev skill?** You were supposed to be
> more thorough when using this skill."

Anchors: walks-around-with-multiple-agents pattern; stress-test bias;
harden-when-spotted; meta-skill awareness ("are you using the skill
properly?").

### S3 — `lihub/2026-04-17/130009-conversation-5f58d012-4874-4c7d-9386-56922216ea39.txt`
Topic: ENG-5009 MCP-tool param rename (drive_file_id → file_id).

Sets liaison + companion + tdd-ci, agent presents three-phase plan and
asks "Want me to go?" → Lihu: "yes" — full-trust dispatch when the plan
is sharp.

### S4 — `lihub/2026-04-13/092536-conversation-7793b6ec-b429-4098-a6b9-4a85ea8e1d67.txt`
Topic: dep-audit security failures.

> "investigate using 'fix-bug'"

Anchors: terse skill-invocation directive style; expects skill
invocation + skill-internal flow.

### S5 — Fathom hardening sessions
Multiple sessions across `lihub/2026-04-09/`. Lihu walking around,
Guy-in-prod context, "post-connect feels slow and heavy, causing the
user to wait for the system, to do actions without knowing if the
system actually received them." Dispatches `interactive-dev` skill,
walks away, returns to verify.

### S6 — Wispr-pour evidence
Across all sessions: Hebrew "yalla", signature "bn" terse-ack, Wispr
mid-sentence drift (z016), `_underscore_brackets_` (z004),
language-mixing (HE/ES/EN per `reference_team_languages.md`).

## Commits — doctrine + corrections

```
4628f9604 gin: add Memento doctrine + Friends-and-enemies posture
c16fbf7e6 docs(claude-md): split Philosophy into Work + Conversation, add Mode dispatcher
4166c0675 usegin: standalone-repo CLAUDE.md per sub-app
32e0cfa1a zettels: z086 process-over-outcome + z087/z088 pour-and-process + z090 wispr corrector
eb1459858 zettel(z020) + wispr(settled): decision-shape-in-claude-md
b211ee013 fix(slack-unified): post-review — permalink validation, exception chain, thread-permalink
36cafe4ed close: surface-write to feature board is mandatory, not optional
8a97a8110 qa-team + persona-lab/team-lab + !question parking primitive
11c884afe tikur: read "why" as honest question, not critique — z106 + memory + record
```

(Note: Lihu writes under `lihub <lihu.berman@gmail.com>` for human commits;
many under `oria masas <oria-ai@users.noreply.github.com>` are
Lihu-driving-Gin autonomous commits routed through the Oria handle.
See z109/feedback memory entries.)

## Zettel cross-refs (Lihu-authored or Lihu-triggered)

z002 (no later), z003 (open-to-empty), z004 (underscore-brackets),
z015 (pre-game manual), z016 (mid-sentence drift), z020 (decision shape),
z022 (two faces), z023 (cost-not-the-gate), z027 (best every turn),
z032 (laconic), z037 (place-for-everything), z086 (process-over-outcome),
z087 (pour-and-process Lihu), z088 (pour-and-process Oria too),
z106 ("why" as honest question), z109 (partial-tikur is unfixed),
z110 (humans are about what / Gin is about how),
z111 (measure claude effort/energy/temperature/vibe).

## Memory cross-refs (Lihu corrections, mined)

`feedback_be_laconic.md`, `feedback_no_later.md`, `feedback_friction_loop.md`,
`feedback_dont_jump_to_conclusions.md`, `feedback_one_off_errors_no_speculation.md`,
`feedback_first_place_we_looked.md`, `feedback_why_is_honest_question.md`,
`feedback_signal_to_noise.md`, `feedback_concise_answers.md`,
`feedback_investigate_sooner.md`, `feedback_grep_jsonl_directly.md`,
`feedback_no_speed_language.md`, `feedback_companion_session_findings.md`,
`feedback_phase_separation.md`, `feedback_two_tier_discipline.md`.

## Authored doctrine (read as primary source)

- `usegin/Gin.md`
- `usegin/CLAUDE.md`
- `usegin/personas/README.md`
- `usegin/personas/zisser.md`
- `usegin/cage/README.md`
- `zisser/zisser.md`, `zisser/principles/01..06`
- `zisser/CLAUDE.md`
