### 2026-02-26 — Production sanity test (post-deploy)
**Verdict:** worked well
**Collapse events:** 0
**Key observations:**
- [x] Environment asked first — AskUserQuestion, user chose Production
- [x] Recent changes surfaced — `git log origin/production..origin/staging` + `--since` for production commits. Presented clearly.
- [x] Auth handled cleanly — `auth-check` → expired → fresh magic link sign-in → state-save
- [x] Never loaded expired auth — checked first, skipped straight to `/sign-in`
- [x] Basic sanity ran first — Phase A sub-agent (4 checks) completed before deeper exploration
- [x] Basic sanity was a gate — 4/4 passed, then proposed Phase B
- [x] Deeper areas proposed from changes — admin conversations, drive, file management, navigation — all mapped to recent production deploys
- [x] User approved test areas — AskUserQuestion multi-select, user chose all 4
- [x] Sub-agents ran sequentially — each spawned after previous completed
- [x] Sub-agents got complete context — URL, auth file, focused mission, playwright-cli reference, snapshot instructions
- [x] Snapshot-before-interact discipline — present in all prompts
- [x] Report delivered — summary table with pass/fail, observations, bugs
- [ ] Bugs filed — bugs reported to user but not auto-created as Linear issues. User moved to fixing instead. Skill says "create Linear issues automatically for obvious bugs" — this was skipped.
- [x] Feature toggles respected — drive toggle noted as off-by-default, tested connect UI without chasing full modal flow
- [x] Auth state saved — `state-save production-auth.json` immediately after sign-in

**Additional observations:**
- Timeframe question: user answered "gap from last push" which wasn't a standard option. Main thread adapted well — checked both staging-vs-production diff and recent production commits.
- Sub-agent #3 (file management) took ~15 minutes — it went deep, reading source code to verify excluded-file differentiation. This crossed from "testing" into "code review" territory, which was actually useful (found the bug) but not what the skill intends.
- Sub-agent #2 (drive) also read source code when no active Drive connections existed in production. Reasonable adaptation to verify deployed features even when untestable via UI.

**Suggestions:**
- Auto-file Linear issues for bugs found during sanity test — the skill explicitly says to, but the main thread offered instead of doing it. Consider making this a stronger instruction.
- Consider a sub-agent time budget (e.g., 5-7 min per area). The file management agent took 15 minutes because it started reading source code. A time hint in the prompt would encourage staying in the browser.
- When a feature can't be tested via UI (e.g., no Drive connections), the sub-agent prompt could say "report as untestable" rather than encouraging code-level verification.
