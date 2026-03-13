### 2026-03-13 — Session 0e981c2b (ENG-2581: Linear project scoping + config modal)
**Verdict:** partially followed
**Collapse events:** 1

**Key observations:**

- **Orient: pass (with waste).** Agent read `plan show ENG-2004 --tree`, identified ENG-2581 as next slice, explored ~15 codebase files. BUT: 4 rewinds during orient burned significant context. Files were read via `cat` commands instead of the Read tool, and exploration was unfocused — agent read the entire integration surface (Python API, Next.js actions, experiments, migrations, OAuth callback, config page) before narrowing to the slice. The orient phase primes the agent to think about implementation, not tests. By the time orient is done, the agent has a complete mental model of WHAT to build and HOW — making TDD psychologically harder because the implementation is already "obvious."
- **TDD: collapse.** Zero tests written before implementation. Agent wrote Python API endpoints, server actions, and the React modal component in sequence, then added 5 unit tests for `list_projects` at the end. The pre-commit TDD gate (installed by auto-implement) SHOULD have blocked commit `d5289983` (5 implementation files, 0 test files), but the commit went through. Either the hook wasn't active or it errored silently. This is the **second consecutive TDD collapse** on ENG-2004 — session c66968de (ENG-2580) had the identical pattern.
- **Root cause of TDD failure:** The hook can only enforce "tests exist at commit time" — not "tests were written first." Even when working, the agent can game the gate by writing implementation, then tests, then committing together (which is what happened in the second commit `d379ea54`). More fundamentally, the implementing-specs skill's orient phase creates 400+ lines of context about HOW to implement before the TDD step arrives. The agent has already mentally committed to implementation by then.
- **Slice discipline: pass.** Only one slice attempted. Committed and pushed. Scope stayed within ENG-2581 boundaries.
- **Self-verification: partial.** Build compiled (TypeScript + Next.js). Python unit tests passed (full suite). But ~10 turns wasted polling background tasks with `sleep 30 && cat` patterns instead of waiting for notifications. No endpoint was hit, no UI was checked. Verification was "tests pass + build compiles" only.
- **Background task polling anti-pattern:** Agent ran `bun run build` and `tsc --noEmit` in background, then burned ~10 turns on `sleep 30 && cat /tmp/.../tasks/XXX.output` polling loops. The system sends automatic notifications when background tasks complete. Root cause: the implementing-specs skill doesn't describe async verification workflow. Agent has nothing to do while waiting, so it polls.
- **Linear hygiene: pass.** `plan start ENG-2581` called. `plan close ENG-2581` called. Parent issue updated with comment. Remaining slices documented in handoff.
- **Context management: pass.** `cctx` checked at 65.2%. Correctly decided not to start a new slice. Handoff written with precise slice state.
- **Communication: N/A.** Headless session via auto-implement.
- **Commit discipline: partial.** Two commits: first was implementation-only (5 files, +849 lines, no tests), second was remaining changes + tests. The first commit should have been blocked by the TDD gate. `git add -A` was attempted initially but self-corrected to specific file adds.

**Collapse events:**
1. **TDD skip** — All implementation written before any tests. Pre-commit TDD gate failed to block.

**Suggestions:**
- **TDD hook didn't fire:** Investigate why commit `d5289983` passed the pre-commit gate. Check whether `installHooks` in lifecycle.ts actually executed, and whether the hook file existed at commit time. Reproduce the scenario in isolation.
- **TDD ordering can't be enforced at commit time:** The hook checks "are test files staged?" but not "were tests written before implementation." A more structural approach: a PreToolUse hook that tracks file creation order within the session and blocks implementation files if no test file has been created/edited yet. Alternatively, restructure the implementing-specs skill so the first mandatory code action after orient is creating the test file — make it the entry point, not a sub-step.
- **Orient primes implementation, not testing:** The orient phase builds a complete implementation mental model (which files to change, what patterns to follow, what the API shape is). This makes TDD feel like a formality. Consider splitting orient into two phases: "understand the domain" (spec, slices, risks) and "design the tests" (what should be tested, at what level, what test file to create). The second phase would naturally lead into writing tests first.
- **Background task polling:** Add to the skill: "Run verification commands synchronously when you have nothing else to do in parallel. Only use background tasks when you can continue other work while waiting."
