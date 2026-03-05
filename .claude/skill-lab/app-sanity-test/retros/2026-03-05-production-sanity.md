### 2026-03-05 — Production sanity test
**Verdict:** worked well
**Collapse events:** 0
**Key observations:**
- [x] Environment asked first — AskUserQuestion, user chose Production
- [x] Recent changes surfaced — `git log origin/production --since="3 days"` returned 100+ commits. Main thread categorized into key areas (mobile, risk, email, auth, Drive sync) rather than dumping the raw list. Appropriate for production.
- [x] Auth handled cleanly — `playwright-cli kill-all` → `auth-check` → expired → fresh OTP sign-in → `state-save`
- [x] Never loaded expired auth — checked with `auth-check` first, got "expired", went directly to `/sign-in`. No stale `state-load`.
- [x] Basic sanity ran first — Phase A sub-agent completed all 4 checks before Phase B
- [x] Basic sanity was a gate — 4/4 passed, then proposed Phase B
- [x] Deeper areas proposed from changes — risk UI, mobile responsive, data tab, workspace settings — all mapped to recent production commits
- [x] User approved test areas — AskUserQuestion multi-select. User selected 3 areas and added nuance: "check not the mobile itself, but that every change for mobile didn't affect the web UI." Main thread adapted this into a "Desktop Layout Integrity" test mission — good judgment.
- [x] Sub-agents ran sequentially — 3 Phase B agents, each spawned after the previous completed
- [~] Sub-agents got complete context — each received: environment URL, focused mission, playwright-cli reference, snapshot instructions. **Missing:** auth file path in all prompts, reference to `manual-testing-by-agent` skill. Auth was already loaded in the browser so this wasn't a problem in practice, but the skill says to include it.
- [x] Snapshot-before-interact discipline — present in all prompts ("Always snapshot before interactions")
- [x] Report delivered — summary tables with pass/fail per check, per area, plus overall verdict. Clean and scannable.
- [x] Bugs filed — N/A. No obvious bugs found. Terminology inconsistency (card says "Worsening" vs tooltip says "Escalating") was noted as minor observation but not bug-filed. Reasonable judgment.
- [~] Feature toggles respected — not explicitly addressed in sub-agent prompts. Data tab agent discovered browser flags and toggled "Email Exclusion" to test the feature — slightly beyond "default path" but reasonable for thorough testing.
- [x] Auth state saved — `state-save production-auth.json` immediately after sign-in

**Additional observations:**
- User adapted the proposed test areas with a nuanced request (verify mobile changes didn't break desktop). Main thread translated this well into a focused sub-agent mission with specific "breakage signals" checklist (sidebar as drawer, narrow columns, sheet overlays, hidden elements).
- Sub-agent #1 (risk UI) was thorough — tested tooltips, "Discuss with Effi" flow, verified auto-generated risk prompts are context-specific. High-quality exploration.
- Sub-agent #2 (data tab) explored email management modal, filter dimensions, and source indicators in detail. Good coverage.
- Sub-agent #3 (desktop layout) tested at two viewport widths (1280px and 1440px). PDF viewer was marked N/A with explanation. Thorough.
- The session was efficient — 4 sub-agents total (1 basic + 3 deep), no wasted spawns, clean sequential flow.

**Comparison to 2026-02-26 retro:**
- Previous issue "bugs not auto-filed" — not applicable this time (no bugs found).
- Previous suggestion "sub-agent time budget" — agents took 3-10 minutes each, reasonable. No code-reading drift observed.
- Auth flow improvement: this session used `auth-check` CLI cleanly, and killed stale daemons before opening browser — cleaner than the previous session.

**Suggestions:**
- Include auth file path in sub-agent prompts even when auth is already loaded. The skill is explicit about this, and agents may need it if the browser state resets mid-test.
- Include reference to `manual-testing-by-agent` skill in sub-agent prompts — the skill says to, and it provides useful playwright-cli patterns the agents might not know.
- The "feature toggles respected" signal could use a stronger instruction. The main thread didn't mention toggles in any sub-agent prompt. The Data tab agent happened to discover and toggle flags on its own — this worked out but was unguided.
