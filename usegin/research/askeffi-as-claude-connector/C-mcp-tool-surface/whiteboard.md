# MCP Tool Surface — AskEffi as a Claude Connector

Angle C of the R&D round. Maps AskEffi's existing capabilities to the MCP tool / resource / prompt surface a remote MCP server would expose to claude.ai.

Author: Poll-C. Read with: A (anthropic-spec), B (oauth-idp), D (security-multitenancy), E (distribution-ux). The auth / scope shape is Poll D — every tool below has a `scope` placeholder; D fills it.

## Top — the click

**v1 = 8 tools, 1 resource, 3 prompts. All read-only. No writes in v1.**

| # | Tool | One-liner |
|---|---|---|
| 1 | `list_projects` | List the user's AskEffi projects (id, name, workspace, role). |
| 2 | `get_project` | Fetch one project's metadata + connected sources + member count. |
| 3 | `search_canon` | Semantic search across a project's canon (Drive / email / meetings / Linear / files). Returns answer-with-citations. |
| 4 | `browse_data` | Faceted listing over a project's emails / files / meetings / Linear tasks by sender, date, type, etc. — for "what exists" questions. |
| 5 | `get_source` | Fetch one source by anchor (email-id / file-id / meeting-id / linear-id) — full body, not snippet. |
| 6 | `list_meetings` | Listing wrapper for project meetings (Fathom transcripts) with action-items. |
| 7 | `list_reports` | List a project's scheduled-report runs (recent, with status). |
| 8 | `get_report` | Fetch one anchored report run (full content + sources). |

Excluded from v1 deliberately: `ask_effi` meta-tool, write-anything (no scheduled-report CRUD, no project create, no chat-share), GitHub browse (flag-gated internally), administrative tools.

The catalog mirrors the **existing internal MCP tool surface** of the Effi agent (data_browse + file_search + linear_browse + fathom_browse + anchored_report) — minus internal-only routing and minus everything still flag-gated. We are not designing a new surface; we are exposing the one we already trust.

Resource: `askeffi://projects` (subscribable list). Prompts: `brief-project`, `whats-new`, `find-source`.

## Middle — the body

### Why mirror the internal agent surface

`python-services/agent_api/agent_tools/` already holds 25+ MCP tools the Effi agent calls during chat — `browse_emails`, `search_files`, `get_meeting`, `browse_linear_tasks`, etc. Each has a hand-tuned description (`data_browse_tool.py:53` and onward) optimized for an LLM-reader, an `inputSchema`, and an output shape that's been iterated against real chats. The Tools-CLAUDE.md doctrine ("single Python entry point, gate inside") means each tool is already audience-portable: the agent calls it, the dev CLI calls it, a third caller (the MCP server) can call it too.

A claude.ai-facing MCP server is *the third audience*. The right design is not "build a new MCP server in Python" — it's "extract the LLM-facing subset of the existing tool catalog, route it via Next.js (per `project_python_api_internal_only`), and present it under `mcp__askeffi__*` names". This collapses surface area, kills divergence, and means the descriptions are already battle-tested.

### Tool catalog (full)

Every tool below maps to one or more existing AskEffi capabilities. `Capability` column points to the production code path. `Scope` is a placeholder Poll D will fill. All v1 tools are `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` (closed world per project).

#### 1. `list_projects`

| Field | Value |
|---|---|
| Description | List AskEffi projects the user has access to. Returns id, name, workspace name, the user's role (owner/internal/external), and a brief connected-sources summary. Use first to find the project to scope further calls to. |
| Input | `{ workspace_id?: uuid, query?: string, limit?: int (default 50) }` |
| Output | `{ projects: [{ id, name, workspace_id, workspace_name, role, source_count, last_activity_at }], next_cursor? }` — also a text summary for chat display |
| Capability | `nextjs-app/lib/services/projects` (used by `/api/v1/workspaces/[workspaceId]/projects`) |
| Read/Write | read |
| Scope | `projects:read` (placeholder — Poll D) |

#### 2. `get_project`

| Field | Value |
|---|---|
| Description | Fetch a single project's metadata: name, workspace, your role, connected data sources (Drive folders, SharePoint sites, Fathom recorder, Linear team, email inbox), member count, and counts of indexed items per source type. Use after `list_projects` to confirm the right project before searching it. |
| Input | `{ project_id: uuid }` |
| Output | `{ id, name, workspace, role, sources: [{ kind, label, item_count, last_synced_at }], members_count, item_counts: { files, emails, meetings, linear_tasks } }` |
| Capability | `/api/v1/projects/[projectId]` + `data_browse.list_data_summary` |
| Read/Write | read |
| Scope | `projects:read` |

#### 3. `search_canon`

The big one. Direct mapping of `mcp__file_search__search_files` + `mcp__file_search__semantic_search` (the VAIS path).

| Field | Value |
|---|---|
| Description | Semantic search across a project's data — Drive docs, emails, meeting transcripts, Linear tasks, uploaded files. Returns a synthesized answer with source citations and up to 5 matched chunks (title + preview + URL). Use for meaning-based questions: *what was decided*, *what someone said*, *what a document covers*. Write queries as full descriptive sentences, not keywords — semantic match rewards richer phrasing. Use `browse_data` instead when you need a *listing* of items by metadata (sender, date, type). |
| Input | `{ project_id: uuid, query: string, kinds?: ("files" \| "emails" \| "meetings" \| "linear" \| "drive")[], date_from?: ISO, date_to?: ISO }` |
| Output | `{ answer: string, citations: [{ kind, source_id, title, snippet, url, anchor }], total_chunks: int }` |
| Capability | `agent_api/agent/file_search_tool.py` → VAIS or GFS multi-store query, RLS+role enforced |
| Read/Write | read |
| Scope | `canon:read` (project-scoped) |

Output shape is **structured content + text** per MCP `outputSchema` guidance. Citations carry `anchor` strings (the same shape the in-app chat citations use), so a follow-up `get_source` call can dereference them.

#### 4. `browse_data`

A unified faceted-list tool. The internal surface fragments this into `browse_emails / browse_files / browse_attachments / browse_data_items / browse_linear_tasks / browse_meetings / browse_github_repos`. For an external connector, **one tool with a `kind` discriminator beats seven** (per the "minimum lovable surface" rule — Slack's connector has one `slack_search_public`, not seven per-channel-type variants).

| Field | Value |
|---|---|
| Description | List items in a project by metadata — sender, subject, date range, type, has-attachments, etc. Returns a preview listing (title, sender/author, date, snippet, source-id) you can pass to `get_source` for full content. Use when you want to see *what exists* by properties, not by meaning — for that, use `search_canon`. |
| Input | `{ project_id: uuid, kind: "emails" \| "files" \| "meetings" \| "linear_tasks" \| "all", limit?: int (default 20), offset?: int, filters?: { sender?, subject_contains?, body_contains?, date_from?, date_to?, has_attachments?, status? } }` |
| Output | `{ items: [{ kind, source_id, title, snippet, author, date, url }], total_count, next_offset?, footer?: string }` |
| Capability | `data_browse.browse_emails / browse_files / browse_data_items` + `linear_browse.browse_linear_tasks` + `fathom_browse.browse_meetings` |
| Read/Write | read |
| Scope | `canon:read` |

Note: snippet is ~200 chars, mirroring the internal tool. The `footer` field exists because the internal tools already emit one when results exceed the token budget — preserves the pagination affordance.

#### 5. `get_source`

| Field | Value |
|---|---|
| Description | Fetch one source by id — full content of an email (with thread), file, meeting transcript, or Linear task. Use after `search_canon` or `browse_data` returns a source-id and you need the full body to answer accurately. Returns markdown-formatted content with metadata header. |
| Input | `{ project_id: uuid, kind: "email" \| "email_thread" \| "file" \| "drive_file" \| "sharepoint_file" \| "attachment" \| "meeting" \| "linear_task", source_id: string }` |
| Output | `{ kind, source_id, title, content_markdown, metadata: {...kind-specific}, url }` |
| Capability | `data_browse.get_email / get_email_thread / get_file / get_drive_file / get_sharepoint_file / get_attachment` + `fathom_browse.get_meeting` + `linear_browse.get_linear_task` |
| Read/Write | read |
| Scope | `canon:read` |

#### 6. `list_meetings`

Kept distinct from `browse_data` because Fathom meetings have unique facets (action-items, recording state) and the existing `meeting_summary` / `list_action_items` tools demonstrate users want a meeting-shaped listing.

| Field | Value |
|---|---|
| Description | List a project's meetings with date, attendees, summary, and action-items. Use for "what meetings happened this week", "which meetings discussed X", or to find action-items across meetings. |
| Input | `{ project_id: uuid, date_from?: ISO, date_to?: ISO, attendee?: string, limit?: int }` |
| Output | `{ meetings: [{ id, title, date, attendees, summary, action_items: [...], url }] }` |
| Capability | `fathom_browse.browse_meetings + meeting_summary + list_action_items` |
| Read/Write | read |
| Scope | `canon:read` |

#### 7. `list_reports`

| Field | Value |
|---|---|
| Description | List recent scheduled-report runs in a project with status (scheduled / running / sent / failed) and recipients. Use for "what's the latest weekly status report", "did the Friday report go out". |
| Input | `{ project_id: uuid, report_id?: uuid, limit?: int (default 20) }` |
| Output | `{ runs: [{ run_id, report_id, report_name, scheduled_for, status, sent_at?, recipient_count, summary_line }] }` |
| Capability | `data_browse.list_reports` + `/api/v1/projects/[projectId]/scheduled-reports/[reportId]/runs` |
| Read/Write | read |
| Scope | `reports:read` |

#### 8. `get_report`

| Field | Value |
|---|---|
| Description | Fetch one report run by id — full body content, sources, and recipient list. The body is the same anchored-content the email recipients see. Use to answer "what did the last report say about X" or to summarize a sent report. |
| Input | `{ run_id: uuid }` |
| Output | `{ run_id, report_name, project_id, scheduled_for, sent_at, status, content_markdown, sources: [{...}], recipients: [{...}] }` |
| Capability | `agent_tools/anchored_report_tool.get_anchored_report` (single Python entry point with in-function gate per `agent_tools/CLAUDE.md`) |
| Read/Write | read |
| Scope | `reports:read` (the in-function gate is creator-or-recipient — strictly tighter than `reports:read` would imply; D should reflect that) |

### Resources catalog

MCP resources are URI-addressable, often subscribable. We propose **one** resource in v1:

| URI | Description | Subscribe? |
|---|---|---|
| `askeffi://projects` | The user's project list, same shape as `list_projects` output. | Yes — emit `notifications/resources/updated` when a new project is created or membership changes. |

A subscribable project list lets a long-running Claude session pick up new projects without re-listing. We do **not** propose per-project resources (`askeffi://project/{id}/feed`) for v1 — that's a v2 conversation about whether real-time canon updates flow into Claude's context (probably not desirable; surprise context churn).

### Prompts catalog

MCP prompts are pre-canned, named templates the user can invoke. They keep the connector visible in the slash-menu and demonstrate the surface. Three for v1:

| Name | Arguments | Expansion |
|---|---|---|
| `brief-project` | `{ project_name?: string }` | "Brief me on project {project_name}. List connected sources, recent meetings, open Linear tasks, and the last sent report." Expands into a sequence of `list_projects → get_project → list_meetings → list_reports → search_canon`. |
| `whats-new` | `{ project_name?: string, since?: "week"\|"day"\|ISO-date }` | "What's new on {project_name} since {since}? Summarize new files, emails, meetings, and Linear updates." |
| `find-source` | `{ description: string, project_name?: string }` | "Find the source in {project_name} that matches: {description}. Use `search_canon` first, then `get_source` on the top match." |

These cover the three highest-value chat shapes from the existing app: project briefing, change-since-X, and source lookup. They're also the shapes most likely to make a chat-first user say "oh, this is useful" within the first 30 seconds — which is the v1 connector adoption job.

### Example chat exchanges

#### Example 1 — "what did Acme's CEO say about Q4 budget?"

```
User: What did the Acme CEO say about Q4 budget?

Claude: [calls list_projects → matches "Acme Inc"]
        [calls search_canon { project_id: <acme>, query: "what did the CEO say about Q4 budget" }]

Tool returns: answer + 3 citations
  - [1] meeting_2026-01-15: "We're cutting Q4 marketing by 30%..."
  - [2] email_thread_8d9f: thread with CFO confirming
  - [3] file_drive_x: Q4-plan.docx slide 4

Claude: According to the Jan 15 leadership sync, the CEO said they're cutting
Q4 marketing by 30% and rolling the savings into product hires [1]. The CFO
confirmed in the follow-up email thread that the cut takes effect Oct 1 [2].
The Q4-plan deck mirrors this [3].
```

#### Example 2 — "summarize last week's reports for all my projects"

```
User: Give me the last weekly report for each project I'm on.

Claude: [calls list_projects → 4 projects]
        [parallel: list_reports for each project_id]
        [parallel: get_report for the most recent run per project]

Claude: Here's last week across your 4 projects:
  - Acme: [summary from get_report content]
  - Globex: ...
  - Initech: ...
  - Umbrella: ...
```

#### Example 3 — pre-canned prompt: `/brief-project Acme`

```
User: /brief-project Acme

Claude: [expands the prompt template, follows the prescribed sequence]

Claude: Project Acme — Workspace "Sales", you're an internal user.
  - Sources: 3 Drive folders, 1 SharePoint site, Fathom (Lihu's recorder), Linear team "ACE"
  - 12 meetings in the last 30d (most recent: yesterday's pricing review)
  - 8 open Linear tasks (3 in-progress)
  - Last report: "Acme weekly" sent Mon 2026-05-05 to 4 recipients
  
Want me to dig into any of these?
```

### Comparison — what shape do existing connectors take?

Pulled from the deferred-tool catalog this Claude session has loaded (the production claude.ai connectors):

| Connector | Read tools | Write tools | Total | Shape |
|---|---|---|---|---|
| Slack | `slack_search_public`, `slack_search_public_and_private`, `slack_search_channels`, `slack_search_users`, `slack_read_channel`, `slack_read_thread`, `slack_read_user_profile`, `slack_read_canvas` | `slack_send_message`, `slack_send_message_draft`, `slack_schedule_message`, `slack_create_canvas`, `slack_update_canvas` | 13 | Heavy on per-surface variants (channel vs thread vs canvas). Mix of read + write. |
| Google Drive | `search_files`, `list_recent_files`, `read_file_content`, `download_file_content`, `get_file_metadata`, `get_file_permissions` | `create_file`, `copy_file` | 8 | Mostly read; minimal write (create/copy, no delete). |
| Gmail | `search_threads`, `get_thread`, `list_drafts`, `list_labels` | `create_draft`, `create_label`, `label_message`, `label_thread`, `unlabel_message`, `unlabel_thread` | 10 | Drafts (not direct sends) is the write affordance. Labels CRUD-able. |
| Linear | (deferred-tool list shows none with `linear_` prefix in this session — different connector shape) | — | — | — |
| **AskEffi (proposed v1)** | `list_projects`, `get_project`, `search_canon`, `browse_data`, `get_source`, `list_meetings`, `list_reports`, `get_report` | (none) | **8** | All read; canon is the answer surface. |

Two patterns to lift:

- **Drafts, not sends** (Gmail). When we add write in v2, the first thing should be "draft a scheduled report" / "draft an email rule" — never direct sends. Lower review-burden on the human-in-the-loop story.
- **Search + Read split** (Drive, Gmail). All three connectors split "find" from "fetch full body" — same as our `search_canon` / `browse_data` → `get_source` split. Confirms the pattern.

One pattern to **avoid**:

- **Per-surface explosion** (Slack's 13). Internal AskEffi has 25+ tools; resist the urge to expose all of them as 25 mcp tools. The `kind` discriminator on `browse_data` and `get_source` keeps the catalog at 8.

### Tool descriptions — what makes them readable to Claude

The internal tools are already optimized for an LLM-reader. Patterns to preserve verbatim:

- **Open with the verb + scope.** "Search project content semantically — documents, emails, and attachments." First 8 words tell the model what this tool is for.
- **Say what it returns and how big.** "Returns up to ~4,000 tokens by default. If results exceed the budget, a footer shows total count..." — Claude needs to know whether to call once or paginate.
- **Negative guidance.** "Use semantic_search instead for meaning-based questions" — telling the model when *not* to use a tool is as load-bearing as when to use it.
- **Concrete query examples in argument descriptions.** "'What decisions were made about the Q4 marketing budget allocation?' retrieves far better results than just 'budget'." Lifted directly from `agent/file_search_tool.py:62`.

The MCP server's tool descriptions should be a near-verbatim port of the internal `tool_with_coercion(...)` description strings, with the discriminator added where we collapsed (`browse_data` description names all 4 kinds it covers).

### Output shape — text vs structured content vs resource_link

Per modelcontextprotocol.io tool spec:
- `content[]` is the unstructured display channel (text the model reads).
- `structuredContent` (with optional `outputSchema`) is the typed payload the model can parse.
- `resource_link` content type lets a tool point at a URI Claude can fetch on demand.

Our shape:
- **Every tool emits both.** `content[0].type = "text"` is the human-readable render; `structuredContent` is the typed payload. Backwards-compatible per spec recommendation.
- **Citations are `resource_link` items.** Each citation in `search_canon`'s output is also surfaced as `{ type: "resource_link", uri: "askeffi://source/{kind}/{id}", name, description }`. Claude can fetch them via `get_source` or via resource read — two routes, same data. This is how Drive/Slack do it for their attachments.
- **`outputSchema` is published for every tool.** Cheap; pays off in stricter validation and better generated wrappers downstream.

### Tool annotations (MCP)

For every v1 tool:

```json
{
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": false,
    "title": "<human-readable name>"
  }
}
```

`openWorldHint: false` — the tool's effect is bounded to the AskEffi project namespace; it doesn't reach into the open world. This is a real signal to safety-review surfaces (Poll A's territory).

When v2 adds writes (e.g. `create_scheduled_report`), `readOnlyHint: false`, `destructiveHint: false` (creation isn't destructive), `idempotentHint: false`. The shape is reserved.

### v1 vs v2 tool count

- **v1: 8 tools.** Pure read. Ships without any product changes — every capability already exists internally.
- **v2 (post-v1 dogfood): +4 to 6.** Likely candidates: `draft_scheduled_report`, `update_project_member` (admin), `create_chat_share` (link to in-app chat), `query_workspace_usage`. Total ~12-14. Bounded by the "minimum lovable" axis — we don't go to 25 just because the internal surface is.

## Bottom — the open ends

### Dilemmas (z026 shape)

**z026/C-1 — Should `ask_effi` exist as a meta-tool?**
- Pro: One tool call ("ask Effi about X in project Y") matches the in-app UX users already know. Lowest cognitive load. Effi's own agent already does the multi-tool dance internally; we'd just wrap it.
- Con: Two LLMs in series (Claude → Effi → Claude). Tokens, latency, blame-routing for bad answers, the model's tendency to over-defer ("just ask the other model"). Also defeats the whole point of MCP — Claude *is* the agent, the tools are the surface.
- Dilemma: leaning No-for-v1; the explicit `search_canon` + `get_source` pair gives Claude direct ground-truth and matches what Slack/Drive/Gmail connectors do. Add `ask_effi` only if v1 feedback shows users miss the conversational-Effi feel. **Decision needed before shipping.** (Mark / Lihu call.)

**z026/C-2 — One `browse_data` with `kind` discriminator vs N per-kind tools.**
- Pro one-tool: 8 v1 tools instead of 14, simpler menu, one description to maintain, matches Drive's `search_files` (one tool, multiple file types).
- Pro N-tools: Each per-kind tool can have hand-tuned filters (emails want `sender`, Linear wants `assignee`, meetings want `attendee`); the universal-filter object loses fidelity.
- Dilemma: Going one-tool for v1 with the union-typed `filters` object. Re-evaluate after seeing real call patterns — if Claude consistently misuses the filter shape, split.

**z026/C-3 — `get_source` with `kind` discriminator vs `resource_link` URI fetch.**
- Pro tool: Familiar shape, easy to call, matches `get_email`/`get_file`/etc. internal tools.
- Pro resource: MCP-native; Claude can fetch by URI without a tool call; subscribable for live updates.
- Dilemma: Both. `get_source` as the tool *and* `askeffi://source/{kind}/{id}` as a resource URI — one mechanism, two entry points (the same dual-surface pattern `agent_tools/CLAUDE.md` documents). v1 ships the tool; the resource URI pattern is registered but only `askeffi://projects` is implemented.

**z026/C-4 — Scope a tool call to one project, or fan out.**
- The internal tools all take `project_id`. The connector COULD let Claude omit it and search across all the user's projects, fanning out internally. Simpler chat ergonomics.
- Risk: cross-project info bleed in the model's response. RLS prevents *unauthorized* access, but a user who has internal access to two unrelated clients does NOT want a Claude answer that mixes their data.
- Dilemma: Require `project_id` on every canon-touching tool in v1. `list_projects` is the ramp. Re-evaluate if users ask for cross-project search explicitly.

### Tools deliberately excluded from v1

| Tool | Reason |
|---|---|
| `ask_effi` (meta) | z026/C-1; defer until v1 feedback |
| `create_project` / `update_project` | Write surface; needs full RLS+role re-validation outside the agent flow |
| `create_scheduled_report` / `enable_report` / `disable_report` / `test_fire_report` | Writes; high blast radius (sends emails); v2 with draft-only mode like Gmail |
| `share_chat` | Writes; creates a public artifact; needs UX thinking |
| `add_member` / `remove_member` | Admin-only; needs role check; high risk of mis-target |
| `browse_github_repos` / `browse_github_code` / `search_github_code` | Internal flag-gated (`github_browse` flag); not generally available |
| `get_anchored_report` (raw) | Subsumed by `get_report`; the anchored-run gate is creator-or-recipient and should be in the same tool |
| `meeting_summary`, `list_action_items` (separate) | Subsumed by `list_meetings` returning these inline |
| `list_data_summary` | Surface-area-bloat for an external connector; the equivalent info ships in `get_project`'s response |
| `linear_summary` | Same as above; rolled into `get_project` if Linear is connected |
| File upload | Out of scope — uploading files into AskEffi from a Claude chat is a different UX bet (probably wants a draft-then-confirm flow) |
| OAuth-source-config tools | Adding a Drive folder / Fathom recorder is project-admin work; doesn't belong in chat |

### Friction zettels

(Capture deferred — none of the C-angle research hit Effi-or-skill-charter friction worth a zettel today. The dilemmas above are the real open ends.)

### Open inputs into the synthesis (for Sam)

- `search_canon` description language is the SOT for Claude's behavior; recommend cross-cutting with Poll A on whether MCP's `outputSchema` is enforced or hinted.
- The `kind` discriminator decision (C-2) is a soft surface-area lever — Sam's call on whether to push the tool count up or down based on the other angles' constraints.
- Poll D's scope tags map onto every row in the catalog; the placeholder `canon:read` / `projects:read` / `reports:read` partition is a starting point, not load-bearing.
