# Tools — what Zisser reaches for, when

> **Speaker convention:** "Lihu" in this file is the *primary* speaker; the
> actual live user may be Oria, Lihu, or Nitsan. Check the LIVE USER banner /
> userEmail / in-chat signals before binding to a name (root `CLAUDE.md`
> "Live user — who's in the chat" precedence rule).

Zisser is the conductor. The tools are the orchestra. This is the reach-list.

## Capture

| Tool | When |
|---|---|
| `zettleit "<thought>"` | Atomic note worth keeping. Triggers `zettel-capture` skill. |
| `dx zettel add` | Lower-level capture, when the skill isn't a fit. |
| `dx his rate --as=claude` | Vibe telemetry — frustration, drift, dead-end loop, friction. |
| `dx his note --as=claude` | Free-form telemetry note (no rating). |
| `inbox/<date>-<slug>.md` (file write) | Raw verbatim, when no route is yet clear. |
| Memory note | When it's about Lihu (preferences, role, identity). Path: `~/.claude/projects/-workspaces-test-mvp/memory/`. |

## Shipping work

| Tool | When |
|---|---|
| `plan create "scope: title" --parent <id> --label <kind>` | New shippable task. Always link to a parent issue. |
| `plan show <id> --tree` | Locate yourself in the graph before starting. |
| `plan start <id>` / `plan close <id>` | Lifecycle. |
| `plan list --label bug` / `plan list --status "In Progress"` | Triage. |
| `plan search "..."` | Find before creating. |

## Cross-session continuity

| Tool | When |
|---|---|
| `session list --remote --since <N>d` | Find a past session. |
| `session resume <id>` | Reopen and continue. |
| `session fork <id>` | Branch off (like `git branch`). |
| `session find` | Interactive fzf. |
| `session search-in <id> <query>` | Within a session. |
| `session bash [id] --grep <p>` | Across sessions' Bash use. |
| `session code-history <file>:<line>` | Why a line exists (intent + Linear link). |

## Team knowledge

| Tool | When |
|---|---|
| `effi --profile oria@askeffi.ai:prod ask "..."` | Query team's emails / Drive / meetings / Linear. |
| `effi docs show claude-usage` | First read before heavy effi use. |
| `dogfooding-effi` skill | Same, with skill scaffolding. |

## Spawning agents

| Tool | When |
|---|---|
| `Agent` tool, `subagent_type: "Explore"` | Codebase exploration, no edits. |
| `Agent` tool, `subagent_type: "Plan"` | Implementation plan design. |
| `Agent` tool, `subagent_type: "general-purpose"` | Multi-step task, full tools. |
| `Agent` tool, `subagent_type: "zisser"` | (when invoking Zisser from elsewhere — `.claude/agents/zisser.md`) |
| Custom sub-agents under `.claude/agents/` | Add new ones when a recurring charter shape emerges (z015 — only systematize after manual). |

## Skills (orchestration patterns)

| Skill | When |
|---|---|
| `teamwork` | Autonomous multi-agent build. |
| `cell` | Spawner + workers, long-running. |
| `liaison` | Delegate everything to Opus sub-agents from main thread. |
| `research` | Two-tier research with phase managers. |
| `rnd` | Parallel R&D — multiple angles in parallel, then synthesis. |
| `build-orchestrate` | Multi-phase build (research → design → spec → impl → QA). |
| `build-liaison` | Two-layer build for well-understood migrations. |
| `worker-reviewer` | TDD with tight worker–reviewer loop. |
| `ralph-loop` | Long-running autonomous iteration. |
| `spec` | Conversation-first spec creation. |
| `slicing-specs` | Decompose spec into vertical slices. |
| `tdd-impl-plan` / `tdd-execute` | Strict TDD with hook enforcement. |
| `fix-bug` | Full quality workflow for bugs. |
| `interactive-dev` | Pair with Lihu, he drives. |
| `verify-spec` | Verify a completed spec against acceptance criteria. |
| `tikur` | Blameless post-mortem. |
| `session-retro` | Analyze a session and propose improvements. |
| `team-retro` / `cell-retro` / `skill-retro` | Retros on completed orchestrations. |
| `schedule` | Cron-scheduled remote agents. |
| `loop` | Recurring local task at interval. |

## Dev-environment

| Tool | When |
|---|---|
| `just agent-dev` | Start agent-side dev servers (3000→63000, 8000→58000). |
| `just agent-dev-status` / `-kill` / `-logs` | Lifecycle / debug. |
| `bunx supabase migration new <name>` | Create a migration. |
| `bun test` / `uv run pytest` | Tests (per the relevant `CLAUDE.md`). |
| `git push origin main` | The only push target — humans promote staging/prod. |

## Don't reach for

- `git push --force` / `--force-with-lease` (any branch)
- Pushing to `staging` / `production`
- Applying migrations to staging / production DBs
- Running migrations or writing to remote DBs
- `--no-verify` or hook-skipping flags
