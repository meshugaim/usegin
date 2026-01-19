# Planning Team

Creates vertical slices from a spec issue.

## Team Structure

- **Reviewer** - Long-running agent, supervises worker
- **Worker** - Analyzes spec, proposes slices

## Workflow

### Phase 1: Analysis

**Reviewer spawns worker:**
```bash
crun "Use teamwork skill as planning worker. Analyze spec ENG-XXX and propose vertical slices." \
  -n "Review the slices when worker returns" \
  -C .claude/teams/ENG-XXX
```

**Worker responsibilities:**
1. Read spec from Linear (`plan show ENG-XXX`)
2. Identify vertical slices (end-to-end features)
3. For each slice, define:
   - Clear title
   - Acceptance criteria (testable)
   - Dependencies on other slices
   - Whether it's independent (can be developed in parallel)
   - Suggested test approach
4. Return proposal to reviewer

### Phase 2: Review

**Reviewer checks:**

**Individual slice quality:**
- Are slices truly vertical (end-to-end, not layers)?
- Are acceptance criteria clear and testable?
- Is ordering correct (dependencies)?
- Are independence markers accurate?
- Are slices right-sized (not too big)?

**Aggregate coverage (CRITICAL):**
- **Complete coverage**: Do the slices together fully implement the spec? Any gaps?
- **No overlap**: Is each requirement covered by exactly one slice? Any duplication?
- **Coherent story**: Do the slices build on each other logically?
- **Spec alignment**: Does each requirement in the spec map to a slice?

**Coverage verification process:**
1. List all requirements from spec
2. For each requirement, identify which slice(s) cover it
3. Verify each requirement covered exactly once
4. Verify no slices include work outside the spec

**Reviewer actions:**
- If coverage gaps/overlaps found → provide specific feedback → spawn worker again
- If individual quality issues → provide specific feedback → spawn worker again
- If approved → move to Phase 3

### Phase 3: Create Sub-Issues

**Reviewer:**
1. For each approved slice, create Linear sub-issue:
   ```typescript
   createSliceIssue(
     parentIssueId,
     title,
     description,
     deps,
     { independent: true/false }
   )
   ```

2. Update parent issue with planning summary

3. Mark planning complete in `state.json`

## Slice Quality Criteria

| Aspect | Good | Bad |
|--------|------|-----|
| **Vertical** | "Login form + API + auth token storage" | "Build all UI components" |
| **Testable** | "User can log in with email/password" | "Improve login experience" |
| **Sized** | Can implement in 1-2 days | Week-long epic |
| **Independent** | Can deploy without other slices | Tightly coupled to 3 other slices |

## Output

Linear sub-issues with:
```markdown
## Acceptance Criteria
- [Testable criterion 1]
- [Testable criterion 2]

## Dependencies
- Requires: ENG-XXX (if dependent)
- None (if independent)

## Test Approach
- Unit tests: [what to test]
- Integration tests: [what to test]

**Independent:** Yes/No - [explanation]
```

## Context Management

Reviewer monitors worker context:
```bash
cctx <worker-session-id>
```

If worker context >80%, initiate handoff (see reviewer.md).

## Success Signal

Planning team completes when:
- All slices created as Linear sub-issues
- Parent issue updated with summary
- `state.json` phase set to "complete"
