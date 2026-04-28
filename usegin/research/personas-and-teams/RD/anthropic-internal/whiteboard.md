# R&D — How Anthropic itself uses Claude Code + the Agent SDK

Date: 2026-04-27. Researcher: R&D angle 1.

## TL;DR

Anthropic ships Claude Code internally with three load-bearing patterns: (1) **CLAUDE.md as compounding team memory** ("error → rule" loop, edited multiple times per week, often via PR-bot), (2) **named subagents in `.claude/agents/*.md` with strict YAML frontmatter** (single-responsibility, tool-restricted, sometimes worktree-isolated), and (3) **orchestrator-worker parallelism** — both at the human level (5+ parallel Claudes per engineer in worktrees) and at the agent level (a lead agent spawns specialized subagents in parallel and synthesizes). The Research multi-agent system is the canonical published reference; "antfooding" is the internal practice; "Compounding Engineering" is the cultural label. Personas Anthropic actually names in production code/blogs are sparse and functional (`LeadResearcher`, `CitationAgent`, `auditor`, `judge`, `target`, `code-reviewer`, `code-simplifier`, `verify-app`, `code-architect`, `oncall-guide`, `build-validator`) — they do not anthropomorphize.

---

## 1. Concrete patterns Anthropic ships internally

### 1a. Antfooding & CLAUDE.md compounding loop

- "Antfooding" — Anthropic's term for internal dogfooding ("ants" = Anthropic engineers). The Claude Code team ships against itself daily. [pragmaticengineer / dev.to / mindwiredai]
- **Single team-shared CLAUDE.md, checked into git, edited multiple times per week** by everyone on the team. Pattern: "Anytime we see Claude do something incorrectly we add it to the CLAUDE.md." [howborisusesclaudecode.com]
- A GitHub Action (`/install-github-action`) lets reviewers `@.claude` on a PR to push a learning straight into CLAUDE.md. [howborisusesclaudecode.com]
- Anthropic's name for this pattern: **Compounding Engineering** — the codebase teaches itself between sessions. [howborisusesclaudecode.com]
- Concrete CLAUDE.md rules quoted from inside Anthropic: `"Always use bun, not npm"`; `"Prefer type over interface; never use enum"`. [howborisusesclaudecode.com]

### 1b. Parallel Claudes (human-level orchestration)

- Boris Cherny: **5 simultaneous Claudes per engineer**, in 5 git checkouts / worktrees, in 5 numbered terminal tabs. Plus 5–10 web/mobile sessions on claude.ai/code. Ships ~20–30 PRs/day. [pragmaticengineer, every.to, howborisusesclaudecode.com]
- Worktree pattern: `git worktree add .claude/worktrees/<name> origin/main`; shell aliases (`za`, `zb`, `zc`) to hop. [howborisusesclaudecode.com]
- A researcher quoted in the Anthropic-itself post calls this "running a million horses … to test a bunch of different ideas." [anthropic.com/research/how-ai-is-transforming-work-at-anthropic]
- Adoption metric (Feb→Aug 2025, internal):
  - Max consecutive tool calls per transcript: 10 → 20 (+116%)
  - Human turns per session: 6.2 → 4.1 (−33%)
  - Avg task complexity: 3.2 → 3.8 / 5
  - Feature implementation share: 14.3% → 36.9% (largest growth)
  - Code design/planning share: 1.0% → 9.9%
- "Majority of code at Anthropic is now written by Claude Code; engineers focus on architecture, product thinking, and **continuous orchestration: managing multiple agents in parallel.**" [anthropic.com/research/how-ai-is-transforming-work-at-anthropic]
- Engineers "fully delegate" only 0–20% of work. "Active supervision and validation" is the explicit model — not autonomous handoff.

### 1c. Subagents inside a single session

- Subagents are markdown files in `.claude/agents/*.md` with YAML frontmatter; the body is the subagent's system prompt. [code.claude.com/docs/en/sub-agents]
- **Each subagent runs in its own context window** with its own tool allowlist, permission mode, and (optionally) MCP servers, hooks, skills, memory, isolation, model, color.
- Boris's stated rule of thumb: "Define a custom subagent when you keep spawning the same kind of worker with the same instructions." [code.claude.com/docs/en/sub-agents]
- Boris's named subagents shipped at Anthropic:
  - `code-simplifier` — runs after Claude finishes a change, cleans up
  - `verify-app` — knows how to E2E-test the change
  - `code-architect` — design review
  - `oncall-guide` — incident-runbook persona
  - `build-validator` — check the build before PR
  - `code-reviewer` — canonical doc example
- Subagent isolation: `isolation: worktree` in frontmatter to prevent file conflicts when multiple run in parallel. [howborisusesclaudecode.com]
- "Use 5 subagents to explore large codebases" — parallel fan-out for entry points / components / tools / state / testing. [howborisusesclaudecode.com]

### 1d. Slash commands & skills as the durable layer

- High-frequency workflow → slash command in `.claude/commands/` checked into git (e.g. `/commit-push-pr`, `/techdebt`, `/babysit`, `/slack-feedback`). [howborisusesclaudecode.com]
- Boris's rule: **"If you do something more than once a day, turn it into a command or skill."**
- Skills format (`.claude/skills/<name>/SKILL.md`) supports both slash invocation and autonomous discovery; description is the trigger. [code.claude.com/docs/en/sub-agents, platform.claude.com/docs/en/agent-sdk/skills]
- Composite skill example shipped internally: `/go` = verify end-to-end → `/simplify` → put up PR.
- `/simplify` spawns **parallel agents** to review code for reuse / quality / efficiency.
- `/batch` plans a migration interactively, then runs **dozens of agents in parallel worktrees**, each testing before PR.

### 1e. Hooks (the deterministic spine)

Anthropic-shipped hook surface (canonical): `PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`, `PostCompact`, `PermissionRequest`, `WorktreeCreate`, `WorktreeRemove`. [platform.claude.com/docs/en/agent-sdk/hooks, howborisusesclaudecode.com]

Real internal uses Boris cites:
- `PostToolUse` — auto-format after every Edit/Write (`bun run format || true`).
- `PreToolUse` — log every bash command.
- `PermissionRequest` — route prompts to Slack / WhatsApp / a separate Opus reviewer.
- `Stop` — nudge Claude to keep going, or trigger a verification subagent.
- `PostCompact` — re-inject critical instructions after compaction.
- `SessionStart` — load dynamic context.

### 1f. Verification as Boris's #1 tip

> "Give Claude a way to verify its work … 2–3× the quality of the final result."

- Backend: subagent that knows how to start the server.
- Frontend: Claude Chrome extension drives a real browser.
- The composite `/go` skill makes verification mandatory before PR.

### 1g. Code review as multi-agent fan-out

Boris's review command spawns **multiple subagents in parallel**:
- one checks style guidelines
- one reads project history to understand prior context
- one looks for obvious bugs
- **five more subagents specifically tasked with poking holes in the original findings** (an evaluator-optimizer / red-team layer)

Anthropic claims internally: "code output per engineer up 200% this year; review was the bottleneck." [howborisusesclaudecode.com]

### 1h. Permissions / sandboxing

- Pre-approved allowlist via `/permissions`, wildcarded (`Bash(bun run *)`, `Edit(/docs/**)`), shared via `settings.json`.
- `--permission-mode=dontAsk` / `--dangerously-skip-permissions` for long autonomous runs.
- Auto mode + safety classifiers; risky ops (delete, force-push) escalate.
- `/sandbox enable` for an open-source sandbox runtime.

---

## 2. Named persona / role patterns Anthropic actually uses

Anthropic is **deliberately un-anthropomorphic**. Roles are functional, not personality-flavored. No "Alice the architect" / "Bob the tester."

### 2a. From the multi-agent Research system [anthropic.com/engineering/multi-agent-research-system]

| Role | Function |
|---|---|
| **LeadResearcher** | Orchestrator. Analyzes query, plans, decomposes, spawns subagents, synthesizes final answer. Uses extended thinking. |
| **Subagent** (unnamed worker class) | Independently searches, returns findings only — acts as an "intelligent filter." |
| **CitationAgent** | Post-processing pass that scans final report + sources to attach citation locations. |

Token-budget rules-of-thumb baked into prompts:
- 1 agent / 3–10 tool calls for fact-finding
- 2–4 agents / 10–15 calls each for direct comparisons
- 10+ agents for complex research

### 2b. From Petri (alignment auditing) [alignment.anthropic.com/2025/petri]

| Role | Function |
|---|---|
| **Auditor** | Plans + runs multi-turn probe of target model using a toolset. |
| **Target** | The model under audit. |
| **Judge** | Scores the resulting transcripts across 36 dimensions. |
| **Transcript Viewer** | Human-facing; not an agent. |

Parallelism: 25 auditor×judge model combinations, 111 seed instructions, ~2,775 scores per target.

### 2c. From Boris's `.claude/agents/` set

Already listed above (1c): `code-simplifier`, `verify-app`, `code-architect`, `oncall-guide`, `build-validator`, `code-reviewer`. Plus:
- **`safe-researcher`** — canonical docs example: `tools: Read, Grep, Glob, Bash` (no edits).
- **`no-writes`** — denylist example: `disallowedTools: Write, Edit`.
- **`browser-tester`** — Playwright MCP scoped subagent.
- **`api-developer`** — preloads skills (`api-conventions`, `error-handling-patterns`).
- **`db-reader`** — `tools: Bash` plus a `PreToolUse` hook to a `validate-readonly-query.sh` shell script.
- **`coordinator`** — uses the `Agent(worker, researcher)` syntax to restrict which subagent types it can spawn.

### 2d. From Building Effective Agents (Schluntz/Zhang)

- "Workflows" vs "Agents" — workflows = pre-defined LLM orchestration; agents = LLM dynamically directs itself.
- The five workflow patterns Anthropic recommends (no personas, just shapes):
  1. **Prompt chaining** — fixed sequence; trade latency for accuracy.
  2. **Routing** — classifier → specialized followup (Anthropic's example: route easy → Haiku, hard → Sonnet).
  3. **Parallelization** — sectioning (split task) or voting (multiple attempts, aggregate).
  4. **Orchestrator-Workers** — central LLM decomposes dynamically, delegates, synthesizes. **Direct example given: "coding products making complex multi-file changes."**
  5. **Evaluator-Optimizer** — generator + critic in a loop. Direct example: literary translation; complex search.

---

## 3. Team / multi-agent shapes Anthropic recommends

Three shapes show up over and over, in order of complexity:

1. **Single agent + tools + verification loop** (Schluntz: agents proper). Used in Anthropic's SWE-bench solver and "computer use" demo. Recommendation: start here.
2. **Orchestrator-Workers in parallel** (the Research system; Boris's `/simplify`, `/batch`, `/code-review`). Lead agent decomposes, subagents fan out in parallel, lead synthesizes. **This is the dominant pattern Anthropic ships.**
3. **Evaluator-Optimizer / red-team layer** (Boris's review: 5 critic-subagents poke holes in 3 finder-subagents' output; Petri's judge scoring auditor transcripts). Run a second wave of agents whose only job is to attack the first wave's output.

Cross-cutting principles Anthropic publishes:

- **Token usage explains 80% of the variance** in multi-agent system performance — separate context windows are the actual lever, not "smarter coordination."
- **Multi-agent system beats single-agent Opus 4 by 90.2%** on internal Research evals. Costs ~15× more tokens.
- **Best for breadth-first, parallelizable problems.** Sequential, tightly-coupled tasks are *worse* with multi-agent.
- **Prompt engineering is the lever**, not architecture cleverness. The Research team built simulations using their Console with the *exact* production prompts and tools to iterate on subagent behavior.
- **Delegation must be explicit.** Early failure: vague instructions → 2 subagents duplicated work, 1 chased wrong year. Lead agent has to teach how to delegate.
- **Durability matters.** Checkpoints + resume; "let agents know when a tool fails and they adapt." When approaching context limit, lead saves plan to external memory before truncation.
- **Evaluation: small samples (n=20) + LLM-as-judge with rubric.** Rubric dimensions: factual accuracy, citation accuracy, completeness, source quality, tool efficiency.
- **Agent Teams** (separate from in-session subagents): when agents need to communicate across separate sessions, that's "agent teams," not subagents. [code.claude.com/docs/en/sub-agents Note callout, en/agent-teams]

---

## 4. What's missing from our repo (gaps vs. Anthropic recommended patterns)

We are *ahead* of Anthropic on some axes (orchestration skill density, vibe telemetry, tikkur/retro culture, persona/team R&D itself) and *behind* on a few specific Anthropic-shipped patterns:

### Gaps — things Anthropic ships that we don't (yet)

1. **`.claude/agents/*.md` as the primary delegation surface.** Our delegation is overwhelmingly **skills** (`.claude/skills/`), not **agents** (`.claude/agents/` exists but is mostly empty per `?? .claude/agents/` in git status). Anthropic's recommended pattern is: skills = autonomous-loaded knowledge; agents = a worker you spawn with a different system prompt + tool allowlist + isolation. We blur the two — most of our orchestration sub-agents (Liaison, Companion, RedTweaker, GreenTweaker, DisciplineReviewer) are spawned via skill instructions, not declared as YAML-frontmatter agents with `tools:` / `disallowedTools:` / `isolation: worktree` / `permissionMode:`. **Fix direction:** declare our recurring roles (Liaison, Companion, Verifier, Reviewer, Refiner, Prioritizer, Brainstormer, Ideator, Consultant, RedTweaker, GreenTweaker, DisciplineReviewer) as `.claude/agents/*.md` with explicit tool allowlists + `isolation` + `model` so the harness — not prose in a SKILL.md — enforces shape.

2. **`isolation: worktree` for parallel sub-agents.** We have `EnterWorktree`/`ExitWorktree` tools but I see no agent definitions that declare `isolation: worktree` in frontmatter. Boris's `/batch` runs "dozens of agents in parallel worktrees, each testing before PR" — that's the SOTA shape for parallel safe edits. Our `brainstorm`/`refine`/`prioritize` skills are parallel but I didn't see worktree isolation declared.

3. **Memory field on subagents (`memory: project|user|local`).** Anthropic's example: `code-reviewer` with `memory: user` builds up review knowledge across sessions. We have `~/agent-records` and zettels for humans-in-the-loop, but no agent-scoped persistent memory directory per subagent.

4. **`PreToolUse` hooks scoped to a specific subagent for query-level safety.** Anthropic's `db-reader` example uses a per-subagent PreToolUse hook to a shell script that validates the bash command is read-only. Our `tdd-execute` has phase-state hooks (good!), but we don't seem to use per-subagent inline `hooks:` in frontmatter for things like "verifier may not write," "researcher may not run migrations," etc. Currently this is enforced by prose, not schema.

5. **Compounding-Engineering loop on CLAUDE.md from PRs.** Boris's `/install-github-action` lets reviewers `@.claude` on a PR to add a learning to CLAUDE.md as part of the merge. We have zettels + memory notes, but no PR-bot-driven CLAUDE.md update loop. Closest analog: the autosync of agent-records, but that doesn't update CLAUDE.md.

6. **Routing as an explicit pattern (Haiku for easy, Sonnet/Opus for hard).** Anthropic recommends an LLM-classifier to route. We default to Opus 4.7 1M everywhere; we don't have a router skill that picks the model. Could be a meaningful cost+speed lever.

7. **Evaluator-Optimizer with a *separate red-team subagent class*.** Our `liaison`/`worker-reviewer`/`tdd-execute` already have reviewer roles, and we have `feedback_phase_separation.md` (different reviewer ≠ verifier). But Boris's review command spawns a *second wave whose explicit job is to attack the first wave's findings*. We could add this as a "PokeHoles" / "RedTeam" subagent class that runs after every reviewer phase.

8. **CitationAgent-style post-processing.** We don't have a dedicated post-processor that reads a synthesis output and back-fills citations / proof-chain links. Our `research`, `rnd`, and `consult` skills produce findings but don't auto-cite. Worth thinking about for UseGin's "trust" surface.

9. **Token-budget rules of thumb baked into orchestrator prompts.** Anthropic's LeadResearcher prompt embeds *explicit* counts ("3–10 tool calls for fact-finding, 10+ subagents for complex"). Our skills describe the *shape* but rarely the *budget*. This is one of the few measurable levers.

10. **Slash command `--bare` mode for SDK speed.** `--bare` skips local CLAUDE.md/settings/MCP discovery, 10× faster startup for non-interactive subagent calls. Worth checking if our `multi-turn-headless-claude` / `managing-headless-claudes` skills use it.

### Areas where we're already ahead

- **Vibe / how-is-session telemetry (`dx his`)** — Anthropic publishes 1× usage analytics ("how AI is transforming work at Anthropic") but not a per-session dual-rated signal that both agent and human contribute to. Our `his-self-rating` skill is *novel*.
- **Tikkur / blameless post-mortem culture** — Anthropic has retros internally but doesn't publish a named protocol like our `tikur` skill.
- **Skill-as-trigger-description** density — we have ~90 skills with description-as-trigger, which matches Anthropic's recommended pattern; few public repos do this well.
- **Companion role** (long-running observer subagent) — not a pattern Anthropic publishes. Closest analog is their evaluator-optimizer, but `companion` is observe-and-nudge during the run, not evaluate after. Genuinely original.
- **Deliberate persona work** (`usegin/research/personas-and-teams/`) — Anthropic explicitly avoids personas. We should be confident this is a *deliberate divergence*, not a gap.
- **Memory atlas** (zettels + ~/agent-records + ENG-* Linear) is far richer than Anthropic's published `memory: project|user|local` field.

---

## 5. Source list

### Anthropic-canonical (primary)

- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — orchestrator-worker, LeadResearcher + Subagents + CitationAgent, token-budget rules.
- [Building effective agents (Schluntz/Zhang)](https://www.anthropic.com/research/building-effective-agents) — the five workflow patterns + agents-vs-workflows distinction.
- [How AI is transforming work at Anthropic](https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic) — internal usage data Feb→Aug 2025; "running a million horses"; 0–20% full delegation.
- [Create custom subagents (docs)](https://code.claude.com/docs/en/sub-agents) — canonical YAML frontmatter schema for `.claude/agents/*.md`.
- [Hooks in the SDK](https://platform.claude.com/docs/en/agent-sdk/hooks) — full event list.
- [Agent Skills in the SDK](https://platform.claude.com/docs/en/agent-sdk/skills) — `settingSources`, autonomous discovery.
- [Slash Commands in the SDK](https://platform.claude.com/docs/en/agent-sdk/slash-commands).
- [Plugins in the SDK](https://platform.claude.com/docs/en/agent-sdk/plugins).
- [Petri (alignment auditing)](https://alignment.anthropic.com/2025/petri/) — Auditor / Target / Judge multi-agent eval; 25 auditor×judge combos parallel.
- [Petri 2.0](https://alignment.anthropic.com/2026/petri-v2/) — 70 new seeds, eval-awareness mitigations.
- [Building and evaluating alignment auditing agents](https://alignment.anthropic.com/2025/automated-auditing/) — second multi-agent system Anthropic ships.
- [Anthropic engineering hub](https://www.anthropic.com/engineering) — index.

### Anthropic engineers (first-person)

- [How Boris Uses Claude Code](https://howborisusesclaudecode.com/) — single richest source on internal patterns; the spine of section 1.
- [Building Claude Code with Boris Cherny — Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/building-claude-code-with-boris-cherny).
- [How Claude Code is built — Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built).
- [Head of Claude Code: What happens after coding is solved — Lenny's](https://www.lennysnewsletter.com/p/head-of-claude-code-what-happens).
- [How to use Claude Code like the people who built it — Every podcast](https://every.to/podcast/how-to-use-claude-code-like-the-people-who-built-it).
- [Erik Schluntz LinkedIn — Multi-Agent Research at Anthropic](https://www.linkedin.com/in/erik-schluntz-530a9053/).

### Secondary / community syntheses

- [Anthropic Cookbook — patterns/agents](https://github.com/anthropics/claude-cookbooks/tree/main/patterns/agents) — minimal reference impls for the five workflow patterns.
- [Simon Willison on multi-agent research system](https://simonwillison.net/2025/Jun/14/multi-agent-research-system/).
- [ZenML LLMOps DB — Anthropic multi-agent](https://www.zenml.io/llmops-database/building-a-multi-agent-research-system-for-complex-information-tasks).
- [InfoQ — Inside the Development Workflow of Claude Code's Creator](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/).
- [alexop.dev — Claude Code customization guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/).
- [awesome-claude-code (curated list)](https://github.com/hesreallyhim/awesome-claude-code).

### Local repo references

- `.claude/skills/working-with-claude-agent-sdk/SKILL.md` — points to local SDK clone at `.ignored/anthropic/claude-agent-sdk-python/` as ground truth (clone not present in this checkout).
- `.claude/skills/` — ~90 skills, our equivalent of Anthropic's `.claude/agents/` + skills surface.
- `.claude/agents/` — empty / new (per gitStatus `?? .claude/agents/`); this is a **fresh surface** to populate per gap #1.
