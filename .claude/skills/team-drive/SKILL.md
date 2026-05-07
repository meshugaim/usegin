---
name: team-drive
description: Use this when an agent needs to read a Google Doc / Sheet / Slides / PDF from the team's Drive via the claude.ai Google Drive connector — read a doc by URL or fileId, search team files, fetch metadata. Triggered by "read the doc at <url>", "what's in the requirements doc", "find the spreadsheet about X". NOT for: AskEffi's *product* Drive source (Effi indexes Drive as a project data source — read by the product, not the agent), bulk synthesis across email + Drive (use `dogfooding-effi`).
---

# Team Drive via claude.ai connector

Read team Drive content directly as the live human. Trust the agent to pick the right tool — the available shape is `mcp__claude_ai_Google_Drive__*` (search_files, read_file_content, get_file_metadata, list_recent_files, …).

## Activation check

If only `*_authenticate` tools are visible, prompt the human to run `/mcp` and select "claude.ai Google Drive". Do NOT proceed silently — the read tools won't appear until they sign in.

## fileId from URL

Drive URLs embed the fileId as `/d/<fileId>/`:

```
https://docs.google.com/document/d/1RFGyLNLnIWppzHsNQi5EN-Gw0hWJnaEX8BdbT8LJMKw/edit
                                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

Same pattern for Sheets, Slides, PDFs.

## Large files overflow to a tool-results file

`read_file_content` on a large doc returns a 2 KB preview and writes the full JSON to `~/.claude/projects/-workspaces-test-mvp/<session>/tool-results/<id>.txt`. Slice it locally — `jq -r .fileContent` or a tiny Python script — instead of re-reading.

## Cross-references

- `team-gmail` — emails frequently link Drive docs; the natural handoff is here
- `dogfooding-effi` — synthesis across Drive + email; this skill is direct-access only

## Not to be confused with

- **AskEffi's *product* Drive source** — Effi indexes Drive as a project data source for the product, separate from this agent-direct surface
- **`dogfooding-effi`** — synthesis layer; reach for it when the question is "what was decided" rather than "what's in this specific doc"
