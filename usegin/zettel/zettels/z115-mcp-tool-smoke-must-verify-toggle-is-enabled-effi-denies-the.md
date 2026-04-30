---
id: z115
title: MCP-tool smoke must verify toggle is enabled — Effi denies the tool exists otherwise
type: zettel
authored-by: usegin
threads: [↑z105, ~ENG-5028, ~z105]
created: 2026-04-30
session: 0610c6b0-96a6-4ede-91f3-cfdba3037eee
---

## Human side

Smoke-testing the ENG-5028 fix on staging: asked Effi about the tail of a long Guy meeting and told it to use `get_meeting` with `time_start`. Effi replied "I don't have a `get_meeting` tool with a `time_start` parameter — my tools are semantic search, browse, and retrieval by ID" — and quietly routed to `mcp__file_search__semantic_search` instead. Looked like the fix didn't ship. It had — `fathomBrowse` toggle was just off on the staging workspace. Enabled it; same prompt; Effi called `mcp__fathom_browse__get_meeting` with `time_start=01:14:00` and returned tail content. Smoke green only on the second pass.

If we'd trusted the first-pass denial, we'd have re-opened a bug that wasn't there.

## UseGin side

When smoke-testing a fix to a backend tool that's gated by a feature toggle, the smoke isn't valid until the toggle is on for the workspace under test. Effi doesn't say "that tool is gated off for you" — it confabulates "I don't have that tool" and routes around. Same shape as the verifier-must-query-external-state lesson (`feedback_verifier_query_external_state`): the symptom looks like "fix didn't ship" but the cause is config the smoker didn't probe.

**Pre-flight for any MCP-tool smoke:**

```bash
effi toggles ls | jq '.toggles[] | select(.key == "<key>") | .enabled'   # must be true
effi ask --verbose "<prompt>"                                             # then run
# verify the [tool: mcp__<server>__<tool>] line shows the right tool name
```

If you don't see the right tool line in the verbose stream, the fix wasn't exercised — regardless of whether the answer looks plausible. Effi's natural-language denial of a tool is **not** evidence the tool is broken; it's evidence it's not loaded for that workspace/project.

**Generalizes** to any `effi ask`-driven smoke of agent_api changes: confirm the toggle, confirm the verbose line names the expected MCP tool, then trust the answer. Three checks, fifteen seconds, prevents a false "fix regressed" call.

**Where the lesson lands:** this zettel + the `dogfooding-effi` / `app-sanity-test` skills should pick up a "toggle preflight" sentence next time either is touched. The bug doc for ENG-5028 already has its 4-bullet Blast Radius — this is a different axis (smoke-loop, not implementation), so it lives here, not there.

## Threading

↑z105 (Effi-direct meeting fetch when `ask` loops — same cluster: Effi tool-routing surprises in the smoke loop). · ~ENG-5028 (the fix being smoked). · spiritual sibling of `feedback_verifier_query_external_state` in memory — symptom-vs-cause for verifiers.
