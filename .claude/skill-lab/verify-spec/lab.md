# verify-spec — Skill Lab

## Intent

The verify-spec skill systematically checks a completed implementation against its spec's acceptance criteria — through automated test verification and manual browser testing via sub-agents. It exists because implementation sessions self-verify at the slice level, but nobody checks the assembled feature against the original contract.

This is the last stage of the pipeline: `writing-specs` → `slicing-specs` → `implementing-specs` → **`verify-spec`**. It answers: "does the implementation actually meet the spec?"

Success means: every acceptance criterion gets a clear verdict (pass/fail/blocked), failures are filed as traceable bug issues, and the parent spec issue has a verification record that enables re-verification after fixes.

## Retro Perspective

Single perspective: **verification discipline**. The question is: "did the agent systematically verify every criterion using the right methods?" — not "was the implementation correct?" (that's the implementation's problem, not the verifier's).

---

## Success Signals

### Orient

- [ ] Spec was read — all acceptance criteria and verification expectations identified
- [ ] Slice status was checked — all slices confirmed Done before proceeding
- [ ] Verification mode was confirmed with user (all vs failed-only)
- [ ] Verification checklist was built with AC-IDs for tracking
- [ ] Cross-slice criteria were identified and marked for last

### Classification

- [ ] Each criterion was classified using the spec's verification expectations (automated / manual / both)
- [ ] Classification was presented to the user for approval before proceeding
- [ ] The spec's test levels were respected (not downgrading integration-db to unit, etc.)

### Automated Verification

- [ ] Tests were actually run, not just assumed to pass
- [ ] Test existence was checked — not just "tests pass" but "tests exist for this criterion"
- [ ] Test level was checked — spec says integration-db, verify it's actually an integration test
- [ ] Results were recorded per criterion (pass / fail: missing / fail: failing / fail: wrong level)

### Manual Verification

- [ ] Sub-agents were used for browser verification (not skipped)
- [ ] Sub-agents were run sequentially (not parallel — single browser instance)
- [ ] Each sub-agent received clear criteria with AC-IDs
- [ ] Sub-agent prompts included auth setup, environment URL, and `manual-testing-by-agent` reference
- [ ] Criteria were grouped sensibly into verification missions (shared page/flow/setup)
- [ ] Sub-agent results were collected and recorded against the checklist

### Reporting

- [ ] Every AC got a verdict — none silently skipped
- [ ] Verification summary was presented to the user in the structured format
- [ ] Cross-slice criteria were verified last, after per-slice criteria
- [ ] Failed criteria have bug issues filed in Linear under the spec's parent
- [ ] Bug issues include: expected behavior, actual behavior, evidence, reproduction steps, AC traceback
- [ ] Parent spec issue was updated with a verification table (criterion / result / issue link)

### Completeness

- [ ] No criteria were left as "TODO" or "will check later"
- [ ] Blocked criteria were reported with reasons (not silently dropped)
- [ ] Feature toggles were enabled before testing (when applicable)
- [ ] Re-verification mode correctly targeted only previously-failed criteria

---

## Retro Guide

**Context sources:** Read the session transcript. Also check Linear for the verification record on the parent spec and any bug issues filed.

```bash
plan show <spec-issue-id> --tree   # Spec + verification section + bug issues
```

Evaluate in this order:

1. **Check completeness** — Count the spec's acceptance criteria. Count the verdicts in the verification report. Do they match? Any criteria silently dropped? This is the most important check — an incomplete verification is worse than a failed one because it gives false confidence.

2. **Check classification** — Did the agent use the spec's verification expectations to choose methods? Or did it default to manual-only / automated-only? Look for downgrades: spec says "integration-db" but agent only checked unit tests. Look for skips: spec says "manual + visual" but agent skipped the browser verification.

3. **Check automated rigor** — Did the agent actually run tests, or just grep for test files and assume they pass? Did they check test *level* (is the integration test actually hitting the DB, or is it a unit test with mocks)? Did they verify test *coverage* (does this test actually test the criterion, or is it tangentially related)?

4. **Check manual rigor** — Were sub-agents properly prompted? Did they get specific criteria (not "go check the app")? Were results collected with evidence (screenshots, console output)? Did the sub-agents follow the verification protocol (snapshot before/after interactions)?

5. **Check bug quality** — For failed criteria: were bug issues filed? Do they have reproduction steps, evidence, and AC traceback? Could another agent pick up the bug issue and understand what's wrong? A verdict of "FAIL" without a filed bug issue is incomplete.

6. **Check Linear hygiene** — Was the parent spec updated with a verification table? Could someone looking at the spec issue understand the current verification state without reading the session transcript?

### Collapse Events

| Collapse | What it looks like |
|---|---|
| **Checklist skip** | Agent starts verifying without building the AC checklist — loses track of which criteria have been checked |
| **Method shortcut** | Agent skips manual verification entirely ("tests pass, so it works") or skips automated checks ("I'll just look at it in the browser") |
| **Silent drop** | Criteria disappear between classification and the final report — fewer verdicts than criteria |
| **Bug skip** | Agent reports failures but doesn't file bug issues — findings aren't durable |
| **Blind pass** | Agent marks criteria as "pass" based on test file existence without running them or checking coverage |

---

## Known Limitations

- **Sub-agent quality is hard to assess.** The retro agent sees the sub-agent's prompt and returned results, but not the sub-agent's internal process. If results seem thin ("AC-5: PASS" with no evidence), that's worth noting but may not indicate a problem.
- **Test level verification is judgment-based.** Whether a test is "really" an integration test vs a unit test with mocks requires reading the test code. The retro agent may need to spot-check rather than verify every test.
- **Feature toggle state is fragile.** If the agent forgot to enable a toggle, all manual tests could silently test the wrong state. This is hard to detect from transcripts alone — look for toggle-related commands in the session.
- **Environment setup issues are not the skill's fault.** If the agent spent 30 minutes debugging `just agent-dev`, that's an environment problem, not a skill problem. Note it but don't count it as a collapse.

## Ideas / Notes

- No verify-spec runs have been retroed yet. This lab was created proactively as part of the full pipeline lab setup.
- **Pipeline retro:** This is the last stage. Its retro findings often point upstream: "AC-5 failed because the spec was ambiguous about the expected behavior" → writing-specs issue. "The test level said integration-db but the implementer wrote a unit test" → implementing-specs issue. The verify-spec retro is uniquely positioned to surface cross-pipeline problems.
- **Re-verification loop:** verify-spec → file bugs → implementing-specs fixes bugs → verify-spec (failed-only). This loop isn't explicitly tracked anywhere. Consider whether it needs its own evaluation — e.g., "how many re-verification cycles did this spec need?"

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-03-12 | Lab created with verification discipline perspective | Complete the pipeline lab coverage: writing-specs → slicing-specs → implementing-specs → verify-spec. |
