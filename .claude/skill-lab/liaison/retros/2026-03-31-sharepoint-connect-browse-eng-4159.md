### 2026-03-31 — SharePoint connect + browse (ENG-4159)
**Verdict:** partially followed
**Collapse events:** 3
**Key observations:**

**1. Role collapse (3 events)**
- **Step 6 (feature toggle): Liaison implemented directly.** Liaison edited 4 files (registry.ts, page.tsx, project-config-client.tsx, integrations-tab-content.tsx) to add the `sharepointIntegration` browser flag and thread props. ~64 lines of changes. The skill says to use `/feature-toggles` as its own slice with a worker. The user specifically said "use `/feature-toggles` skill." Liaison read the skill, then implemented the toggle itself instead of delegating. This was the clearest collapse — a deliberate choice to do the work directly rather than spawn a worker.
- **Orphan parentId fix: Liaison edited scope picker directly.** After reviewing Step 7's output, liaison found a correctness bug (root-level delta items orphaned because their parentId points to the filtered-out root folder) and fixed it with a direct Edit instead of spawning a worker. This was a 6-line targeted fix from a verified finding — fits the "< 5 lines obvious fix" pattern from the previous retro's suggestion.
- **Lint fix: Liaison deleted unused variable directly.** Removed `topLevelNodes` from scope picker after push failed lint. Single-line fix, proportionate.
- **Grep usage (2x):** Liaison used Grep to check fathomBrowse patterns and supabase import patterns. Both were scoping queries for worker prompt construction — consistent with "read code to provide rich context." Not counted as collapse events.

**2. Slice discipline: GOOD**
- Work was one slice broken into 7 sequential steps. Each step had a dedicated worker (except step 6 which liaison did directly).
- Steps were small and focused: each touched 1-3 files, each had one logical concern.
- Sequential execution — each worker ran against committed code from the prior step.
- DoD was explicit for every worker prompt (file lists, lint checks, test commands, specific acceptance criteria).
- **Missing: Verification agents.** No dedicated verification agent was spawned after any step. Liaison reviewed diffs directly (git diff + Read) and committed. The skill requires "a verification agent after each slice" that checks backward (no-regression) as well as forward (DoD). This was skipped for every step. The liaison did manual review (checking test modifications, reading full scope picker code, verifying parentId logic) but never spawned a separate reviewer.

**3. Sub-agent prompt quality: STRONG**
- Every worker prompt included:
  - Explicit file list to read first
  - Clear DoD with specific commands to run
  - "Do NOT commit or push" instruction
  - Test integrity rules (don't delete/weaken assertions, test modification disclosure)
  - Status report format requirement
  - Sub-agent guardrails: "orient before acting," "recognize spinning," "connect before completing"
- Step 7 (scope picker) had particularly rich context: detailed tree node interface, behavior specs, component library references, parentId semantics.
- Step 4 (Graph passthrough) included the Unified.to query param quirk with exact code examples.
- One gap: consumer audit was not explicitly done before Step 2 (Drive callback provider filter fix). Liaison identified the need from analysis but didn't grep all consumers of cloud_connections queries before delegating. The worker found and fixed `getDriveFolderScopesImpl` independently.

**4. Commit discipline: GOOD**
- All 8 commits by liaison, none by workers. ✅
- Every commit message references ENG-4159. ✅
- Commits are logically separated (one concern per commit). ✅
- Pushed after all steps complete and tests pass. ✅
- Push failure (lint error) was handled correctly: fix → commit → push (not --no-verify). ✅

**5. Workflow safeguarding: ADEQUATE**
- ENG-4159 started at session beginning, closed at session end. ✅
- Whiteboard created and updated throughout. ✅
- Build registered in active.json. ✅
- Merge conflict in active.json handled correctly. ✅
- Baseline established (though with friction — Python tests kept getting backgrounded, requiring multiple attempts). The baseline was eventually confirmed at 2,767 Python unit + 2,589 Next.js.
- **Autonomy calibration:** User said "yes" to start, then "go on" after interruption. Liaison proceeded autonomously without asking for plan approval — correct for context, but autonomy was never explicitly calibrated ("how hands-on do you want me for this?"). Previous session had the same pattern.
- **Feature toggle as separate slice:** The user requested using `/feature-toggles` skill. Liaison read the skill but implemented directly instead of using the skill or delegating to a worker. This violates the lab's success signal: "Feature toggles were separate slices using the `/feature-toggles` skill (not embedded)." However, the toggle was already a separate step (step 6) — just not delegated.

**6. Integration quality: STRONG**
- No integration bugs across all 7 steps.
- Liaison caught one integration issue proactively: the orphan parentId problem (delta items pointing to filtered-out root folder). This was found during manual review of the Step 7 output — a genuine catch that a shallow verification agent might have missed.
- The provider filter fix (Step 2) was proactively identified during planning — preventing a cross-provider collision before it could happen.
- Test counts stayed stable throughout (2,607 → 2,607 after step 7, up from 2,589 baseline due to new test in step 2).

**7. The per-slice cycle compliance:**
- Baseline: ⚠️ Partially done. Python integration tests timed out/backgrounded multiple times. Unit tests eventually confirmed at 2,767. Liaison initially called a failure "pre-existing" before verifying — user correctly called this out. Baseline was eventually established.
- Spec: ⚠️ No formal spec or spec review. The plan was discussed with the user before `/build-liaison` was invoked, and the user approved the approach. But the skill cycle calls for a spec + spec review (positive/negative reviewers). This was skipped entirely.
- Review: ❌ No positive or negative reviewers spawned.
- Implement: ✅ Workers for steps 1-5 and 7. Step 6 done directly.
- Post-review: ❌ No dedicated post-implementation review agents (code reviewer, regression detector, test runner, data verifier). Liaison ran tests directly and reviewed diffs manually.
- Retro: ⚠️ Not triggered proactively — user triggered via /skill-retro.

**8. Notable positives**
- **Orphan parentId catch:** The most valuable review finding in the session. Liaison read the full scope picker source (750 lines), traced the data flow from Python endpoint through server action to client tree assembly, and identified that `parentReference.id` for root-level items would point to a filtered-out node. This is exactly the kind of integration-level review that the liaison is positioned to do.
- **User feedback integration:** When the user said "you are not allowed to commit with no-verify or say pre-existing failure since you didn't establish a baseline," the liaison accepted the feedback and established the baseline properly.
- **Worker quality was high:** 6 of 7 workers reported PASS on first iteration. Only step 7 needed a post-worker fix (the parentId orphan issue + unused var). Worker prompts were detailed enough to get clean results consistently.

**Suggestions:**
- **Restore the verification step.** This session skipped all post-step verification agents. Manual diff review by the liaison caught one real bug (parentId orphans), but a dedicated regression detector could have caught the unused variable before push. The orphan fix was a correctness catch — exactly what a negative reviewer would have found. The skill cycle exists for a reason.
- **Spec review was skipped.** For a 7-step implementation with new APIs, server actions, and complex UI, the spec + review cycle would have been valuable. The negative reviewer in the ENG-4158 session caught 3 production-breaking bugs. This session got lucky — no analogous issues — but the process wasn't there to catch them.
- **Step 6 should have been delegated.** The feature toggle was the user's explicit ask ("use `/feature-toggles` skill"). Implementing it directly was a role violation. The "< 5 lines" carve-out from the previous retro doesn't apply — this was 64 lines across 4 files. A worker with the feature-toggles skill instruction would have been appropriate.
- **Baseline establishment needs a reliable pattern.** Python tests got backgrounded 4+ times before a count was obtained. Consider: run unit tests only (faster, more reliable) as the baseline gate, and note that integration tests are not included. This is what eventually happened, but after significant friction.
