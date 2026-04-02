---
name: slicing-specs
description: "Decompose a spec into ordered vertical slices as Linear sub-issues. Use this skill whenever a spec with acceptance criteria needs to be broken into implementable work units — triggered by 'slice this spec', 'break into slices', 'decompose spec', 'create slices for', 'vertical slices for', or when a spec is freshly written and ready for implementation planning. Also use when the user has a spec issue and wants to plan the implementation sequence."
---

# Slicing Specs

Decompose a spec into ordered, implementable vertical slices — each a Linear sub-issue under the spec's parent issue.

**Pipeline:** `spec` → **`slicing-specs`** (you are here) → `implementing-specs` → `verify-spec`

The quality of slicing determines the quality of everything downstream. A bad slice — too big, wrong-ordered, vague seams — doesn't just slow one session. It causes context pressure, forces implementers to pull work forward from future slices, breaks contracts, and creates rework that cascades through verification. Two hours of thorough slicing saves twenty hours of implementation friction.

Spend tokens generously. Agent time is cheap; human intervention during implementation is expensive.

## What This Skill Produces

For a spec in a Linear parent issue:

1. **Ordered sub-issues** — one per slice, each self-contained with acceptance criteria, verification expectations, concrete seam contracts, and implementation context
2. **A slice map** — appended to the parent issue, showing execution order, AC coverage, complexity estimates, external dependencies, and cross-slice verification items
3. **Seam contracts** — concrete descriptions of what each slice provides to and expects from adjacent slices (table schemas, function signatures, type definitions — not just "depends on slice 1")

---

## Phase 1: Deep Research

The spec skill already researched the codebase, but you may be a different agent in a different session. Even if you're the same agent, a second pass with *decomposition* in mind surfaces things a spec-writing pass misses — infrastructure gaps, complexity hotspots, component hierarchies that affect sizing.

Don't skim. Read thoroughly. This phase is where you earn the ability to make good decomposition decisions.

### 1. Read the Spec

```bash
plan show <spec-issue-id>
```

Read the entire spec. Build a mental model of:

- Every acceptance criterion and its verification expectation
- The data model (new tables, columns, constraints, RLS policies)
- Behavioral logic (algorithms, evaluation flows, state transitions)
- Seams the spec already identified
- Scope boundaries (what's in, what's out, what doesn't change)
- External dependencies and risks flagged
- Implementation context the spec provides (file references, patterns to follow)

If the spec is missing acceptance criteria or verification expectations, **stop**. Tell the user the spec needs those first (point them to `spec`).

### 2. Explore the Codebase for Implementation Complexity

Follow every reference from the spec. Read the actual files — not just names. Your goal is understanding *how hard each area will be to implement*, because that determines slice sizing more than AC count does.

For each area the spec touches:

- **Read current code end-to-end.** Understand the patterns, abstractions, and data flow. How are similar features structured?
- **Estimate implementation complexity.** A new table with RLS is straightforward. A new evaluation algorithm with 8 edge cases is complex. A UI component following an existing pattern is easy. A new interaction paradigm is hard. Note these estimates — they'll guide sizing.
- **Identify infrastructure gaps.** What test harnesses exist? What shared types are needed? What migrations will multiple slices depend on?
- **Map component hierarchies.** For UI work, trace the data path from server to rendering component. Count how many layers data threads through (page → client wrapper → tab → card → detail). This directly affects both sizing and the implementation guidance you'll write.
- **Find pattern exemplars.** The most valuable implementation context is "follow the pattern in X." Find X for each area.

### 3. Surface External Dependencies

Explicitly list everything that blocks or is blocked by this work:

- Other Linear issues that must land first
- External services or APIs not yet available
- Other teams' work this depends on
- Migration ordering constraints

Missing external dependencies are one of the most common slicing failures — they cause implementers to discover mid-session that they can't proceed.

---

## Phase 2: Decompose by User Capability

This is the most important phase. The natural temptation is to decompose by system layer — "first all the DB tables, then all the API endpoints, then all the UI." This feels safe but produces horizontal slices that can't be demonstrated, tested end-to-end, or delivered independently. Integration problems hide until late. Rework cascades.

Instead, decompose by **what the user can do**. Each slice delivers a complete, demonstrable capability that touches every layer it needs.

### Step 1: List User Capabilities

Read through the spec's acceptance criteria and ask: **"What distinct things can the user do when this feature is complete?"**

Each distinct capability is a candidate vertical slice. For a meeting rules engine, the capabilities might be:
- "User creates a people rule and sees meetings get included/excluded based on attendee emails"
- "User creates a topic rule and sees meetings get included/excluded based on LLM analysis"
- "User manually overrides a meeting's inclusion status"
- "System re-evaluates meetings when rules change or new meetings sync"

These are user-facing capabilities, not system components. Notice how each one implies work across multiple layers (DB + logic + API + UI).

### Step 2: Trace Each Capability Through the Stack

For each capability, identify every layer it touches:

| Capability | DB | Backend logic | API | UI |
|---|---|---|---|---|
| People rules E2E | rules table, evaluations table | matching algorithm, confidence model | CRUD endpoints, evaluate endpoint | rule editor card, status badges |
| Topic rules E2E | (reuses tables from above) | LLM evaluation, topic matching | evaluate endpoint extension | topic rule card, status badges |

This trace reveals which capabilities share infrastructure (both need the rules table) and which are independent (people matching vs topic matching are separate algorithms).

### Step 3: Extract Shared Infrastructure

Look at the traces from Step 2. What appears in *multiple* capability slices?

- Tables that several capabilities read/write → infrastructure slice
- Shared types consumed across slices → infrastructure slice
- Test harnesses needed by multiple slices → infrastructure slice
- Feature toggle skeleton → infrastructure slice

Infrastructure is *only* what's genuinely shared. A table used by only one capability belongs in that capability's slice, not in a separate "DB slice."

### Step 4: Compose the Slices

Now assemble:

1. **Infrastructure slice(s)** — shared foundations only
2. **Capability slices** — each one end-to-end, each independently demonstrable
3. **Polish slice (if needed)** — edge cases, error handling, and cleanup that span multiple capabilities

**The Demonstration Test:** For every feature slice, write one sentence describing a 30-second demo. "I create a people rule with two email groups, trigger evaluation, and see matching meetings turn green in the table." If you can't write that sentence — if the slice produces invisible backend plumbing with no observable result — it's not vertical enough. Restructure.

### Step 5: Right-Size Each Slice

Check each slice against implementation complexity:

- **Hard cap: 6 ACs per slice.** If a slice has more than 6, it must be split. The previous heuristic of "~7" was too lenient — agents consistently produce oversized slices at 8-10 ACs when given that much room. 6 is the ceiling, not the target.
- **Complexity check:** Even under 6 ACs, a slice spanning multiple independent systems (LLM pipeline + file upload + worker dispatch) should be split. Use codebase knowledge — how much code will each AC require?
- **Merge threshold:** A slice with 1-2 trivial ACs (adding a line to a prompt, one simple config change) should be merged with an adjacent slice.
- **One migration max** per slice.

When you need to split a capability that exceeds 6 ACs, split along functional lines *within* the capability, keeping each sub-slice vertical:
- Algorithm/logic vs. UI for the same capability
- Core flow vs. edge cases for the same capability
- Data producer + its tools vs. display + its interactions

Don't split by layer (all backend in one, all frontend in another) — that recreates horizontal slicing.

### Step 6: Order

1. **Infrastructure first** — shared foundations other slices depend on
2. **Riskiest capability next** — de-risk early; if the hardest part changes the plan, find out before building on assumptions
3. **Dependencies respected** — if capability B consumes what capability A produces, A comes first
4. **Seam-adjacent slices are neighbors** — shared contracts are fresh in the implementer's context
5. **Polish and cleanup last** — edge cases, error handling, old code removal

### Horizontal Decomposition is the #1 Failure Mode

The most common slicing failure is producing slices organized by system layer:

| Horizontal (wrong) | Vertical (right) |
|---|---|
| Slice 1: All DB tables and migrations | Slice 1: Shared infrastructure (types, harness, base schema) |
| Slice 2: All backend evaluation logic | Slice 2: People rules E2E (table + logic + API + UI) |
| Slice 3: All API endpoints | Slice 3: Topic rules E2E (logic + API + UI) |
| Slice 4: All UI components | Slice 4: Orchestration (re-eval triggers, manual overrides, batch processing) |
| | Slice 5: Polish (progress UI, toasts, error handling, old code cleanup) |

In the horizontal version, after slice 2 ships you have evaluation logic that nothing calls and nothing displays. In the vertical version, after slice 2 ships you can demo: "I create a people rule, meetings get evaluated, I see results in the UI."

Ask yourself: after each slice ships, does a user see something new? If no — restructure.

---

## Phase 3: Challenge Your Decomposition

The self-critique is not a checkbox exercise. It's an active attempt to break your own decomposition. For each challenge below, try hard to find the problem. When you find one, you *must* fix it in Phase 4 — don't justify keeping it.

### Challenge 1: The Demonstration Test

For each feature slice, describe a concrete 30-second demo in one sentence. Be specific — name the user action and the visible result.

- **Good:** "I add a people rule with alice@co.com in Group A and bob@co.com in Group B, click Save, and the meeting with both attendees shows a green 'included' badge."
- **Bad:** "The evaluation engine processes rules correctly." (No user action, no visible result — this is horizontal plumbing.)

If you can't write a demo sentence, the slice is horizontal. Restructure it to include the UI or tooling that makes the backend work observable.

### Challenge 2: The Sizing Gauntlet

For every slice with more than 6 ACs: **you must split it.** The only exception is if every AC is a trivially simple variation of the same operation (e.g., 7 ACs that are "CRUD for field X" where each is one line of code). "These ACs are all related" is not sufficient justification — related ACs can still be split along functional lines.

For each slice, estimate the implementation effort from what you know about the codebase:
- How many files will change?
- How many new patterns need to be established vs. existing patterns followed?
- Does it involve one cohesive concern or multiple independent concerns?

A slice that touches 15 files across 3 different systems is too big, regardless of AC count.

### Challenge 3: The Implementer Test

Pick 2-3 slices and read their descriptions as if you've never seen the spec. Ask:

- Could I start implementing right now with just this description?
- What questions would I have? (If any — the description is missing something.)
- Do I know which files to read first?
- Do I know what patterns to follow?
- For UI work: do I know the component hierarchy and prop threading path?
- Are the ACs precise enough to write tests from? ("Chat works with files" → too vague. "Chat endpoint returns empty context when project has 0 indexed files" → testable.)

Every unanswered question is a gap. Fill it.

### Challenge 4: The Seam Audit

For every "depends on" or "provides to" in every slice:

- Is the contract concrete enough to code against? (Table name + column types + constraints, or function name + signature + return type, or TypeScript interface definition)
- If an implementer built exactly to the stated contract, would the next slice's code compile and work?
- Are seam references using issue IDs or slice numbers? (Use issue IDs once created; use slice numbers with descriptions during drafting)

Vague seams like "depends on the rules table from slice 1" force the implementer to read slice 1's full description or the parent spec to figure out the schema. Concrete seams like "expects `meeting_inclusion_rules` table (id UUID PK, workspace_id UUID FK, rule_type text, config JSONB)" let the implementer code immediately.

### Challenge 5: The Coverage Sweep

- Map every spec AC to a slice. Orphaned ACs = missing work.
- Identify ACs that can only be verified after all slices land (cross-slice verification). These go in the slice map, not in any individual slice.
- Verify each slice's verification expectations have a concrete test level inherited from the spec.

### Challenge 6: External Dependencies and Ordering

- Are all external dependencies surfaced? Check the spec's risks, dependencies, and "what doesn't change" sections.
- For each external dependency: which slice does it block?
- Could any reordering reduce risk or improve the earliest point at which something is demonstrable?

---

## Phase 4: Revise

Fix everything you found. This is not optional and not cosmetic:

- **Sizing violations:** Split the slice. Find the functional boundary within the capability.
- **Horizontal slices:** Restructure to bundle backend + API + UI for the same capability.
- **Vague seams:** Rewrite with concrete table schemas, function signatures, type definitions.
- **Missing implementation context:** Add file paths, pattern references, data threading notes.
- **Gaps in coverage:** Add the missing slice or redistribute ACs.

After revising, run through the challenges again quickly. Revisions can introduce new issues (splitting a slice changes seam references; merging slices may push AC counts over 6).

---

## Phase 5: Present to User

Present all slices as a structured summary:

1. **Strategy overview** — how many slices, the decomposition approach (e.g., "infrastructure first, then people rules end-to-end, then topic rules end-to-end, then orchestration and polish")
2. **Slice summary table:**

| # | Title | ACs | Complexity | 30-second demo |
|---|-------|-----|------------|----------------|
| 1 | infra: shared types + test harness | #1-2 | Low | (infrastructure — no demo) |
| 2 | people-rules: create rule → evaluate → see results | #3-8 | High | Create a people rule, trigger eval, see green badges on matching meetings |
| 3 | topic-rules: LLM-based rule → evaluate → see results | #9-13 | High | Create a topic rule, trigger eval, see matched meetings |

3. **Ordering rationale** — why this sequence, what depends on what
4. **External dependencies** — what blocks which slices
5. **Cross-slice verification** — ACs that can only be checked after all slices land

Use `AskUserQuestion` for feedback. Don't create sub-issues until the user approves.

If the user requests changes, revise and re-present.

---

## Phase 6: Create Issues

Once approved, create all slices as Linear sub-issues:

```bash
plan create "scope: what it does" --parent <spec-issue-id> --label feature
```

Update each issue's description with the full slice description:

```bash
plan update <slice-issue-id> --description "..."
```

Use `plan docs show iterative-descriptions` for the mechanics of writing long descriptions to Linear.

### Update Parent Issue

Append a slice map to the parent spec issue:

```
## Slice Map

| # | Issue | Summary | ACs | Complexity | Status |
|---|-------|---------|-----|------------|--------|
| 1 | ENG-XXX | infra: shared types + test harness | #1, #2 | Low | Pending |
| 2 | ENG-YYY | people-rules: create → evaluate → display | #3-#8 | High | Pending |
| 3 | ENG-ZZZ | topic-rules: LLM eval → display | #9-#13 | High | Pending |
| 4 | ENG-AAA | orchestration: re-eval, overrides, batch | #14-#17 | Medium | Pending |
| 5 | ENG-BBB | polish: progress, toasts, errors, cleanup | #18-#20 | Medium | Pending |

**Ordering rationale:** Infrastructure first (types/harness needed by all). People rules next (riskiest — confidence model + matching algorithm). Topic rules third (reuses infrastructure, independent algorithm). Orchestration fourth (composes both engines). Polish last (refinement).

**External dependencies:**
- ENG-NNN blocks slice 2 (needs connection type from OAuth work)
- ENG-MMM blocks slice 3 (needs API schema from partner)

**Cross-slice verification:**
- AC #18 (end-to-end: create rule → evaluate → see results) — verify after slices 2-4 land
- AC #20 (feature toggle off hides everything) — verify after slice 5
```

---

## Phase 7: Coherence Check

Sub-agents create the issues, and small things fall between the cracks — an AC that got paraphrased into ambiguity, a seam contract that references a column name from an earlier draft, a verification expectation that landed in no slice. This final pass catches those gaps before an implementer hits them mid-session.

After all sub-issues are created and the slice map is appended to the parent:

### 1. Re-read Everything

Read the parent spec issue and every slice sub-issue from Linear (not from your working memory — from what's actually written):

```bash
plan show <spec-issue-id>
plan show <slice-1-id>
plan show <slice-2-id>
# ... every slice
```

### 2. Check for Coherence

Walk through these checks against the actual written content:

- **AC coverage:** Every spec-level AC maps to at least one slice. No orphans.
- **AC fidelity:** Slice-level ACs faithfully represent the spec-level ACs they decompose — nothing lost in paraphrasing, no meaning drift.
- **Seam consistency:** Column names, type names, function signatures, and table schemas match across slices that reference each other. If slice 2 says it provides `evaluate_rules(meeting_id)` and slice 3 says it depends on `eval_meeting_rules(meeting_id)`, that's a crack.
- **Ordering holds:** Dependencies declared in seam contracts align with the slice ordering in the map.
- **No dangling references:** Issue IDs in seam contracts and the slice map match actual created issues.
- **Implementation context is reachable:** File paths mentioned in slices exist in the codebase.

### 3. Fix What You Find

If anything is off — a mismatched name, a missing AC, a stale reference — update the affected issues directly:

```bash
plan update <issue-id> --description "..."
```

Then update the slice map on the parent if the fix affects ordering or coverage.

Report to the user what you found and fixed. If you found nothing, say so — that's a good sign.

---

## Slice Description Template

Each sub-issue contains:

**Title:** `scope: what it does` — short, imperative. Label carries the type.

```markdown
## What

One sentence: what this slice delivers from the user's perspective. What can you demonstrate when it's done?

## Acceptance Criteria

- Precise, directly testable criterion (tightened from spec-level)
- Another criterion

Tighten spec-level ACs into slice-level precision:
- Spec: "Chat works with 0 files, 1 file, and 100+ files"
- Slice: "Chat endpoint returns empty context message when project has 0 indexed files"

## Verification

For each criterion or group:

- **What:** [specific behavior to verify]
  **Level:** [unit / integration-db / integration-browser / integration-llm / e2e]
  **Notes:** [which service function, which scenarios, role-based edge cases]

## Seam Contracts

Concrete enough to implement against — not "depends on slice 1" but the actual interface.

**Depends on:**
- ENG-XXX provides: `meeting_inclusion_rules` table (id UUID PK, workspace_id UUID FK, rule_type text CHECK(...), config JSONB, created_at timestamptz). RLS scoped to workspace_id via org membership chain.

**Provides to:**
- ENG-YYY will consume: `meeting_rule_evaluations` table (id, meeting_id FK, rule_id FK, matched boolean, confidence float, evaluated_at timestamptz). Service function `evaluate_meeting_rules(meeting_id) → list[RuleEvaluation]`.

**Shared contracts:**
- TypeScript type `MeetingInclusionRule` (defined in this slice, consumed by slices 3 and 4)
- Python dataclass `RuleEvaluation` (defined here, consumed by slice 3)

## Implementation Context

- **Parent spec:** ENG-XXX — read during orient for full feature context, especially [specific sections relevant to this slice]
- **Key files:**
  - `path/to/file.ts` — existing pattern for [what]; follow this structure
  - `path/to/other.py:120-180` — current implementation being extended
- **Patterns to follow:** "This modal follows the same structure as Drive config modal (`drive-config-modal.tsx`) — card layout, server actions for CRUD, optimistic updates"
- **Data threading (UI slices):** connection timestamp from `connections.created_at` → `page.tsx` (server component, DB query) → `config-client.tsx` (client boundary) → `integrations-tab.tsx` → `connection-card.tsx` via props
- **Risks:** [non-obvious pitfalls — e.g., "GFS cascade depends on `is_excluded` transitions; if evaluation sets this wrong, sync items get orphaned"]
```

The slice should be self-contained enough to implement without reading the parent spec. The parent spec provides the "why" — implementers should read it during orient for context at seams and cross-cutting concerns.

---

## Infrastructure Slices

When multiple feature slices depend on shared foundations:

- A test harness or fixture pattern
- Shared types or API contracts
- A DB migration that multiple slices build on
- A feature toggle skeleton

Give infrastructure its own sub-issue. Don't bury setup inside feature slices.

**TDD skip label:** Infrastructure without testable logic (pure migrations, config, type definitions) gets `tdd:skip`:

```bash
plan create "infra: shared types + test harness" --parent <spec-id> --label chore --label tdd:skip
```

---

## Edge Cases

**Small spec (1-3 ACs):** Slicing may add overhead without value. Tell the user — they may want to skip to `implementing-specs`.

**Horizontal criteria:** Some criteria are inherently cross-cutting (e.g., "all endpoints return consistent error shapes"). If it's a refactor across many files, it's one slice. If each endpoint is independent work, it's many.

**Unresolved questions:** If open questions affect decomposition, surface them before proposing slices. Don't guess.

**Large specs (40+ AC):** Pay extra attention to sizing. The temptation to create "kitchen sink" slices is strongest here. The 6-AC cap matters most here.

---

## What This Skill Does NOT Do

- **Write code** — that's `implementing-specs`
- **Write the spec** — that's `spec`
- **Verify the implementation** — that's `verify-spec`
- **Choose test strategies** — the implementer decides mocks, fixtures, test structure
