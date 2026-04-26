---
name: spec
description: "Interactive spec creation that minimizes human reading time. Use for 'let's write a spec', 'spec for XXX', 'create a spec', 'document this feature', 'write requirements for', or any time a new feature needs to be specified before implementation. Also use when the user describes a feature idea and needs it formalized into a spec. This skill replaces writing-specs with a conversation-first approach — the human aligns on acceptance criteria through discussion, then the agent writes the full spec autonomously."
---

# Spec

Write feature specs through conversation, not documents.

The human's time is the scarcest resource in this process. Every gap the agent fails to catch is a round-trip the human has to spend. Every ambiguity left in the spec is a question a downstream agent will get stuck on. The goal is: the human describes what they want, confirms the agent understood it correctly, and never has to read or review the resulting spec — because the ACs they aligned on are the contract, and the rest is trustworthy implementation guidance.

**Pipeline:** **`spec`** (you are here) → `slicing-specs` → `implementing-specs` → `verify-spec`

## How It Works

```
deep research → stress-test ACs → align with human → write thorough spec → hand off
      ↑                ↑                 ↑                    ↑
   (silent)         (silent)       (interactive)          (autonomous)
```

The human participates in exactly one phase: AC alignment. Everything else — research, gap analysis, spec writing — happens without them. Spend as much time and as many tokens as needed in the silent phases. Agent time is cheap; human time is not.

## Phase 1: Deep Research (Silent)

The quality of the AC conversation depends entirely on how deeply you understand the system. Don't skim — read thoroughly. Follow references. Understand not just what the code does, but why it's structured that way. This is where you earn the right to propose good ACs.

### 1. Understand Intent

Read the user's description. If it's genuinely ambiguous (you can't tell what feature they mean), ask one clarifying question. Don't ask things you can answer by reading code.

### 2. Research the Codebase — Thoroughly

Spend real time here. Read files end-to-end, not just grep for keywords. Understand:

- **Current behavior** being changed or extended — read the actual code, not just file names
- **Data model** — existing tables, columns, constraints, RLS policies. Read the migrations.
- **UI patterns** — how does the app handle similar features? What components exist? What's the layout convention?
- **System connections** — what reads/writes the same data? What triggers what? Follow the call chain.
- **Test patterns** — how are similar features tested? What test infrastructure exists?
- **Related specs** — check `docs/specs/` for specs that touched similar areas
- **CLAUDE.md files** — read them in affected directories for domain-specific conventions
- **Feature toggles** — is there an existing toggle? What's the convention? (see `feature-toggles` skill)

### 3. Map the Full Blast Radius

Before proposing anything, explicitly map:

| Question | Why it matters |
|----------|---------------|
| What tables will be created/modified? | Determines migration complexity, RLS needs |
| What existing endpoints/actions are affected? | Determines integration surface |
| What UI components need to change? | Determines browser test needs |
| What other features read the same data? | Determines cascading effects |
| What happens during the transition? | Determines migration strategy |
| What roles/permissions are involved? | Determines RLS and authorization ACs |
| Is there an LLM component? | Determines cost, latency, and confidence-modeling needs |
| What external services are involved? | Determines error handling and failure modes |

### 4. Pre-Propose Gap Analysis (Silent)

This is the most important step. Before presenting ACs to the human, walk through every Coverage Dimension (below) and explicitly ask yourself: **"What would a careful product person push back on?"**

For each dimension, generate at least one edge case or design question. Then resolve it yourself using what you learned from the codebase. The goal is to arrive at the conversation having already thought through the things the human would catch — so they can focus on the things only they know (business context, user priorities, taste).

Common gaps agents miss (check all of these):

- **RLS on new tables** — every new table needs RLS. What's the scoping chain? (workspace_id → project_id → connection_id etc.)
- **CRUD completeness** — if users can create X, can they edit it? Delete it? What happens on edit/delete?
- **Validation** — what input validation is needed? Email formats, string lengths, required fields?
- **Empty/zero states** — what does the UI show when there's no data yet? First-time experience?
- **Failure modes** — what happens when an external service fails? When the LLM returns garbage? When the DB is slow?
- **Cascading effects** — if you delete X, what happens to Y that references X?
- **Existing behavior** — if you're replacing something, is the removal complete? What about the old UI, old endpoints, old tables?
- **Scope right-sizing** — are you proposing the simplest approach that solves the problem? Don't over-engineer (OAuth when webhooks suffice; separate service when a function will do).
- **Data that doesn't exist yet** — does the feature depend on data that isn't currently collected or available?
- **Debouncing/batching** — if the feature could fire frequently, does it need rate limiting?

## Phase 2: Align on ACs (Interactive)

This is the only phase requiring human attention. Your goal: the human confirms ACs in 1-3 rounds, spending minutes not hours. Every predictable gap you missed in Phase 1 is a round-trip wasted.

### Opening

Present concisely:

1. **Your understanding** of the feature in 2-3 sentences
2. **Key system connections** you discovered (what existing features this touches, what surprised you)
3. **Scope decisions you've already made** — things you considered and scoped out, with reasoning. ("I considered X but scoped it out because Y. Let me know if you disagree.")
4. **Your proposed ACs**, grouped by dimension, as a numbered table: `| # | Criterion | Level |`
5. **Open questions** — things you couldn't resolve from codebase research alone (business decisions, user priorities). Keep this short — most questions should already be answered by your research.

The opening should feel like talking to a colleague who did their homework. The human should be able to scan the ACs and say "yes, that's right" or "change X" — not "you missed half the feature."

### Conversation Guidelines

**Be opinionated, not interrogative.** Propose specific behaviors and let the human confirm or redirect. "I think deleting a rule should trigger re-evaluation of all affected meetings — sound right?" beats "What should happen when a rule is deleted?" The human corrects wrong proposals faster than they answer open questions.

**Present the hard calls, not the obvious ones.** Don't waste the human's time confirming that "user can create a widget" is an AC. Focus discussion on the design decisions that have trade-offs: scope boundaries, UX choices, migration strategies, error handling policies.

**Present in organized batches.** Group ACs by dimension. The human can scan a batch and say "looks good" or "change AC-5 to..." — much faster than one-at-a-time approval.

**Resolve UX decisions inline.** When a behavior implies a UI choice (confirmation dialog? inline action? toast?), propose a specific pattern based on existing app conventions. Reference the specific component you found in the codebase. Don't defer these — they affect the ACs.

**Surface technical constraints that affect scope.** If codebase research revealed something that limits options, say so during this conversation. The human needs to make informed trade-offs.

**Converge, don't expand.** Your job is to reach a complete, stable AC set — not to brainstorm indefinitely. When you sense coverage is sufficient, say so and check: "I think we've covered the key behaviors. Here's the full list — anything missing?"

### Coverage Dimensions

Systematically check that ACs cover every relevant dimension. Not every feature needs all of these — use judgment about which apply.

| Dimension | What to check |
|-----------|---------------|
| **User stories** | Each persona/role that interacts with the feature |
| **Happy paths** | Core behaviors work as intended |
| **Error handling** | Network failures, invalid input, timeouts, partial failures, external service failures |
| **Edge cases** | Empty states, boundary values, concurrent operations, large volumes, first-time use |
| **UX/UI states** | Loading, empty, error, success, disabled — how does the user experience each? |
| **Permissions & RLS** | Who can do what? What happens when unauthorized? RLS on every new table. |
| **System connections** | Features that share data, cascading effects, upstream/downstream impacts |
| **Migration** | Current → new behavior. Existing data. Transition period. Rollback. |
| **Feature toggles** | Toggle-off behavior, rollout strategy |
| **Validation** | Input validation, format constraints, required fields |
| **CRUD completeness** | If users create X, can they read/update/delete it? What cascades on delete? |
| **Performance/cost** | LLM call costs, debouncing, batching, pagination for large datasets |

### Closing Alignment

When you believe coverage is complete, present the final AC list as a clean numbered table and ask: **"Does this cover everything, or is anything missing?"**

Once the human confirms, move to Phase 3. Don't ask them to review individual spec sections — that's your job now.

## Phase 3: Write Spec (Autonomous)

The human has approved the ACs. Now write the complete spec — all the context downstream agents need to slice, implement, and verify the feature without human involvement.

### Writing for Agents

This spec will be consumed by three agents in sequence, each with different needs:

| Agent | What it needs from the spec |
|-------|----------------------------|
| **Slicing agent** | AC groupings that suggest natural slice boundaries. Dependencies between ACs. Infrastructure vs feature work. Seam definitions (shared types, API contracts between slices). |
| **Implementing agent** | For each AC: which layer (DB, API, UI), which files to touch, which patterns to follow. Concrete examples of expected behavior. Risk callouts for tricky areas. |
| **Verification agent** | For each AC: what "passing" looks like concretely. Expected inputs → outputs. What to check in the browser, DB, or test suite. |

Every ambiguity in the spec becomes a guess by one of these agents. Every missing detail becomes a question they can't answer. **Use as many tokens as you need** — downstream agent context is cheaper than the human having to intervene during implementation. A spec that's "too detailed" is far better than one that's "concise but ambiguous."

### Create the Linear Issue

```bash
plan create "spec: [feature title]" --label feature    # Or update existing issue
plan start <id>
```

Use `plan docs show iterative-descriptions` for writing long descriptions to Linear.

### Spec Structure

Follow conventions from existing specs in `docs/specs/`. Include these sections:

#### Always Include

**Overview** — What the feature does, why, and the mental model. Include a "what this replaces" table if modifying existing behavior.

**What Doesn't Change** — Explicitly list components, behaviors, and data flows that remain untouched. This is not optional — it gives implementing agents confidence about blast radius and prevents them from accidentally modifying working systems. Format as a table:

| Component | Why it stays |
|-----------|-------------|
| Sync flow | Meetings still arrive via existing pipeline |
| ... | ... |

**Reference Files** — Table of files, modules, and assets the implementer should read first. Verify all paths exist. Include line ranges when pointing to specific functions or endpoints. Group by area (DB, API, UI, tests):

| Area | File | What to look at |
|------|------|----------------|
| DB | `supabase/migrations/20260319...` | Existing meeting tables schema |
| API | `python-services/agent_api/api/fathom.py:652-917` | Evaluate-scoping endpoint (being replaced) |
| UI | `nextjs-app/app/.../fathom-config-modal.tsx` | Existing modal (being extended) |

**Acceptance Criteria** — The agreed ACs from Phase 2. Numbered table with `#`, `Criterion`, `Level` columns. This is the contract — copy exactly what was aligned on.

**Verification Expectations** — For each AC (or logical group of ACs), describe what "passing" looks like concretely. The verification agent and implementing agent both use this to know when they're done. Format:

| AC(s) | What to verify | Level | Notes |
|-------|---------------|-------|-------|
| 1-3 | Create people rules with various group combinations, run evaluation, assert correct meeting statuses in DB | integration-db | Test with meetings that have both calendar_invitees and speaker-only attendees |
| 19-23 | Render the rules editor, interact with inputs, verify CRUD operations reflect in UI | integration-browser | Check existing fathom-config-modal patterns for test setup |

This section is **critical** for downstream agents. Without it, the slicer can't determine test scope per slice, the implementer can't write the right test, and the verifier can't check the implementation.

#### Always Include When Relevant (err on the side of including)

**Detailed Behavior** — Logic, rules, evaluation flows, algorithms. Use pseudocode, decision tables, flow diagrams — whatever makes the behavior unambiguous. Include **concrete examples** for complex logic:

```
Example: People rule matching
- Rule: Group A = [alice@co.com], Group B = [bob@partner.co]
- Meeting attendees: [alice@co.com, bob@partner.co, charlie@co.com]
- Result: Match (alice in A, bob in B). High confidence (email match). Status = included.
```

Concrete examples eliminate the #1 cause of implementing agent mistakes: misinterpreting abstract behavior descriptions.

**Data Model** — New tables, column changes, constraints, RLS scope, deprecations. Include:
- Column types, nullability, defaults, and foreign keys
- RLS policy descriptions (who can read, write, delete)
- A **state table** when multiple flags interact — showing every valid combination and what it means
- Cascade behavior on delete (what happens to child rows)

Check existing migrations for naming conventions and patterns.

**UI** — Layout (ASCII sketches or descriptions), component behavior, interaction patterns. Cover every state: empty, loading, error, success, disabled. Reference existing components and say "follow the same pattern as X" when applicable. Include enough detail for an agent to implement without a Figma mockup — what's in each card, what the dropdowns contain, what placeholder text says, what the empty state message is.

**Migration & Invariants** — What gets removed (with specific file/function references and line ranges), what stays unchanged, what changes defaults. Be explicit about what happens to existing data during the transition.

**Seams & Dependencies** — Identify the boundaries between logical areas of the spec. This directly helps the slicing agent:

| Seam | What's shared | Notes |
|------|--------------|-------|
| Rules table ↔ Evaluation engine | `meeting_inclusion_rules` schema, rule types | Evaluation reads rules; UI writes them |
| Evaluation engine ↔ UI | `meetings.rule_match_status`, `meeting_rule_evaluations` | Engine writes status; UI reads and displays it |
| Evaluation ↔ GFS cascade | `meetings.is_excluded` | Evaluation sets it; GFS sync reads it |

**Implementation Context** — Map groups of ACs to the files they'll primarily touch and the patterns to follow. This is not prescriptive (no function signatures), but directional:

| AC group | Primary files | Pattern to follow |
|----------|--------------|-------------------|
| 1-5 (people rules eval) | `meeting_scoping.py`, `meeting_scoping_service.py` | Similar to existing `evaluate_meeting_inclusion()` structure |
| 19-23 (rule editor UI) | `fathom-config-modal.tsx` | Same card pattern as existing connection/blocklist cards |
| 32-33 (new tables) | `supabase/migrations/` | Follow existing meeting table migration conventions |

**Risks & Hazards** — Flag areas where implementation is likely to be tricky or where subtle bugs could hide:

- "The GFS cascade depends on `is_excluded` transitions — if evaluation sets this wrong, sync items get orphaned"
- "Topic rule LLM calls are async and costly — evaluation must handle timeouts gracefully"
- "The old evaluate-scoping endpoint has interleaved blocklist logic — removal must be surgical"

These callouts save the implementing agent from discovering hazards the hard way.

**Decisions & Alternatives** — Key decisions made during AC alignment, alternatives considered, rationale. This prevents downstream agents from re-opening settled questions. Include scope decisions ("we chose webhooks over OAuth because...").

### Write to Both Locations

1. **Linear** — update the issue description with the full spec
2. **`docs/specs/`** — write a markdown file: `docs/specs/<slug>.spec.md`

### Style

- Tables over prose where structure helps.
- Informal, direct language.
- Code snippets marked as illustrative, not prescriptive.
- Concrete examples over abstract descriptions.
- No implementation details (test strategies, mock approaches, specific function signatures) — those are the implementer's choices. But DO point to patterns and reference files.
- No prompts or agent instructions — the spec is a requirements document.

### Downstream Readiness Check

Before posting, verify by putting yourself in the shoes of each downstream agent:

**As the slicing agent:** Can I decompose this into vertical slices? Are the seams between areas clear? Do I know which ACs depend on which? Can I identify infrastructure-first slices? Does each group of ACs have verification expectations so I can set test scope per slice?

**As the implementing agent:** For each AC, do I know which files to touch and what patterns to follow? Are the behaviors concrete enough that I won't have to guess? Do the examples show me exactly what the expected output looks like? Are the risks flagged so I don't walk into traps?

**As the verification agent:** For each AC, do I know how to verify it passed? Do the verification expectations tell me what to check? Are the expected behaviors specific enough to write assertions against?

If any answer is "no," add the missing detail before posting. Don't ship a spec that generates questions.

### Additional Self-Check

- [ ] Every AC from the alignment conversation is included, unchanged
- [ ] Verification expectations exist for every AC (or AC group)
- [ ] Error and edge cases are covered (not just happy paths)
- [ ] Concrete examples are provided for any complex logic
- [ ] Scope is clear — what's in, what's out, what doesn't change
- [ ] "What Doesn't Change" section is present
- [ ] Seams between logical areas are identified
- [ ] Implementation context maps ACs to files and patterns
- [ ] Risks and hazards are flagged
- [ ] Decisions from the conversation are recorded with rationale
- [ ] Reference files point to real, existing paths (verify with Glob/Read)
- [ ] Feature toggle behavior specified (if applicable)
- [ ] RLS specified for every new table
- [ ] Data model includes column types, constraints, defaults, and cascade behavior
- [ ] State table present if multiple flags/statuses interact

### After Writing

1. Tell the human: "Spec is written — [link to Linear issue] and `docs/specs/<file>.spec.md`"
2. Ask: **"Ready to slice this?"** — and if yes, hand off to `slicing-specs`

Most humans won't need to read the full spec. The ACs are already aligned, and the rest is trustworthy implementation guidance.

When the spec is finished and accepted, the natural next step is `slicing-specs` → `test-architecture` → `tdd-impl-plan` → `tdd-execute` for implementation. For tiny specs (single AC, single layer), implementation may proceed directly without the trio.

## Test Levels Reference

Each AC gets a level that tells downstream agents how to verify it:

| Level | What it tests | When to use |
|-------|---------------|-------------|
| `unit` | Pure logic, no external deps | Algorithms, transformations, validation rules |
| `integration-db` | Service + database + RLS | CRUD, permissions, data integrity, cascading |
| `integration-browser` | UI + user interactions | Forms, navigation, visual states, responsive |
| `integration-llm` | LLM-dependent behavior | Prompt responses, classification, extraction |
| `e2e` | Full user flow across services | Critical multi-step paths |
| `visual` | Appearance and layout | Design compliance, responsive breakpoints |

## What This Skill Does NOT Do

- **Slice the spec** — that's `slicing-specs`
- **Write implementation code** — that's `implementing-specs`
- **Verify the implementation** — that's `verify-spec`
- **Include prompts or agent instructions** — the spec is a requirements doc
