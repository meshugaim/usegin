---
status: scaffolding — Worker 1 dispatched 2026-05-12
authored: 2026-05-12
authored-by: claude (effi-memory R&D, post-scout refinement)
references:
  - PLAN.md (sibling) — framing and learning goals
  - usegin/effi-memory/DESIGN.md (§4 — runtime, §3 — storage progression)
purpose: |
  Implementation spec — file paths, function signatures, charter steps for workers.
  Transient artifact; obsolete after the experiment ships. PLAN.md is the enduring record.
---

# Experiment 005 — Implementation spec

Worker-facing build sheet. Read PLAN.md first for the why; SPEC.md is the how.

The experiment scaffolds a `memory_lookup` tool and a wiki-section system-prompt block for Effi, gated to a single dogfooding project via env var. Plus an eval harness with structured tool-call trace capture.

## Codebase seams (scouted 2026-05-12)

| Concern | File | Pattern |
|---|---|---|
| Tool registration | `python-services/agent_api/agent_tools/_tool_registry.py` (22-30) | `ToolReg(tool, external_safe)` |
| Tool factory clone target | `python-services/agent_api/agent_tools/data_browse_tool.py` (53-76) | `create_data_browse_mcp_server(supabase, project_id, scope)` — project_id captured in closure |
| Tool handler pattern | `python-services/agent_api/agent_tools/data_browse_tool.py` (140-177) | `@tool_with_coercion` + async handler returning `dict[str, Any]` |
| MCP wiring | `python-services/agent_api/agent/mcp_builder.py` (213-216) | `create_data_browse_mcp_server(browse_supabase, project_id, ...)` |
| Effi prompt assembly | `python-services/agent_api/agent/effi_system_prompt.py` (429-526) | `build_effi_system_prompt(...)` |
| System prompt builder | `python-services/agent_api/agent/system_prompt_builder.py` (180-456) | `build_prompt_from_agent_config(...)` |
| Project_id flow | `python-services/agent_api/chat/chat_context.py` (255-316) | `build_chat_context(project_id=...)` already threads it |
| Agent config | `python-services/agent_api/agent/config.py` (128-154) | `AgentConfig(...)` — must extend with `project_id: str \| None` |
| Effi CLI | `tools/effi-cli/src/cli.ts` (77-81, 164) | `--profile <name>`; profiles: production / staging / dev / agent-dev |

**Two seam invariants from the scout (load-bearing):**

1. Tools do **not** receive a runtime `ctx` parameter. `project_id` is bound in the tool factory closure when the MCP server is created. The wiki tool checks against the closure-bound `project_id`, not a per-call context.
2. `AgentConfig` does **not** carry `project_id` today. It must be added as a field and threaded from `chat_context.py` through the prompt-builder so the wiki block can conditionally append.

## Step 1a — `AgentConfig.project_id` plumbing

**Goal:** thread `project_id` from `chat_context` into `AgentConfig` and through to the prompt builder. No behavior change yet, just wiring.

**Changes:**

- `python-services/agent_api/agent/config.py` (`AgentConfig` ~line 128) — add `project_id: str | None = None`.
- `python-services/agent_api/chat/chat_context.py` (`build_chat_context` ~line 255-316) — pass `project_id` when constructing `AgentConfig`.
- `python-services/agent_api/agent/system_prompt_builder.py` (`build_prompt_from_agent_config` ~line 402-456) — read `config.project_id` so downstream conditionals can branch on it.

**Tests:** unit-test `AgentConfig` shape; assert `build_chat_context` passes `project_id` through. Follow existing test patterns under `python-services/agent_api/tests/`.

**Commit:** `feat(eng-5379): thread project_id through AgentConfig (exp 005 step 1a)` + `Part of: ENG-5379`.

## Step 1b — `wiki_tool.py` (memory_lookup tool + MCP factory)

**Goal:** wire the `memory_lookup` MCP tool. Gated by `EFFI_WIKI_PROJECT_ID` env var matching the bound `project_id`.

**Changes:**

- New file `python-services/agent_api/agent_tools/wiki_tool.py`. Clone the shape of `data_browse_tool.py`:
  - Module-level `WIKI_ROOT = Path(os.environ.get("EFFI_WIKI_PATH", "/app/wiki"))`
  - Module-level `ALLOWED_WIKI_PROJECT_ID = os.environ.get("EFFI_WIKI_PROJECT_ID")`
  - Factory `create_wiki_mcp_server(project_id: str | None) -> MCPServer | None`:
    - Returns `None` if `ALLOWED_WIKI_PROJECT_ID` unset or `project_id != ALLOWED_WIKI_PROJECT_ID`. Matches the `create_data_browse_mcp_server` pattern of returning `None` when not applicable.
    - Inner `@tool_with_coercion async def memory_lookup(args: dict[str, Any]) -> dict[str, Any]`:
      - Sanitize topic via helper `_sanitize_topic(s: str) -> str` — reject path separators, absolute paths, `..` segments.
      - Resolve `WIKI_ROOT / "notes" / f"{topic}.md"`.
      - If not present → `{"status": "not_found", "topic": topic, "available_topics": [<sorted stems of *.md under notes/>]}`.
      - If present → `{"status": "ok", "topic": topic, "body": path.read_text()}`.
- Update `python-services/agent_api/agent_tools/_tool_registry.py` — register the wiki MCP server.
- Update `python-services/agent_api/agent/mcp_builder.py` (~line 213-216) — call `create_wiki_mcp_server(project_id)` alongside `create_data_browse_mcp_server`. Skip-if-None pattern (existing data_browse already does this).

**Tests:**
- Unit-test `_sanitize_topic` against attack inputs (`../`, `/etc/passwd`, `notes/../secret`, empty, whitespace).
- Factory returns `None` when env unset; returns `MCPServer` when env matches.
- Tool returns `not_found` for unknown topic with `available_topics` populated.
- Tool returns `ok` with body for known topic.

**Commit:** `feat(eng-5379): memory_lookup wiki tool + MCP factory (exp 005 step 1b)` + `Part of: ENG-5379`.

## Step 1c — `wiki_section.py` (system-prompt block + conditional injection)

**Goal:** preload MOCs + conventions into the system prompt when project matches.

**Changes:**

- New file `python-services/agent_api/agent/wiki_section.py`:
  - Module-level `WIKI_ROOT` (same env-var resolution as `wiki_tool.py` — extract to shared helper if natural; otherwise duplicate, fine for v0).
  - `build_wiki_section() -> str | None` reads `_conventions.md` and `moc/{company,product,market}.md`. Returns `None` if `WIKI_ROOT` doesn't exist (defensive). Otherwise returns:
    ```
    # Project wiki

    A curated wiki of facts about this project is available to you. Use it freely as your fast path for project-knowledge questions. Fall through to raw data (canon search, file reading) when the wiki is insufficient or when the user asks for source-level detail.

    ## How to read the wiki

    <verbatim _conventions.md>

    ## Available notes (index)

    <verbatim moc/company.md>

    <verbatim moc/product.md>

    <verbatim moc/market.md>

    To fetch a note in full, call memory_lookup(topic).
    ```
  - Cache the assembled block at module load (read files once on import). Subsequent calls return the cached string.

- `python-services/agent_api/agent/effi_system_prompt.py` — add `wiki_section: str | None = None` param to `build_effi_system_prompt(...)`. If passed (truthy), append after the existing PROJECT CONTEXT block (~line 524).

- `python-services/agent_api/agent/system_prompt_builder.py` — in `build_prompt_from_agent_config(config, ...)`:
  - If `config.project_id` and `config.project_id == os.environ.get("EFFI_WIKI_PROJECT_ID")` and env is set, call `build_wiki_section()` and pass result to `build_effi_system_prompt(...)`.

**Tests:**
- `build_wiki_section()` returns expected concatenation (use fixture wiki dir under `tests/fixtures/`).
- `build_wiki_section()` returns `None` if `WIKI_ROOT` missing.
- `build_prompt_from_agent_config` includes the wiki block when project matches; omits when it doesn't; omits when env unset.

**Commit:** `feat(eng-5379): wiki_section preload + conditional system-prompt injection (exp 005 step 1c)` + `Part of: ENG-5379`.

## Step 1d — Bundling

**Goal:** the wiki ships into the Railway build context so prod Effi can read it.

**Changes:**

- New file `python-services/scripts/stage-wiki-for-bundle.sh`:
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  rm -rf "$ROOT/python-services/wiki"
  mkdir -p "$ROOT/python-services/wiki"
  cp -r "$ROOT/usegin/effi-memory/askeffi-app-really/." "$ROOT/python-services/wiki/"
  ```
  - `chmod +x` after creation.
- `python-services/.gitignore` — add `wiki/`.
- `python-services/railpack.json` — verify whether a pre-build hook is supported; if yes, wire the script. If not, document manual-run-before-push and defer (don't block 1d).
- New file `usegin/effi-memory/experiments/005-effi-wiki-tool/RUNBOOK.md` — short ops note: how to set `EFFI_WIKI_PATH` and `EFFI_WIKI_PROJECT_ID` locally and on Railway; how to run the staging script before prod sync.

**Local dev override:** `EFFI_WIKI_PATH=/workspaces/test-mvp/usegin/effi-memory/askeffi-app-really` in `just agent-dev` env (skips staging, reads from source for tight iteration). Container default: `/app/wiki` (or wherever railpack lands the python-services WORKDIR — Worker 1d verifies and documents in RUNBOOK).

**Commit:** `chore(eng-5379): bundle wiki into python-services build context (exp 005 step 1d)` + `Part of: ENG-5379`.

## Step 2a — Effi CLI `--trace-jsonl` flag

**Goal:** structured tool-call trace output the eval harness consumes (not transcript-chatter parsing).

**Changes:**

- `tools/effi-cli/src/commands/chat.ts` — add `--trace-jsonl <path>` option. When set, the streaming event handler captures per turn:
  - `{question, tool_calls: [{name, args, result_preview, started_at, finished_at}], response, ttft_ms, total_ms, profile, env}`.
  - Appends one JSONL line per assistant turn to the file. No memory buffering beyond the current turn.

**Tests:** CLI test using existing pattern under `tools/effi-cli/tests/` if present; else smoke + assert file contents are valid JSONL.

**Commit:** `feat(eng-5379): effi CLI --trace-jsonl flag for tool-call capture (exp 005 step 2a)` + `Part of: ENG-5379`.

## Step 2b — Eval harness

**Goal:** run a question list through Effi twice (wiki-on / wiki-off) and persist per-pair artifacts for human + LLM-judge scoring.

**Changes:**

- New `usegin/effi-memory/experiments/005-effi-wiki-tool/eval-questions.md` — seed with the 15 draft questions from PLAN.md (Lihu revises later; staleness is fine for smoke).
- New `usegin/effi-memory/experiments/005-effi-wiki-tool/harness/run.ts`:
  - Reads `eval-questions.md` (one question per `## ` header).
  - For each question:
    - Run wiki-off: `effi ask "<q>" --profile agent-dev --trace-jsonl runs/<ts>/<n>-off.jsonl` with `EFFI_WIKI_PROJECT_ID` unset in the spawned env.
    - Run wiki-on: same, `EFFI_WIKI_PROJECT_ID` set to dogfooding UUID.
    - Persist both transcripts + traces to `runs/<timestamp>/<n>-{off,on}.jsonl` plus an `index.md` listing the pairs with one-line tool-call summary per side.
  - Writes empty `runs/<timestamp>/RESULTS.md` skeleton for scoring.

**Note**: SPEC originally said `effi chat`; corrected to `effi ask` after the 2a Ron review found that chat lacks a positional argument and headless-exits, while ask is the headless one-shot command. Trace-flag plumbing was added to both in 2a; the Commander option lives on ask (added in 2a-followup).

**Tests:** smoke run is the test (step 3 below).

**Commit:** `feat(eng-5379): exp 005 eval harness + draft question set (exp 005 step 2b)` + `Part of: ENG-5379`.

## Step 3 — Smoke run (liaison, not worker)

**Goal:** prove the pipe carries signal end-to-end before Lihu's real eval.

Liaison runs:
- `python-services/scripts/stage-wiki-for-bundle.sh` (or set local `EFFI_WIKI_PATH`).
- `just agent-dev` (start local services).
- Fetch dogfooding project UUID via `effi projects list --profile production` or Supabase. Export as `EFFI_WIKI_PROJECT_ID`.
- Pick 2-3 obviously-covered questions: design partners, team size, who funded MFN round.
- Run harness against those 3 Qs.
- Verify: trace JSONL well-formed, both transcripts captured, tool-call patterns visible, RESULTS.md skeleton populated.
- No scoring. Findings written to handoff for Lihu's return.

## Review protocol

After every implementation step, liaison spawns Ron to read the diff (not the worker's summary). Single-iteration review, fix everything found, no scope-creep dismissal. Liaison verifies + commits between steps with the prescribed commit messages. SPEC.md is the source of truth; liaison updates this file if a step's scope shifts.

## Sequencing (strictly sequential)

```
1a (AgentConfig) → 1b (wiki_tool) → 1c (wiki_section + injection) → 1d (bundling)
                → 2a (CLI trace flag) → 2b (eval harness) → 3 (smoke run, liaison)
```

No parallelism. Sub-agents share the git worktree; concurrent commits cross-contaminate via autosync rebase (prior incident — see auto-memory `feedback_parallel_agents_share_git_worktree.md`).

## Liaison resolves (no escalation)

- **Subdir vs flat for `wiki_section.py`** — `agent/wiki_section.py` is fine. No subdir.
- **TS vs Python for harness** — TS (reuses CLI's profile + auth flow).
- **Sourcing dogfooding project UUID** — liaison fetches via CLI or Supabase before smoke. Not in code.
- **Pre-build hook in railpack** — if not supported, document manual-run-before-push in RUNBOOK and defer. Don't block 1d.
- **Sharing `WIKI_ROOT` between tool and prompt module** — fine to duplicate the env-var read; not load-bearing.
