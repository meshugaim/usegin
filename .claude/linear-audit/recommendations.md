# Linear Issues Audit Report

Audit of open Linear issues against git history to identify resolved-but-not-closed issues.

Generated: 2026-01-26

## Recommend Close

Issues that appear to be completed based on git history and code state.

| Issue | Title | Evidence | Confidence |
|-------|-------|----------|------------|
| ENG-223 | gfs: file type support | Description says "Completed" with all tasks checked, all sub-issues Done | High |
| ENG-263 | dev-env: add linters and formatters | Biome (nextjs-app/biome.json) + Ruff (python-services) configured, 10+ related commits | High |

## Maybe Done

Issues that might be done but need human verification.

| Issue | Title | Evidence | Notes |
|-------|-------|----------|-------|
| ENG-137 | dev-env: extend session to identify active sessions | All 3 sub-issues marked Done | Parent might be closable if sub-issues cover scope |
| ENG-232 | agent: session continuity (persist ClaudeSDKClients) | Git shows extensive client pool work (50a8a1b8, f647507e, 478a98be) | Has sub-issues ENG-983, ENG-996 still open - check if core done |
| ENG-285 | dev-env: tools inventory/map | Sub-issue ENG-388 Done, `tool` CLI exists and works | Parent may be closable if tool CLI covers scope |

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
| ENG-255 | claude-sessions-ui improvements | Parent with open sub-issues (ENG-337-339, ENG-256-262) |
| ENG-256 | claude-sessions-ui: integration tests fail with auth token | Backlog - Bug not addressed |
| ENG-257 | claude-sessions-ui: show context usage | Backlog - Feature pending |
| ENG-258 | claude-sessions-ui: allow disable MCPs | Backlog - Feature pending |
| ENG-259 | claude-sessions-ui: invoke slash commands | Backlog - Feature pending |
| ENG-260 | claude-sessions-ui: quick actions | Backlog - Feature pending |
| ENG-261 | claude-sessions-ui: support questionnaire tool | Backlog - Feature pending |
| ENG-262 | claude-sessions-ui: smart auto-scroll | Backlog - Feature pending |
| ENG-264 | skill: deploying-to-production | Backlog - No skill file found |
| ENG-279 | safeguarding: incident - Claude pushed directly to production | Backlog - Bug pending |
| ENG-280 | dev-env: agent workflows | Parent with open sub-issues |
| ENG-281 | dev-env: standardize tools/CLIs | Parent with open sub-issues |
| ENG-282 | dev-env: session compacting via session | Backlog - Feature pending |
| ENG-283 | dev-env: session sidecar concept | Backlog - Design pending |
| ENG-284 | dev-env: code review workflow | Backlog - Feature pending |
| ENG-287 | dev-env: dry run options audit | Backlog - Chore pending |
| ENG-288 | dev-env: fzf extensions audit | Backlog - Chore pending |
| ENG-290 | dev-env: VS Code bridge not auto-installed | Backlog - Bug pending |
| ENG-337 | claude-sessions-ui: slow initial session load | Backlog - Bug pending |
| ENG-338 | claude-sessions-ui: project path truncated | Backlog - Bug pending |
| ENG-339 | claude-sessions-ui: sessions lack differentiation | Backlog - Bug pending |
| ENG-426 | Workspace Model v2 | Core slices Done but many enhancement sub-issues open |
| ENG-431 | dev-env: test coverage agent | Backlog - Feature pending |
| ENG-432 | e2e infra improvements | Many Done sub-issues, but still open ones |
| ENG-434 | skill: adapt implementing-specs to plan mode | Backlog - Feature pending |
| ENG-437 | skill: playwright-mcp-first test writing | Backlog - Feature pending |
| ENG-438 | dev-env: Supabase startup fails with missing Docker network | Backlog - Bug pending |
| ENG-441 | e2e: pre-flight check script | Backlog - Chore pending |

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
| ENG-255 | 2026-01-26 | 10+ UI commits but open sub-issues | OPEN |
| ENG-256 | 2026-01-26 | 0 direct | OPEN |
| ENG-257 | 2026-01-26 | 0 direct | OPEN |
| ENG-258 | 2026-01-26 | 0 direct | OPEN |
| ENG-259 | 2026-01-26 | 0 direct | OPEN |
| ENG-260 | 2026-01-26 | 0 direct | OPEN |
| ENG-261 | 2026-01-26 | 0 direct | OPEN |
| ENG-262 | 2026-01-26 | 0 direct | OPEN |
| ENG-263 | 2026-01-26 | 10+ linter commits, biome+ruff configs exist | CLOSE |
| ENG-264 | 2026-01-26 | 0 direct, no skill file | OPEN |
| ENG-279 | 2026-01-26 | 0 direct | OPEN |
| ENG-280 | 2026-01-26 | 1 Done sub-issue | OPEN |
| ENG-281 | 2026-01-26 | 1 Done sub-issue (ENG-286) | OPEN |
| ENG-282 | 2026-01-26 | 0 direct | OPEN |
| ENG-283 | 2026-01-26 | 0 direct | OPEN |
| ENG-284 | 2026-01-26 | Code review skill exists but feature incomplete | OPEN |
| ENG-285 | 2026-01-26 | Sub-issue Done, tool CLI exists | MAYBE |
| ENG-287 | 2026-01-26 | 0 direct | OPEN |
| ENG-288 | 2026-01-26 | 0 direct | OPEN |
| ENG-290 | 2026-01-26 | 0 direct | OPEN |
| ENG-337 | 2026-01-26 | 0 direct | OPEN |
| ENG-338 | 2026-01-26 | 0 direct | OPEN |
| ENG-339 | 2026-01-26 | 0 direct | OPEN |
| ENG-426 | 2026-01-26 | Many workspace commits, slices Done | OPEN |
| ENG-431 | 2026-01-26 | 0 direct | OPEN |
| ENG-432 | 2026-01-26 | Many e2e commits | OPEN |
| ENG-434 | 2026-01-26 | 0 direct | OPEN |
| ENG-437 | 2026-01-26 | 0 direct | OPEN |
| ENG-438 | 2026-01-26 | 0 direct | OPEN |
| ENG-441 | 2026-01-26 | 0 direct | OPEN |
