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

Keep an `<feature>.impl-status.md` next to the spec (e.g., `docs/specs/auth.impl-status.md` alongside `auth.spec.md`).

**What to include:**
- Meta section at top: purpose of doc, link to spec
- Next step (keep at top, write in reverse chronological order)
- Decisions made along the way
- Open questions

The doc itself should state its purpose: "This is not a full plan upfront. It tracks ongoing decisions and progress."

Update it as you go. It's a living record, not a contract.

