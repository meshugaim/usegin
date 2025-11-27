---
name: implementing-specs
description: This skill guides implementation from spec documents. Triggered by "let's implement this spec", "start implementing", "continue implementing", or "vertical slice".
---

# Implementing Specs

Turn specs into working software through vertical slices, TDD, and continuous alignment.

**Companion to:** `writing-specs` skill.

## Core Principles

| Principle                  | Why                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| **Vertical slices**        | End-to-end functionality over horizontal layers. Get to prod fast.                         |
| **No upfront master plan** | Only plan the next step. Discover as you go.                                               |
| **TDD**                    | Tests first. Start local, verify the slice works, push to prod, verify on prod.            |
| **User in the loop**       | Ask questions, verify alignment, summarize often.                                          |
| **Small iterations**       | Short cycles, small commits, frequent checkpoints.                                         |
| **Meta process**           | Check pace with user often. Slow down when uncertain. Ask: "Should we take smaller steps?" |
| **Self-verification**      | Get into feedback loops to verify your own work (run tests, check UI, hit endpoints).      |
| **Feature toggles**        | Use them to get incomplete work to prod safely.                                            |

## Progress Doc

Keep an `<feature>.impl-status.md` next to the spec (e.g., `docs/specs/auth.impl-status.md` alongside `auth.spec.md`).

**What to include:**
- Meta section at top: purpose of doc, link to spec
- Next step (keep at top, write in reverse chronological order)
- Decisions made along the way
- Open questions

The doc itself should state its purpose: "This is not a full plan upfront. It tracks ongoing decisions and progress."

Update it as you go. It's a living record, not a contract.

**Style:** Keep it concise. Don't list files created or flags added - just show usage examples. Focus on what matters for the next person reading it.

## Workflow Guidelines

Guidelines, not a strict process. Adapt to the situation.

| Step                    | What                                                        | Notes                                                                                   |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Pick a slice**        | Propose the smallest vertical slice to user. Get alignment. | End-to-end, not layer-by-layer. Decide together. Discuss feature toggle strategy early. |
| **Test first**          | Write a failing test. Then make it pass.                    | TDD. Always write automated tests when possible.                                        |
| **Implement locally**   | Get it working. Run tests, check UI, hit endpoints.         | Self-verification loops.                                                                |
| **Checkpoint**          | Summarize progress. Ask user if still aligned.              | Do this often.                                                                          |
| **Commit & push**       | Commit after each slice. Don't accumulate uncommitted work. | Small commits, pushed frequently. Avoids lost work and enables easier rollback.         |
| **Update progress doc** | Record decisions, next step.                                | Keep it current.                                                                        |
| **Repeat**              | Propose next slice. Ask: "Right size? Go smaller?"          | Continuous alignment.                                                                   |

## Commit Often

**Don't stay in uncommitted state.** Commit and push after completing each slice or meaningful unit of work.

- Completed a slice? Commit and push.
- Fixed a bug along the way? Commit and push.
- Added a small feature? Commit and push.
- About to start something risky? Commit current state first.

This prevents lost work, makes rollback easier, and keeps the progress visible to collaborators.

## Automated Tests

Try to write automated tests when possible.

- Write tests before or alongside implementation (TDD preferred)
- Run tests after implementing to verify

## Checkpoints

Checkpoint often. Use `AskUserQuestion` to stay aligned.

**When to checkpoint:**
- After completing a slice
- Before starting something new
- When uncertain about direction
- When pace feels off

**What to cover:**

| Type      | Examples                                                |
| --------- | ------------------------------------------------------- |
| Summary   | "Here's what I just did..."                             |
| Alignment | "Does this match what you expected?"                    |
| Next step | "I'm thinking we do X next. Sound right?"               |
| Meta      | "Should we take smaller steps?" "Is this pace working?" |

**Summaries:** Keep them concise. Focus on decisions made, not implementation details. Offer deeper discussion if user wants it.

## Self-Verification

Get into feedback loops to verify your own work before asking the user.

**Examples:** Run tests, check UI visually, hit endpoints, check logs, build locally. Use whatever makes sense for the change.

**Note:** There may be relevant skills for specific feedback loops (e.g., `closed-loop-web-development` for UI verification). Check available skills.

Don't wait for user to tell you something is broken. Catch it yourself.

## Using Context7 for Latest APIs

When working with libraries/frameworks (Bun, React, etc.), use Context7 MCP to fetch latest docs:

1. Check if `context7` MCP server is available
2. Use `mcp__context7__resolve-library-id` to find the library
3. Use `mcp__context7__get-library-docs` to get current API docs

This prevents using outdated patterns. If Context7 isn't connected, remind the user to activate it.
