---
name: implementing-specs
description: This skill guides implementation from spec documents. Triggered by "let's implement this spec", "start implementing", "continue implementing", or "vertical slice".
---

# Implementing Specs

Turn specs into working software through vertical slices, TDD, and continuous alignment.

**Companion to:** `writing-specs` skill.

## Core Principles

| Principle | Why |
|-----------|-----|
| **Vertical slices** | End-to-end functionality over horizontal layers. Get to prod fast. |
| **No upfront master plan** | Only plan the next step. Discover as you go. |
| **TDD** | Tests first. Start local, verify the slice works, push to prod, verify on prod. |
| **User in the loop** | Ask questions, verify alignment, summarize often. |
| **Small iterations** | Short cycles, small commits, frequent checkpoints. |
| **Meta process** | Check pace with user often. Slow down when uncertain. Ask: "Should we take smaller steps?" |
| **Self-verification** | Get into feedback loops to verify your own work (run tests, check UI, hit endpoints). |
| **Feature toggles** | Use them to get incomplete work to prod safely. |

## Progress Doc

Keep a `PROGRESS.md` next to the spec (e.g., `docs/specs/auth/PROGRESS.md`).

**Purpose:** Track what's been decided and where we stand. Not a plan for everything ahead.

**What to include:**
- Decisions made along the way
- Current status / next step
- Links to relevant commits or PRs
- Open questions

Update it as you go. It's a living record, not a contract.

