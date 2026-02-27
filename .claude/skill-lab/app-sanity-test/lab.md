# Skill Lab — app-sanity-test

## Intent

The app-sanity-test skill orchestrates interactive sanity testing against any environment (local, staging, production) using playwright-cli and sub-agents. The main thread handles environment selection, change analysis, auth, and test planning. Opus sub-agents do the actual browser work — sequentially, one at a time.

Success means: the user gets a clear pass/fail signal on core app health, deeper exploration covers recent changes, bugs are surfaced with enough detail to act on, and the whole thing runs without the user needing to babysit.

The skill is NOT a test framework. It's a structured manual-testing workflow with human checkpoints (environment choice, auth help, test area selection) and autonomous execution (sub-agents drive the browser).

## Success Signals

- [ ] **Environment asked first** — user chose the environment before any navigation happened
- [ ] **Recent changes surfaced** — git log diff shown to the user, appropriate to the environment (staging vs production, main vs staging, etc.)
- [ ] **Auth handled cleanly** — checked existing state validity before loading, didn't load expired tokens, saved state after successful sign-in
- [ ] **Never loaded expired auth** — used `auth-check` before `state-load`; skipped straight to fresh sign-in when expired
- [ ] **Basic sanity ran first** — Phase A (workspace, project, chat, navigation) completed before deeper exploration
- [ ] **Basic sanity was a gate** — if Phase A failed, deeper exploration was skipped (or user was consulted)
- [ ] **Deeper areas proposed from changes** — test areas were informed by the git diff, not generic
- [ ] **User approved test areas** — used AskUserQuestion (multi-select) before spawning Phase B agents
- [ ] **Sub-agents ran sequentially** — never spawned multiple browser-testing agents in parallel
- [ ] **Sub-agents got complete context** — each agent received: environment URL, auth file path, testing mission, playwright-cli reference, testing loop instructions
- [ ] **Snapshot-before-interact discipline** — sub-agents snapshotted before every interaction (observable from agent prompts)
- [ ] **Report delivered** — final summary with pass/fail per check, observations, and bugs
- [ ] **Bugs filed** — obvious bugs were created as Linear issues (or flagged to user)
- [ ] **Feature toggles respected** — tested default toggle path, didn't chase features behind off-by-default toggles
- [ ] **Auth state saved** — after successful sign-in, state was saved for reuse

## Known Limitations

- **Single browser instance** — sequential sub-agents are slow. A full sanity test (basic + 4 deeper areas) can take 20-30 minutes of wall time.
- **No programmatic pass/fail** — sub-agents report findings in prose. There's no structured test result format.
- **Auth is fragile** — magic links expire, rate limiting is real, and the skill has a detailed auth flow because getting it wrong is painful.
- **Sub-agent snapshot discipline is trust-based** — the skill tells agents to snapshot before interacting, but there's no enforcement mechanism.
- **Change-to-test mapping is manual** — the skill surfaces recent changes, but mapping "what changed" to "what to test" is left to the main thread's judgment.
- **No regression tracking** — findings from one sanity test don't carry forward to the next. Each run starts fresh.

## Retro Guide

### 1. Check orchestration discipline
Did the main thread stay in the orchestrator role? It should handle: environment selection, git diffs, auth, test planning, sub-agent spawning, and final reporting. It should NOT drive the browser directly (except during auth setup, which is explicitly part of the main thread's role).

### 2. Check auth flow
Was the auth flow clean? Specifically:
- Was `auth-check` called before `state-load`?
- If expired, did it skip straight to fresh sign-in (no loading stale tokens)?
- Was auth state saved after successful sign-in?
- For staging/production: was the user asked for their email and the magic link?

### 3. Check change analysis
Were recent changes surfaced to the user? Was the git diff appropriate for the environment? Did the deeper test areas connect to the actual changes?

### 4. Check sub-agent sequencing
Were sub-agents spawned one at a time? (Parallel browser agents conflict on the single playwright-cli instance.) Did each agent get a focused mission with the right context?

### 5. Check gating
Did basic sanity run first? If it failed, was deeper exploration gated? If it passed, were deeper areas proposed and approved by the user?

### 6. Check reporting quality
Was a final summary delivered? Did it cover: pass/fail per basic sanity check, observations from deeper exploration, bugs with enough detail to act on? Were obvious bugs filed in Linear?

### 7. Check sub-agent prompt quality
Did sub-agent prompts include: environment URL, auth file path, specific testing mission, playwright-cli reference, snapshot-before-interact instruction? Were prompts focused (one area per agent) or overloaded?

## Ideas / Notes

- **Structured test results** — sub-agents return prose. A structured format (JSON? markdown table?) would make reporting more consistent and enable cross-session comparison.
- **Auth helper script** — the auth flow is the most complex part of the skill. A dedicated `sanity-auth` CLI tool could handle the check-load-or-refresh cycle.
- **Regression carry-forward** — could a "known issues" file persist between sessions so the next sanity test knows what to skip or re-verify?
- **Cost tracking** — sub-agents are Opus. A 4-area deep exploration can burn significant tokens. Worth tracking cost per sanity test to calibrate depth.

## Changelog

| Date | Change | Motivation |
|------|--------|------------|
| 2026-02-26 | Created lab file | First retro request for this skill |
| 2026-02-27 | Restructured lab: split retros into individual files under `retros/` | Single-file lab structure doesn't scale as retros accumulate. |
