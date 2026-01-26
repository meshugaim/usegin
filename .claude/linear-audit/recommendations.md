# Linear Issues Audit Report

Audit of open Linear issues against git history to identify resolved-but-not-closed issues.

Generated: 2026-01-26

## Recommend Close

Issues that appear to be completed based on git history and code state.

| Issue | Title | Evidence | Confidence |
|-------|-------|----------|------------|
| ENG-223 | gfs: file type support | Description says "Completed" with all tasks checked, all sub-issues Done | High |

## Maybe Done

Issues that might be done but need human verification.

| Issue | Title | Evidence | Notes |
|-------|-------|----------|-------|
| ENG-137 | dev-env: extend session to identify active sessions | All 3 sub-issues marked Done | Parent might be closable if sub-issues cover scope |
| ENG-232 | agent: session continuity (persist ClaudeSDKClients) | Git shows extensive client pool work (50a8a1b8, f647507e, 478a98be) | Has sub-issues ENG-983, ENG-996 still open - check if core done |

## Needs Deeper Look

Issues where the evidence is ambiguous or requires more investigation.

| Issue | Title | Observations |
|-------|-------|--------------|

## Still Open

Issues that show no evidence of completion in git history.

| Issue | Title | Status |
|-------|-------|--------|
| ENG-12 | Extended What did I miss? | Backlog - No clear completion evidence |
| ENG-118 | plan-cli improvements | Parent issue with many Done sub-issues but still open ones (ENG-921, ENG-595, ENG-594, ENG-469, ENG-253) |
| ENG-132 | dev-env: design multi-worktree agentic workflows | Backlog - Design issue, no completion evidence |
| ENG-133 | dev-env improvements | Parent issue with active backlog sub-issues |
| ENG-212 | cli-docs: embedded documentation system for CLIs | Backlog - Feature pending |
| ENG-222 | chat interface: main input field loses focus | Backlog - Bug not addressed |
| ENG-244 | projects: archive projects | Backlog - Feature not implemented |
| ENG-245 | projects: rename project | Backlog - Feature not implemented |

---

## Audit Log

| Issue | Checked | Commits Found | Classification |
|-------|---------|---------------|----------------|
| ENG-12 | 2026-01-26 | 3 (keyword: what did I miss) | OPEN |
| ENG-118 | 2026-01-26 | Many plan-cli commits | OPEN |
| ENG-132 | 2026-01-26 | 0 direct | OPEN |
| ENG-133 | 2026-01-26 | Many dev-env commits | OPEN |
| ENG-137 | 2026-01-26 | Sub-issues Done | MAYBE |
| ENG-212 | 2026-01-26 | 0 direct | OPEN |
| ENG-222 | 2026-01-26 | 0 direct | OPEN |
| ENG-223 | 2026-01-26 | All sub-issues Done, desc says Complete | CLOSE |
| ENG-232 | 2026-01-26 | 5+ client pool commits | MAYBE |
| ENG-244 | 2026-01-26 | 0 direct | OPEN |
| ENG-245 | 2026-01-26 | 0 direct | OPEN |
