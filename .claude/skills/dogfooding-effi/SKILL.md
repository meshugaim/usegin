---
name: dogfooding-effi
description: Use the `effi` CLI against the team's dogfooding project on production AskEffi to ask Effi questions about our team's real work — decisions, status, discussions — grounded in our emails, Drive docs, meeting notes, and Linear tasks. Triggered when an agent needs context from team data, e.g., "what did we decide about X", "what's the current status of Y", "who raised Z last week", "summarize recent activity on <topic>". NOT for: general effi CLI work against other projects, or for building the CLI itself.
---

# Dogfooding on AskEffi

AskEffi is an AI assistant for project teams. It answers questions about shared project state by searching across connected data sources — documents, emails, meeting transcripts, Linear tasks — and synthesizing cited, fact-based answers. Effi is Claude Code's sister: Claude Code handles coding tasks; Effi handles project understanding.

Our team dogfoods Effi on our own real project. As an agent you can reach it via the `effi` CLI: ask Effi questions about what the team has been doing, deciding, or discussing, and get back synthesis grounded in our actual data — or call Effi's tools directly when you know what you need.

## The project

- Workspace: **AskEffi Workspace** (`f757a1a3-9955-45b3-8aab-50454a7c8001`)
- Project: **"AskEffi App (really)"** — id `1bf0f507-7627-40a0-be72-8d2eacc40dec`
- Stale twin to avoid: "AskEffi App" (`140376fb-5b32-454b-87fe-8f25165eaccc`). The linked project on this env is already the right one; only relevant if something dereferences by name.
- Connected sources today: Email, Google Drive. Live but untested: Linear. Coming: Fathom. Aspirational: GitHub, Claude Code sessions.

## Who you auth as

Engineering team members each have a `<name>@askeffi.ai` email — Nitsan, Lihu, Oria. Every agent uses *its human's* email, not a shared one.

You inherit the human's `~/.effi` profile, so the profile already exists. Run `effi auth status` to discover the email (output looks like `Profile: <name>@askeffi.ai:prod`), then use that as your `--profile` value. Examples below use `<your-email>` as a placeholder.

If the token is expired: `effi auth refresh` first. If no `:prod` profile exists yet (only a dev/test profile is set up), bootstrap it non-interactively — the human will fetch the OTP from their inbox:

```bash
# Derive <name> from `git config user.name` (lowercased first name) — don't ask.
effi auth login --env production --email <name>@askeffi.ai
# human pastes the code, then:
effi auth verify --env production --email <name>@askeffi.ai --code <code>
```

## Orienting

Before writing commands, read the CLI's own help — it's the source of truth and shorter than this skill:

```bash
effi --help
effi <subcommand> --help
effi docs list
effi docs show claude-usage   # the Claude-Code-specific doc
effi status                   # profile, linked project, session
```

`effi status` tells you whether the dogfooding project is linked. On dev envs it already is, so subcommands resolve the project implicitly. If not linked, either link it — `effi link --workspace f757a1a3-9955-45b3-8aab-50454a7c8001 --project 1bf0f507-7627-40a0-be72-8d2eacc40dec` — or ask the human to confirm before touching the link.

Override flags exist per-subcommand (`--project`, `--pr`, `--ws`) for the rare case where you need to target something other than the linked project — not needed for the common path.

## Two ways to use Effi

### 1. Ask Effi (natural-language synthesis)

The main path. Ask in natural language, Effi routes to its tools across Gmail/Drive/Linear/Fathom and returns a cited, synthesized answer.

```bash
effi --profile <your-email>:prod ask "summarize decisions from this week's meetings about <topic>"
```

**Session continuity.** By default `ask` *continues* the stored session — multi-turn follow-ups just work. Flags:
- `ask "..."` — continue (default)
- `ask --new "..."` — start fresh
- `ask --session <id> "..."` — resume a specific session

Long-running conversations are fine and encouraged. Do **not** use `effi chat` — it's an interactive REPL for humans; Claude drives via `ask`.

### 2. Drive Effi's tools directly

When you already know what you need, skip the synthesis hop and call the underlying tools. Examples that exist today:

```bash
# What's new in the project since N time
effi dev agent-tools project-delta --after 1w --types email,meeting --json

# A specific meeting (with transcript)
effi meetings show <meetingId> --transcript

# Project canon (files uploaded to Effi — see next section)
effi files list

# Fathom inclusion rules (read/manage meeting scoping)
effi fathom rules list
```

For anything the dedicated subcommands don't cover, use the `api` escape hatch:

```bash
effi api /workspaces
effi api /chat -f message=hello
```

`effi api` substitutes `{workspace}` and `{project}` from the active profile's link — **prefer templates over hardcoded IDs** so the same command works across profiles:

```bash
effi api /projects/{project}                  # not /projects/1bf0f507-...
effi api /workspaces/{workspace}/projects
```

See `effi api --help` for the full template list.

## Enriching Effi's context

Claude can upload files to the project canon so future Effi answers can cite them. Use this to capture summaries, decisions, or design notes you produced in a session — turns ephemeral agent output into durable project knowledge.

```bash
effi files add <path>                 # default: internal access
effi files add <path> --external      # mark external-facing
effi files list                       # list project-canon files
```

Note: `files list` shows only files uploaded via `files add` — it's the project-canon layer, separate from the connected sources (Gmail/Drive/Fathom) that Effi also searches. An empty `files list` just means nothing's been uploaded yet.

## Sharing a conversation

After a useful agent conversation, mint a read-only link for the human:

```bash
effi share --session <id> --title "<short title>"
```

Paste the URL back to the human so they can open it without re-running.

## Rough edges

The effi CLI is product code — maintained, shipped, ours. But it's pre-GA: you will hit gaps (missing endpoints, inconsistent flag coverage, surface gaps between agent-mediated and CLI-direct paths).

When you hit one:
1. **Surface it** to the human in the moment — don't work around silently.
2. **Fix inline** only if it's small and directly blocking you; otherwise flag it and keep moving.

Known gaps worth knowing:
- No project delete/archive anywhere in the stack (ENG-244, ENG-951, ENG-3125).
- `effi chat` is interactive — Claude uses `ask` instead (see above).
