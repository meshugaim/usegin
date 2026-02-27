### 2026-02-25 — test mock isolation refactor (ENG-2081)
**Verdict:** partially followed
**Collapse events:** 3
**Key observations:**
- Liaison Read `system-prompt.test.ts` directly (261 lines) to decide whether step 3 needed fixing. Arguably justified — quick decision, not implementation exploration — but the skill says delegate.
- Liaison ran Grep twice to scope steps 5-6 (find files mocking `next/navigation` and `next/link`). These are scoping queries the skill says to delegate to Explore agents.
- Verification agents were **not used**. Liaison ran `bun test` directly via Bash after each step instead of spawning a verifier. This skipped the verification-as-delegation pattern entirely.
- DoD was stated out loud for steps 1-2 but not for steps 5-6. Steps 5-6 had verification criteria embedded in the sub-agent prompt but weren't declared as a separate DoD before delegating.
- Commit discipline was strong — all 5 commits by liaison, small, frequent, Linear-referenced, pushed after all passed.
- Autonomy calibration was skipped (no AskUserQuestion). User gave clear instructions that functioned as implicit calibration. Liaison did check in when skipping steps 3-4, which was good.
- Sequential execution was strict and prevented integration issues.
- Sub-agent prompts included all guardrails (orient, spinning, escalate, no commit).
**Suggestions:**
- For "should I skip this step?" decisions, a 1-line Grep is more proportionate than spawning an Explore agent. Consider whether the "never Grep/Glob" rule should have a carve-out for scoping queries (< 3 tool calls) vs. implementation exploration.
- Verification agents add value when DoD is non-trivial. For "did tests pass?" the liaison running `bun test` directly is faster and arguably clearer. Consider distinguishing "empirical verification" (tests, lint — liaison can check directly) from "judgment verification" (code quality, pattern adherence — needs a verifier).
- State the DoD out loud for every slice, not just the first ones. It's easy to skip as momentum builds.
