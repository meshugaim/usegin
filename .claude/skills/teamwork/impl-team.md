# Implementation Team

Implements one slice via TDD with tight feedback loops.

## Team Structure

- **Reviewer** - Long-running agent, supervises worker
- **Worker** - Writes tests, implements code
- **Domain Expert** - On-demand consultation when worker stuck

## Tight Feedback Loops

**Core pattern:** spawn → review → feedback → spawn

**NOT:** "Spawn worker once, hope for the best"

After every small step:
1. Worker returns with progress
2. Reviewer reviews immediately
3. Reviewer provides specific feedback
4. Reviewer spawns worker again OR moves to next phase

**This happens multiple times per phase:**
- Phase 1 (Tests): Review each test batch, not all tests at end
- Phase 2 (Implementation): Review each commit, not all code at end
- Quality over speed - catch issues early

## Workflow

### Phase 1: Tests (Iterative)

**Reviewer spawns worker:**
```bash
crun "Use teamwork skill as implementation worker. Write failing tests for slice ENG-XXX." \
  -n "Review tests when worker returns" \
  -C .claude/teams/ENG-XXX
```

**Worker responsibilities:**
1. Read acceptance criteria from Linear
2. Write failing tests (unit + integration, backend + frontend)
3. Commit tests
4. Return to reviewer

**Reviewer reviews:**
- Do tests cover all acceptance criteria?
- Are edge cases included?
- Do tests follow codebase patterns?
- Are tests actually failing (not passing prematurely)?

**Reviewer actions:**
- **If issues found:** Provide specific feedback → spawn worker again with corrections
  ```bash
  crun "Fix test issues: [SPECIFIC FEEDBACK]. Previous tests committed as abc123." \
    -n "Review updated tests" \
    -C .claude/teams/ENG-XXX
  ```

- **If worker stuck:** (same error 3x, spinning, going in circles)
  - **HALT** - don't spawn same worker again
  - Spawn domain expert OR provide more guidance

- **If tests approved:** Move to Phase 2

**Repeat until tests are right.** Don't rush.

### Phase 2: Implementation (Iterative)

**Reviewer spawns worker for first test:**
```bash
crun "Implement code to pass the first failing test. Use TDD: minimal code to make it pass." \
  -n "Review implementation and check if test passes" \
  -C .claude/teams/ENG-XXX
```

**Worker responsibilities:**
1. Implement minimal code to pass ONE test
2. Run test, verify it passes
3. Commit
4. Return to reviewer

**Reviewer reviews commit:**
```bash
git log -1 --stat  # See what changed
git show           # Review the code
bun test           # Verify test passes
```

**Reviewer checks:**
- Does test actually pass?
- Is code clear and maintainable?
- Follows established patterns?
- No over-engineering?
- Adequate logging/observability?

**Reviewer actions:**
- **If issues:** Spawn worker to fix
  ```bash
  crun "Fix issue in commit abc123: [SPECIFIC FEEDBACK]" \
    -n "Review fix" \
    -C .claude/teams/ENG-XXX
  ```

- **If worker stuck:** Spawn domain expert
  ```bash
  crun "Use teamwork skill as domain expert. Worker stuck on: [PROBLEM]. Error: [ERROR]. Code context: [RELEVANT FILES]" \
    -n "Pass expert guidance to worker" \
    -C .claude/teams/ENG-XXX
  ```

- **If commit good:** Spawn worker for NEXT test
  ```bash
  crun "Good work on test 1. Now implement code to pass test 2: [TEST NAME]" \
    -n "Review next implementation" \
    -C .claude/teams/ENG-XXX
  ```

**Repeat for EACH test.** One test at a time, review after each.

**Key point:** Worker should NOT implement all tests at once. Reviewer spawns worker for each test iteration.

### Phase 3: Verification

**Reviewer runs full test suite:**

See "Running Tests" section below for comprehensive guidance.

**If all tests pass:**
1. Update Linear issue:
   ```bash
   plan close ENG-XXX
   ```

2. Update team state:
   ```json
   {
     "phase": "complete",
     "subtasksComplete": X,
     "lastUpdated": "..."
   }
   ```

3. Mark implementation complete

**If tests fail or regressions found:**
- Spawn worker to fix regressions
- Provide specific error details
- Don't close issue until all tests pass

## Running Tests

**Not trivial** - different parts of the codebase have different test commands. Be proactive.

### Frontend Tests (Next.js app)

```bash
cd nextjs-app

# Unit tests (React components, utilities)
bun test

# Check for type errors
bun run typecheck
```

### Backend Tests (Python services)

```bash
cd python-services

# All tests
uv run pytest

# Specific test file
uv run pytest tests/test_agent.py

# With coverage
uv run pytest --cov

# Verbose output
uv run pytest -v
```

### E2E Tests

**Use the e2e CLI (NOT the interactive-cli skill):**

```bash
cd tests/e2e

# All e2e tests
bun run e2e

# Specific test
bun run e2e tests/auth-flow.spec.ts

# Headed mode (see browser)
bun run e2e --headed

# Debug mode
bun run e2e --debug
```

See `tests/e2e/README.md` for full documentation.

### Linting

```bash
# Root level
bun run lint

# Frontend only
cd nextjs-app && bun run lint

# Backend only
cd python-services && uv run ruff check
```

### When Test Commands Fail

**If you're unsure which command to use:**

1. Check package.json scripts:
   ```bash
   cat package.json | grep -A 10 "scripts"
   ```

2. Check justfile recipes:
   ```bash
   just --list
   ```

3. Check README or CLAUDE.md in that directory

4. Ask for help if still stuck - don't guess

### Common Patterns

| Project Type | Test Command | Location |
|-------------|--------------|----------|
| Next.js | `bun test` | `nextjs-app/` |
| Python | `uv run pytest` | `python-services/` |
| E2E | `bun run e2e` | `tests/e2e/` |
| Tools/CLI | `bun test` | `tools/<name>/` |

## Context Management

**Reviewer monitors worker context:**
```bash
cctx <worker-session-id>
```

**When worker >80%:** Initiate proactive handoff (see reviewer.md)

**Reviewer monitors own context:**
```bash
cctx --percent
```

**When reviewer >80%:** Document state, create checkpoint, prepare handoff

## Success Signals

Implementation team completes when:
- All tests pass (unit + integration + e2e if applicable)
- Code reviewed and approved
- Linear issue closed
- `state.json` phase set to "complete"

## Anti-Patterns

| ❌ Don't | ✓ Do |
|---------|------|
| Spawn worker for all tests at once | One test at a time, review each |
| Let worker implement without reviewing | Review after each commit |
| Accept work without running tests | Always run full test suite |
| Let worker spin on same error | Detect stuck early, spawn expert |
| Rush to finish | Quality over speed, iterate |
