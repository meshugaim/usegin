---
status: liaison smoke complete; eval methodology needs adjustment before real run
authored: 2026-05-12
authored-by: claude (effi-memory R&D, exp 005 step 3 — liaison smoke)
---

# Experiment 005 — smoke run findings (liaison)

Ran the harness against one obviously-covered question ("Who are the design partners?") on local agent-dev with `EFFI_WIKI_PROJECT_ID` set to the local Test project UUID. Pipeline works end-to-end; two real findings to think about before the full eval runs.

## What worked

- **Wiki tool fires.** Effi called `mcp__wiki__memory_lookup` and pulled real content from `notes/design-partners.md`. Response listed all 8 partners (Mkenga, Epsilon, Urban Insights, Critical Loop, Alcenta, AlignOrg Solutions, Perform Media, Curtis Partition) with statuses and contacts — verbatim match against the wiki source.
- **Harness end-to-end:** spawn → trace JSONL → stdout/stderr capture → `index.md` + `RESULTS.md` skeleton. All artifacts landed.
- **CLI auth** via `effi --profile local auth refresh --auto` (Mailpit OTP fallback) — useful trick for future smoke runs.
- **Pyhon-services env propagation:** `EFFI_WIKI_PROJECT_ID` set in the shell before `just agent-dev` reaches the python subprocess (per RUNBOOK's procedure).

Sample trace shape (wiki-off line, condensed):

```json
{"session_id":"f1c6c498-...","question":"Who are the design partners?",
 "tool_calls":[{"name":"mcp__wiki__memory_lookup","started_at_ms":8120,...}],
 "response":"<8-row markdown table>","ttft_ms":8120,"total_ms":17616,
 "wiki_enabled":false}
```

## Finding 1 — Wiki-on/wiki-off CLI env toggle has no effect on server

**What I observed:** The harness's wiki-off run (CLI env unset) and wiki-on run (CLI env set) both hit a python-services process configured with the same `EFFI_WIKI_PROJECT_ID`. The CLI's env var only affects the trace's `wiki_enabled` annotation; the **server's** wiki-tool availability is determined by python-services' env at startup.

In this smoke run:
- **wiki-off** called `mcp__wiki__memory_lookup` (the wiki tool fired despite the CLI's env saying "wiki off")
- **wiki-on** called no tools (Effi already had context from the prior turn in the same session — see Finding 2)

**Why this matters:** The eval as currently designed can't actually compare wiki-on vs wiki-off Effi behavior in a single deployment. Both conditions share the server's view.

**The fix:** The wiki gate is **per-project** by design (`config.project_id == EFFI_WIKI_PROJECT_ID`). To compare conditions, the harness needs to use two different `project_id` values:
- **wiki-on project:** UUID that matches the python-services `EFFI_WIKI_PROJECT_ID` env → wiki tool + system-prompt section both fire
- **wiki-off project:** any other project UUID → wiki tool not registered, system-prompt section not injected

This is a small harness redesign. The current `--wiki-project-id <uuid>` flag should be split into:
- `--wiki-on-project <uuid>` — the wiki-eligible project
- `--wiki-off-project <uuid>` — a non-wiki project

The harness then runs each question through both projects (with `--project` overriding the CLI's default per-profile project) and compares.

**Workaround for the smoke smoke:** the harness's env toggle still validates the trace pipeline + plumbing; just don't read the comparison too literally. The wiki-off side will look "wiki-on-flavored" because the server doesn't know about the toggle.

## Finding 2 — Session contamination between paired runs

**What I observed:** Both runs (wiki-off + wiki-on) shared the same `session_id` in the trace. The CLI persists session ID per-project in `~/.effi/profiles/<email>:<env>/state.json`. Since both runs used the same `--profile local`, they landed in the same conversation thread.

The wiki-off run went FIRST and triggered the wiki tool. The wiki-on run came second IN THE SAME SESSION and inherited the first turn's context — Effi didn't need to call the tool again, she already had the answer.

**Why this matters:** Per-pair comparisons are contaminated. The second side of every pair runs with prior knowledge from the first side.

**The fix:** Harness needs to either:
- **(a) Force a fresh session per side.** Either via `--new-session` flag on `effi ask` (doesn't exist today — would be a CLI addition) or by clearing `state.json` between spawns (lightweight; harness writes empty state before each run).
- **(b) Use different projects per side** (which would naturally have different `state.json` entries) — overlaps with Finding 1's fix.

(b) gets us both fixes for the price of one, if we adopt the two-project approach.

## Finding 3 — Tool name in trace includes the MCP prefix

The trace shows `mcp__wiki__memory_lookup`, not just `memory_lookup`. That's how the MCP layer namespaces tools (`mcp__<server>__<tool>`). The harness's `index.md` shows the full prefixed name. Fine for accuracy; cosmetically the index would read cleaner if we stripped `mcp__wiki__` and rendered just `memory_lookup`. Tiny polish, not load-bearing.

## What this means for the next step

The infrastructure (1a–1d + 2a + 2b) is in place and working. The wiki tool fires, the prompt injection works, the harness runs end-to-end, the trace shape is honest. **What's not ready** is the eval methodology.

Before Lihu runs the real eval:

1. **Redesign the harness's wiki-on/off toggle** — switch from CLI-env-toggle to project-id-toggle. ~30 line change to `harness/run.ts`.
2. **Set up a "wiki-off project" in the local DB** — any project whose UUID doesn't match the env var. Could just be a second seed project.
3. **Handle session freshness** — clear state.json between spawns, or use distinct projects per Finding 2(b).

These are not load-bearing for the *infrastructure*; they're load-bearing for the *eval comparison being meaningful*. PLAN.md's iterative-learning framing absorbs this gracefully — the smoke surfaces the methodology gap, which feeds the next iteration.

## Artifacts

Smoke run output: `/tmp/smoke-005/20260512-155149/` (not committed; transient).

Files referenced:
- `usegin/effi-memory/experiments/005-effi-wiki-tool/harness/run.ts`
- `usegin/effi-memory/experiments/005-effi-wiki-tool/RUNBOOK.md`
- `usegin/effi-memory/askeffi-app-really/notes/design-partners.md` (wiki source the response cited)
