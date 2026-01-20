# Teamwork V2: Active Orchestration System

A CLI-driven multi-agent workflow system for autonomous feature implementation.

## Overview

Teamwork-v2 enables autonomous implementation of features from specs using coordinated teams of AI agents. The CLI acts as the central orchestrator, actively driving workflows rather than passively spawning agents.

**What it does:**
1. Takes a spec issue from Linear
2. Spawns a planning team to break it into vertical slices
3. Spawns implementation teams to build each slice via TDD
4. Monitors progress, handles failures, manages context
5. Reports completion

**Key difference from v1:** The CLI is the orchestrator, not an agent. This provides reliability (no context limits), observability (full logging), and recoverability (explicit state).

## Architecture

```
Human
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│                    CLI ORCHESTRATOR                      │
│  (tools/teamwork-v2/src/cli.ts)                         │
│                                                          │
│  • Drives state machine                                  │
│  • Spawns and monitors agents                            │
│  • Handles retries and handoffs                          │
│  • Emits events                                          │
│  • Manages workspace                                     │
└─────────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│    PLANNING TEAM     │    │    IMPLEMENTATION TEAM       │
│                      │    │    (one per slice)           │
│  Reviewer: reviews   │    │                              │
│    slice proposals   │    │  Reviewer: reviews tests     │
│                      │    │    and implementation        │
│  Worker: analyzes    │    │                              │
│    spec, proposes    │    │  Worker: writes tests,       │
│    slices            │    │    implements code           │
│                      │    │                              │
│  Output: Linear      │    │  Expert: consulted when      │
│    sub-issues        │    │    worker stuck (on-demand)  │
└──────────────────────┘    │                              │
                            │  Output: working code +      │
                            │    passing tests             │
                            └──────────────────────────────┘
```

## Key Principles

| Principle | Description |
|-----------|-------------|
| **CLI as orchestrator** | CLI drives the workflow, agents execute tasks |
| **Explicit state machine** | Clear phases with validated transitions |
| **Turn-based execution** | Quality over speed. Spawn → review → feedback → spawn |
| **Tight feedback loops** | Review after every small step, not just at the end |
| **TDD non-negotiable** | Tests before implementation, always |
| **Commits are checkpoints** | Commit after each passing test |
| **Events for observability** | All significant actions emit structured events |
| **Linear as source of truth** | Issue status reflects actual progress |
| **Automatic recovery** | Detect failures, generate summaries, retry |
| **Graceful handoffs** | Monitor context, hand off before blowout |

## Roles

### Orchestrator (CLI)

The CLI is the central brain. It:

- **Drives the state machine** - Knows what phase we're in, what comes next
- **Spawns agents** - Launches reviewers and workers as needed
- **Monitors health** - Watches context usage, detects stuck patterns
- **Handles failures** - Generates failure summaries, triggers retries
- **Manages state** - Updates workspace files, Linear issues
- **Emits events** - Logs everything for observability
- **Reports progress** - Keeps humans informed

The orchestrator is NOT an agent. It's deterministic code that can be stopped and restarted without losing state.

### Reviewer (Agent)

Long-running agent that supervises workers. One per team.

**Responsibilities:**
- Review worker output for quality
- Provide specific, actionable feedback
- Approve or reject work
- Detect when worker is stuck
- Request domain expert when needed
- Signal completion to orchestrator

**Planning team reviewer checks:**
- Are slices vertical (end-to-end)?
- Are acceptance criteria testable?
- Do slices cover the full spec?
- Is ordering correct (dependencies)?

**Implementation team reviewer checks:**
- Do tests cover acceptance criteria?
- Are edge cases included?
- Does implementation pass tests?
- Is code clear and maintainable?
- Are patterns consistent with codebase?

### Worker (Agent)

Short-lived agent that executes tasks. Spawned by reviewer (or orchestrator).

**Responsibilities:**
- Execute assigned task
- Work in small steps
- Commit frequently
- Signal progress via commits and events
- Say "stuck" early (don't spin)
- Never exit with uncommitted work

**Planning worker tasks:**
- Read spec from Linear
- Identify vertical slices
- Define acceptance criteria for each
- Propose test approach

**Implementation worker tasks:**
- Write failing tests (one at a time)
- Implement code to pass tests (one at a time)
- Run tests, verify they pass
- Commit after each passing test

### Domain Expert (Agent)

On-demand consultant when worker is stuck. Does NOT implement - only advises.

**When spawned:**
- Worker stuck on same error 3+ times
- Worker doesn't understand architecture
- Complex debugging needed
- Codebase-specific guidance needed

**Responsibilities:**
- Load comprehensive context (don't optimize for tokens)
- Diagnose root cause
- Provide specific guidance with file:line references
- Explain the "why" behind recommendations
- Return guidance to reviewer (who passes to worker)

## Teams

### Planning Team

Creates vertical slices from a spec issue.

**Input:** Spec issue ID (e.g., ENG-1250)

**Output:** Linear sub-issues, one per slice, with:
- Clear title
- Acceptance criteria (testable)
- Dependencies (if any)
- Independence marker (can parallelize?)
- Test approach

**Workflow:**

```
┌─────────────────────────────────────────────────────────┐
│                    PLANNING TEAM                         │
│                                                          │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐            │
│  │ ANALYZE │───▶│ PROPOSE  │───▶│ REVIEW  │◀──┐        │
│  └─────────┘    └──────────┘    └────┬────┘   │        │
│                                      │        │        │
│                              ┌───────┴───────┐│        │
│                              ▼               ▼│        │
│                         [APPROVED]      [REVISE]───────┘│
│                              │                          │
│                              ▼                          │
│                    ┌─────────────────┐                  │
│                    │ CREATE ISSUES   │                  │
│                    └────────┬────────┘                  │
│                             │                           │
│                             ▼                           │
│                        [COMPLETE]                       │
└─────────────────────────────────────────────────────────┘
```

**Quality gates:**
- Every spec requirement maps to exactly one slice
- No slice includes work outside the spec
- Slices build on each other logically
- Each slice is implementable in isolation (except dependencies)

### Implementation Team

Implements one slice via TDD.

**Input:** Slice issue ID (e.g., ENG-1251)

**Output:**
- Passing tests (unit + integration)
- Working implementation
- Clean commits
- Closed Linear issue

**Workflow:**

```
┌─────────────────────────────────────────────────────────┐
│                 IMPLEMENTATION TEAM                      │
│                                                          │
│  ┌───────────────┐    ┌─────────────────┐              │
│  │ WRITE TESTS   │───▶│ REVIEW TESTS    │◀──┐          │
│  └───────────────┘    └────────┬────────┘   │          │
│                                │             │          │
│                        ┌───────┴───────┐    │          │
│                        ▼               ▼    │          │
│                   [APPROVED]      [REVISE]──┘          │
│                        │                               │
│                        ▼                               │
│  ┌───────────────────────────────────────────────┐    │
│  │              IMPLEMENT (per test)              │    │
│  │                                                │    │
│  │  ┌────────┐   ┌────────┐   ┌────────┐        │    │
│  │  │IMPLEMENT│──▶│ REVIEW │──▶│ COMMIT │──┐     │    │
│  │  └────────┘   └────────┘   └────────┘  │     │    │
│  │       ▲                                │     │    │
│  │       └────────[NEXT TEST]─────────────┘     │    │
│  └───────────────────────────────────────────────┘    │
│                        │                               │
│                        ▼                               │
│               ┌─────────────────┐                      │
│               │     VERIFY      │                      │
│               │ (full test run) │                      │
│               └────────┬────────┘                      │
│                        │                               │
│                        ▼                               │
│                   [COMPLETE]                           │
└─────────────────────────────────────────────────────────┘
```

**Quality gates:**
- Tests fail before implementation
- Tests pass after implementation
- Each test has exactly one commit
- No regressions in full test suite
- Code follows codebase patterns

## State Machine

### Planning Team States

```typescript
type PlanningPhase =
  | "setup"           // Workspace created
  | "analyzing"       // Worker reading spec
  | "proposing"       // Worker creating proposals
  | "reviewing"       // Reviewer evaluating proposals
  | "revising"        // Worker addressing feedback
  | "approved"        // Proposals accepted
  | "creating_issues" // Creating Linear sub-issues
  | "complete"        // Done
  | "failed"          // Unrecoverable failure
```

**Transitions:**
```
setup → analyzing → proposing → reviewing
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
                revising ──────────────────▶ approved → creating_issues → complete
                    │
                    └──▶ failed (after max retries)
```

### Implementation Team States

```typescript
type ImplPhase =
  | "setup"           // Workspace created
  | "writing_tests"   // Worker writing tests
  | "reviewing_tests" // Reviewer evaluating tests
  | "revising_tests"  // Worker fixing tests
  | "tests_approved"  // Tests accepted
  | "implementing"    // Worker implementing (iterative)
  | "reviewing_impl"  // Reviewer checking implementation
  | "revising_impl"   // Worker fixing implementation
  | "verifying"       // Running full test suite
  | "complete"        // Done, issue closed
  | "failed"          // Unrecoverable failure
```

**Transitions:**
```
setup → writing_tests → reviewing_tests
                             │
             ┌───────────────┴───────────────┐
             ▼                               ▼
        revising_tests ─────────────▶ tests_approved
             │                               │
             └──▶ failed                     ▼
                                      implementing ◀─┐
                                             │       │
                                             ▼       │
                                      reviewing_impl │
                                             │       │
                             ┌───────────────┴───────┤
                             ▼                       │
                      revising_impl ─────────────────┘
                             │
                             └──▶ failed
                                             │
                                             ▼
                                        verifying
                                             │
                             ┌───────────────┴───────────────┐
                             ▼                               ▼
                         complete                    implementing (fix regressions)
```

### Parallel Execution States

For specs with independent slices:

```typescript
type ParallelPhase =
  | "setup"           // Identifying independent slices
  | "running"         // Multiple impl teams active
  | "completing"      // Some teams done, waiting for others
  | "complete"        // All slices done
  | "partial_failure" // Some slices failed
```

## CLI Commands

### Planning

```bash
# Start planning team for a spec
teamwork-v2 plan <spec-id>
teamwork-v2 plan ENG-1250

# Options
--dry-run              # Create workspace only, don't spawn
--resume               # Resume interrupted planning
--timeout <minutes>    # Max time before escalation (default: 60)
```

### Implementation

```bash
# Implement a single slice
teamwork-v2 impl <slice-id>
teamwork-v2 impl ENG-1251

# Implement all slices for a spec (sequential)
teamwork-v2 impl --all <spec-id>
teamwork-v2 impl --all ENG-1250

# Implement independent slices in parallel
teamwork-v2 impl --parallel <spec-id>
teamwork-v2 impl --parallel ENG-1250 --max-concurrent 3

# Options
--dry-run              # Create workspace only
--resume               # Resume interrupted implementation
--skip-tests           # Skip test phase (tests already written)
--timeout <minutes>    # Max time per phase (default: 30)
```

### Monitoring

```bash
# Show status of active teams (or specific team)
teamwork-v2 status [issue-id]

# List all teams (active + completed)
teamwork-v2 list
teamwork-v2 list --active     # Only active
teamwork-v2 list --completed  # Only completed

# Real-time progress
teamwork-v2 watch [issue-id]
teamwork-v2 watch             # All active teams
teamwork-v2 watch ENG-1250    # Specific team

# Context health
teamwork-v2 health [issue-id]
teamwork-v2 health            # All active agents
teamwork-v2 health ENG-1250   # Specific team's agents

# Query events
teamwork-v2 events <issue-id>
teamwork-v2 events ENG-1250 --type phase_transition
teamwork-v2 events ENG-1250 --since 1h
teamwork-v2 events ENG-1250 --follow  # Tail live
```

### Recovery

```bash
# Resume any interrupted team
teamwork-v2 resume <issue-id>

# Manually trigger retry
teamwork-v2 retry <issue-id>

# Abort a team
teamwork-v2 abort <issue-id>
teamwork-v2 abort ENG-1250 --reason "Spec changed"
```

### Validation

```bash
# Validate slice coverage for a spec
teamwork-v2 validate <spec-id>
teamwork-v2 validate ENG-1250

# Output: which requirements are covered, gaps, overlaps
```

## Workspace Structure

Each team gets a workspace at `.claude/teams-v2/<issue-id>/`:

```
.claude/teams-v2/<issue-id>/
├── state.json              # Current state
├── config.json             # Team configuration
├── progress.md             # Human-readable log
├── events.jsonl            # Machine-readable events
│
├── spec.md                 # Cached spec content (planning)
├── slices.json             # Proposed slices (planning)
│
├── tests.md                # Test plan (impl)
├── implementation.md       # Implementation notes (impl)
│
├── sessions/               # Session transcripts
│   ├── reviewer-001.md
│   ├── worker-001.md
│   ├── worker-002.md
│   └── expert-001.md
│
├── checkpoints/            # Recovery points
│   ├── checkpoint-001.json
│   └── checkpoint-002.json
│
└── failures/               # Failure summaries
    ├── attempt-001.md
    └── attempt-002.md
```

### state.json

```typescript
interface TeamState {
  // Identity
  issueId: string;
  type: "plan" | "impl";

  // Current state
  phase: PlanningPhase | ImplPhase;
  status: "active" | "paused" | "complete" | "failed";

  // Progress (impl teams)
  testsTotal?: number;
  testsComplete?: number;
  testsApproved?: boolean;

  // Active sessions
  reviewerSession?: string;
  currentWorkerSession?: string;

  // Retry tracking
  attemptNumber: number;
  maxAttempts: number;

  // Context tracking
  reviewerContextPercent?: number;
  workerContextPercent?: number;
  lastHealthCheck?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

### config.json

```typescript
interface TeamConfig {
  // Timeouts (minutes)
  phaseTimeout: number;
  totalTimeout: number;

  // Retry settings
  maxAttempts: number;

  // Context settings
  handoffThreshold: number;  // Percent (default: 80)

  // Parallel settings (for --parallel mode)
  maxConcurrent?: number;

  // Agent settings
  model?: string;  // Override default model
}
```

### events.jsonl

One JSON object per line:

```typescript
interface TeamEvent {
  timestamp: string;        // ISO 8601
  eventType: EventType;
  issueId: string;
  sessionId?: string;       // Which agent session
  data: Record<string, unknown>;
}

type EventType =
  // Lifecycle
  | "team_started"
  | "team_resumed"
  | "team_completed"
  | "team_failed"
  | "team_aborted"

  // State machine
  | "phase_transition"
  | "validation_passed"
  | "validation_failed"

  // Agents
  | "agent_spawn"
  | "agent_complete"
  | "agent_error"
  | "agent_stuck"
  | "agent_handoff"

  // Work
  | "review_feedback"
  | "work_approved"
  | "work_rejected"
  | "test_written"
  | "test_passed"
  | "test_failed"
  | "commit"

  // Recovery
  | "failure_detected"
  | "retry_started"
  | "escalation"

  // Context
  | "health_check"
  | "context_warning"
  | "handoff_initiated"
```

## Event System

### Emitting Events

The orchestrator emits events for all significant actions:

```typescript
// In orchestrator code
await emitEvent(issueId, "phase_transition", {
  from: "writing_tests",
  to: "reviewing_tests",
  reason: "Worker completed test writing"
});
```

### Querying Events

```bash
# All events for a team
teamwork-v2 events ENG-1250

# Filter by type
teamwork-v2 events ENG-1250 --type phase_transition
teamwork-v2 events ENG-1250 --type agent_stuck,failure_detected

# Filter by time
teamwork-v2 events ENG-1250 --since 1h
teamwork-v2 events ENG-1250 --since "2024-01-15T10:00:00Z"

# Follow live
teamwork-v2 events ENG-1250 --follow

# Output formats
teamwork-v2 events ENG-1250 --format json
teamwork-v2 events ENG-1250 --format table  # default
```

### Event Aggregation

```bash
# Summary of events
teamwork-v2 events ENG-1250 --summary

# Output:
# Events: 47 total
# Duration: 2h 15m
# Phases: setup → analyzing → proposing → reviewing → approved → creating_issues → complete
# Agents spawned: 5 (2 reviewers, 3 workers)
# Retries: 1 (worker stuck on test setup)
# Commits: 12
```

## Context Management

### Health Monitoring

The orchestrator periodically checks agent context:

```typescript
// Check every N minutes or after each agent return
const health = await checkHealth(issueId);
// Returns: { reviewerPercent: 45, workerPercent: 72 }
```

```bash
# CLI command
teamwork-v2 health ENG-1250

# Output:
# Team ENG-1250 Health
# Reviewer (session abc123): 45% context
# Worker (session def456): 72% context ⚠️ approaching threshold
```

### Automatic Handoff

When an agent exceeds the handoff threshold (default 80%):

1. **Detect** - Health check shows > threshold
2. **Export** - Save session transcript to `sessions/`
3. **Checkpoint** - Save current state to `checkpoints/`
4. **Spawn fresh** - New agent with handoff context
5. **Update state** - Record new session ID
6. **Emit event** - `agent_handoff`

```typescript
// Handoff prompt for new agent
const handoffPrompt = `
Previous agent ran low on context. Continuing from handoff.

Read the handoff file: ${handoffPath}
Focus on the last 20% for current context.

Current phase: ${state.phase}
Current task: ${currentTask}
Last completed: ${lastCompleted}

Continue from where they left off.
`;
```

### Manual Handoff

```bash
# Force handoff for an agent
teamwork-v2 handoff <issue-id> --agent reviewer
teamwork-v2 handoff <issue-id> --agent worker
```

## Retry & Recovery

### Failure Detection

The orchestrator detects failures via:

1. **Exit code** - Agent exits with non-zero code
2. **Timeout** - Agent exceeds phase timeout
3. **Stuck pattern** - Same error appears 3+ times in events
4. **Explicit signal** - Worker says "I'm stuck"

### Failure Summary Generation

When failure detected:

```typescript
async function generateFailureSummary(issueId: string, attempt: number) {
  // Read events
  const events = await readEvents(issueId);
  const recentEvents = events.filter(e => e.timestamp > lastCheckpoint);

  // Read progress
  const progress = await readProgress(issueId);

  // Read last session transcript (if available)
  const transcript = await readLastSession(issueId);

  // Generate summary
  const summary = `
# Failure Summary - Attempt ${attempt}

## What Was Attempted
${extractAttemptedWork(events, progress)}

## What Failed
${extractFailure(events)}

## Error Details
${extractErrors(events, transcript)}

## Analysis
${analyzePattern(events)}

## Suggestions for Next Attempt
${generateSuggestions(events, transcript)}
`;

  // Save to failures/
  await writeFile(`failures/attempt-${attempt}.md`, summary);
}
```

### Retry Process

```
Attempt 1: Normal execution
  └─▶ FAIL
      │
      ▼
Generate failure summary
      │
      ▼
Attempt 2: Fresh agent with failure context
  Prompt includes: "Previous attempt failed. Summary: {summary}"
  └─▶ FAIL
      │
      ▼
Generate failure summary (includes both attempts)
      │
      ▼
Attempt 3: Fresh agent with accumulated context
  Prompt includes: "Attempts 1 & 2 failed. Summaries: {summaries}"
  └─▶ FAIL
      │
      ▼
ESCALATE to human
  - Emit escalation event
  - Update Linear issue with failure details
  - Print clear message to terminal
```

### Resume

Resume picks up from the last checkpoint:

```bash
teamwork-v2 resume ENG-1250
```

```typescript
async function resume(issueId: string) {
  // Load state
  const state = await readState(issueId);

  // Find last checkpoint
  const checkpoint = await findLastCheckpoint(issueId);

  // Determine what to do based on phase
  switch (state.phase) {
    case "reviewing":
      // Spawn reviewer to continue review
      break;
    case "implementing":
      // Spawn worker to continue from last passing test
      break;
    // etc.
  }
}
```

## Parallel Execution

### When to Parallelize

Slices can run in parallel when:
- Marked as `independent: true` during planning
- No dependency on other incomplete slices
- User requests `--parallel`

### Parallel Workflow

```bash
teamwork-v2 impl --parallel ENG-1250 --max-concurrent 3
```

```
┌─────────────────────────────────────────────────────────┐
│              PARALLEL ORCHESTRATOR                       │
│                                                          │
│  Slices: ENG-1251 (independent)                         │
│          ENG-1252 (independent)                         │
│          ENG-1253 (depends on 1251)                     │
│          ENG-1254 (independent)                         │
│                                                          │
│  Strategy:                                               │
│  1. Start ENG-1251, ENG-1252, ENG-1254 in parallel     │
│  2. When ENG-1251 completes, start ENG-1253            │
│  3. Wait for all to complete                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Parallel State

```typescript
interface ParallelState {
  specId: string;
  phase: ParallelPhase;
  slices: {
    issueId: string;
    status: "pending" | "running" | "complete" | "failed";
    dependsOn: string[];
    independent: boolean;
    teamWorkspace?: string;
  }[];
  maxConcurrent: number;
  startedAt: string;
  completedAt?: string;
}
```

### Parallel Workspace

```
.claude/teams-v2/<spec-id>/
├── parallel-state.json    # Overall parallel execution
├── events.jsonl           # Aggregate events
└── slices/
    ├── <slice-1-id>/      # Individual impl workspace
    ├── <slice-2-id>/
    └── ...
```

## Validation

### Slice Coverage Validation

Before implementation, validate that slices cover the spec:

```bash
teamwork-v2 validate ENG-1250
```

```typescript
interface ValidationResult {
  valid: boolean;
  coverage: {
    requirement: string;
    coveredBy: string[];  // Slice IDs
    status: "covered" | "gap" | "overlap";
  }[];
  issues: string[];
}
```

Output:
```
Validating slice coverage for ENG-1250...

Requirements from spec:
  ✓ User can log in with email/password     → ENG-1251
  ✓ User can reset password via email       → ENG-1252
  ✗ User can enable 2FA                     → NOT COVERED
  ⚠ Session management                      → ENG-1251, ENG-1253 (OVERLAP)

Issues:
  - Gap: "User can enable 2FA" not covered by any slice
  - Overlap: "Session management" covered by multiple slices

Validation: FAILED
```

### Test Coverage Validation

Before marking implementation complete:

```bash
# Automated as part of impl workflow
teamwork-v2 impl ENG-1251  # Includes test coverage check
```

Checks:
- All acceptance criteria have tests
- Tests actually run (not skipped)
- Tests fail before implementation, pass after
- No regressions in existing tests

## Non-Goals

These are explicitly out of scope for v2:

1. **GUI/Web interface** - CLI only
2. **Multi-repo support** - Single repo assumed
3. **Custom agent models** - Uses configured defaults
4. **Distributed execution** - Single machine
5. **Real-time collaboration** - Async workflow
6. **Automatic spec writing** - Assumes spec exists
7. **Production deployment** - Development workflow only

## Acceptance Criteria

### Core Functionality

- [ ] `teamwork-v2 plan <spec-id>` creates planning team and produces slices
- [ ] `teamwork-v2 impl <slice-id>` implements slice via TDD
- [ ] `teamwork-v2 impl --all <spec-id>` implements all slices sequentially
- [ ] `teamwork-v2 impl --parallel <spec-id>` implements independent slices in parallel
- [ ] State machine transitions are validated and correct
- [ ] Events are emitted for all significant actions
- [ ] Events can be queried with filters

### Monitoring

- [ ] `teamwork-v2 status` shows current state accurately
- [ ] `teamwork-v2 watch` provides real-time progress
- [ ] `teamwork-v2 health` shows actual agent context usage
- [ ] `teamwork-v2 events` returns correct events with filtering

### Recovery

- [ ] `teamwork-v2 resume` continues from interruption
- [ ] Failures are detected (exit code, timeout, stuck)
- [ ] Failure summaries are generated automatically
- [ ] Retries include failure context
- [ ] Escalation happens after max attempts

### Quality

- [ ] Tests written before implementation (TDD enforced)
- [ ] Commits happen after each passing test
- [ ] Full test suite runs in verification phase
- [ ] Linear issues updated with progress
- [ ] Linear issues closed on completion

### Context Management

- [ ] Agent context is monitored
- [ ] Handoff triggered at threshold
- [ ] Fresh agent receives handoff context
- [ ] No context blowouts during normal operation

### Validation

- [ ] `teamwork-v2 validate` checks slice coverage
- [ ] Gaps and overlaps are reported
- [ ] Validation blocks implementation if critical issues

## Implementation Slices

Suggested vertical slices for implementing this spec:

### Slice 1: Core CLI Structure + Workspace

**What:** Basic CLI with plan/impl commands (dry-run only), workspace creation

**Acceptance criteria:**
- `teamwork-v2 plan --dry-run <id>` creates workspace
- `teamwork-v2 impl --dry-run <id>` creates workspace
- Workspace has correct structure (state.json, events.jsonl, etc.)
- Basic state management works

**Independent:** Yes

### Slice 2: Event System

**What:** Event emission, storage, and querying

**Acceptance criteria:**
- Events written to events.jsonl
- `teamwork-v2 events <id>` returns events
- Filtering by type and time works
- `--follow` tails live events

**Independent:** Yes

### Slice 3: Planning Team Orchestration

**What:** Full planning workflow (spawn reviewer, manage phases, create issues)

**Acceptance criteria:**
- `teamwork-v2 plan <id>` runs full planning workflow
- Reviewer spawned and managed
- Worker spawned by reviewer
- Phases transition correctly
- Linear sub-issues created

**Depends on:** Slice 1

### Slice 4: Implementation Team Orchestration

**What:** Full implementation workflow (tests, implementation, verification)

**Acceptance criteria:**
- `teamwork-v2 impl <id>` runs full TDD workflow
- Test phase with review loop
- Implementation phase with per-test iteration
- Verification phase
- Linear issue closed on completion

**Depends on:** Slice 1

### Slice 5: Health Monitoring + Handoffs

**What:** Context monitoring and automatic handoffs

**Acceptance criteria:**
- `teamwork-v2 health` shows actual context percentages
- Threshold detection works
- Handoff triggered automatically
- Fresh agent receives context

**Depends on:** Slice 3 or 4

### Slice 6: Retry & Recovery

**What:** Failure detection, summaries, retries, resume

**Acceptance criteria:**
- Failures detected (exit code, timeout, stuck)
- Failure summaries generated
- Retries include context
- `teamwork-v2 resume` works
- Escalation after max attempts

**Depends on:** Slice 3 or 4

### Slice 7: Parallel Execution

**What:** Run independent slices in parallel

**Acceptance criteria:**
- `teamwork-v2 impl --parallel` works
- Respects dependencies
- Respects max concurrency
- Handles partial failures

**Depends on:** Slice 4

### Slice 8: Validation

**What:** Slice coverage validation

**Acceptance criteria:**
- `teamwork-v2 validate` checks coverage
- Reports gaps and overlaps
- Blocks implementation on critical issues

**Depends on:** Slice 3

### Slice 9: Watch + Status Polish

**What:** Real-time monitoring, polished status output

**Acceptance criteria:**
- `teamwork-v2 watch` shows live progress
- Status output is clear and informative
- List filtering works

**Depends on:** Slices 1-4

## File Locations

```
.claude/skills/teamwork-v2/
├── SKILL.md              # Entry point, overview
├── reviewer.md           # Reviewer agent behavior
├── worker.md             # Worker agent behavior
├── domain-expert.md      # Expert agent behavior
├── state-machine.md      # Phase definitions
└── events.md             # Event schema

tools/teamwork-v2/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts            # Main CLI entry
│   ├── orchestrator.ts   # State machine driver
│   ├── workspace.ts      # Workspace operations
│   ├── events.ts         # Event system
│   ├── health.ts         # Context monitoring
│   ├── retry.ts          # Failure handling
│   ├── parallel.ts       # Parallel execution
│   ├── validation.ts     # Coverage validation
│   ├── linear.ts         # Linear API
│   └── agents.ts         # Agent spawning
└── tests/
    ├── orchestrator.test.ts
    ├── workspace.test.ts
    ├── events.test.ts
    └── ...
```

## See Also

- ENG-1250: Original teamwork v1 spec
- `tools/team/`: V1 implementation (reference)
- `.claude/skills/teamwork/`: V1 skill files (reference)
- `cctx`: Context monitoring CLI
- `crun`: Agent spawning CLI
