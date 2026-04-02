---
name: what-is-new-in-env
description: "Generate a deployment changelog comparing the current and previous state of staging or production. Use this skill whenever the user asks what's new in an environment, what shipped, what changed in production/staging, wants deployment diffs or release notes, needs to brief executives on recent releases, or wants to prepare an agent to verify that newly deployed features work. Even casual variants like 'what went out today', 'anything new in prod', or 'what do I need to test in staging' should trigger this skill."
---

# What's New in Environment

Compare two deployment states and produce two artifacts:
1. **Executive summary** — for humans who need the "what and why" without technical detail
2. **Verification guide** — for an agent to systematically confirm that everything works in the target environment

## Inputs

| Parameter | Default | Notes |
|-----------|---------|-------|
| Environment | `production` | `staging` or `production` |
| Current state | latest successful deployment | Can specify a SHA or deployment ID |
| Previous state | second-latest successful deployment | Can specify a SHA or deployment ID |

Parse these from the user's message. If they just say "what's new in staging", use defaults with env=staging.

## Step 1: Get the commit range

**Primary: Railway deployments**

Fetch recent deployments for both services:

```bash
railway-dev deployments --json -e <env> -n 10
```

From the results:
1. Filter to deployments with `status: "SUCCESS"`
2. Both `nextjs-app` and `python-services` deploy from the same branch, so find the **two most recent distinct commit SHAs** across all successful deployments
3. The commit SHA lives in the deployment's `raw` field — look for `raw.meta.commitHash` or `raw.meta.commitSHA`. Inspect the raw object if the field name differs.

If the user specified custom comparison points, use those instead.

**Fallback: git branch comparison**

If Railway CLI isn't authenticated or returns an error, fall back to git:

```bash
git fetch origin
# For "what's new in staging" (staging vs production):
git log origin/production..origin/staging --oneline --no-merges

# For "what's new in prod" (production vs its previous state):
# Use the staging-to-production delta, or recent production commits
git log origin/staging..origin/production --oneline --no-merges
```

Tell the user: "Railway CLI isn't available — using git branch comparison instead. For exact deployment-level precision, run `! railway login`."

Once you have both SHAs:

```bash
git log <previous-sha>..<current-sha> --oneline --no-merges
```

## Step 2: Extract Linear issues

Scan all commit messages (full body, not just subject line) for `ENG-\d+` references. Deduplicate — multiple commits often touch the same issue.

Also note any commits that don't reference an issue — they go in a separate section.

## Step 3: Enrich from Linear

For each unique issue ID:

```bash
plan show <ENG-XXX> --json
```

Capture:
- `identifier`, `title`, `description` — the core context
- `labels` — tells you if it's a feature, bug, chore, docs
- `treeContext.parent` — the epic/feature this belongs to (important for grouping)
- `children` — sub-tasks, useful for verification scope
- `status` — should be Done or In Progress

If a parent issue exists, it represents the higher-level feature. Group child issues under their parent for the executive summary.

When there are many issues (>8), batch the `plan show` calls efficiently — don't run them one at a time if you can parallelize.

## Step 4: Group changes

Organize by:
1. **Parent issue / epic** — features that have a parent get grouped under it
2. **Label type** — within each group: features first, then bugs, then chores
3. **Ungrouped** — standalone issues without a parent
4. **Orphan commits** — commits with no issue reference

## Step 5: Translate technical changes to business impact

This is a critical thinking step — do it before writing either output.

For every change, ask: "What does this mean for someone who uses the product?" Translate implementation details into user-facing consequences. This translation is what separates a useful changelog from a git log dump.

Examples of the translation you need to do:

| Technical change | Business impact |
|-----------------|----------------|
| `drive_connections` renamed to `cloud_connections` with provider column | Support for multiple cloud storage providers (not just Google Drive) |
| New `data_items` table with unified schema | All content types now appear consistently in the data tab |
| `request_sync()` API with cooldown | Users can trigger re-syncs without overwhelming external services |
| OAuth CSRF state validation on callbacks | Protection against account takeover attacks during login |
| DOMPurify sanitization for email HTML | Prevents malicious content in displayed emails |
| `meeting_inclusion_rules` table + LLM evaluation endpoint | Users define rules for which meetings to include instead of manually managing a blocklist |

If you can't articulate the user-facing impact, the change probably belongs in "Infrastructure / Not user-visible" rather than the executive summary.

## Step 6: Generate the executive summary

This is for humans — product managers, executives, stakeholders. They want to know what shipped and why it matters, not how it was implemented.

**Hard rules — the exec summary must never contain:**
- Backtick-formatted code or identifiers
- Database table or column names (`data_items`, `cloud_connections`, `scope_id`)
- Function, method, or API names (`request_sync()`, `get_drive_file`, `create_workspace_with_owner`)
- File paths (`sync_items.py`, `src/lib/auth`)
- Technical library names (`DOMPurify`, `PostgREST`)
- Semver numbers or model identifiers (`0.1.53`, `gemini-2.5-flash`)

If you catch yourself writing any of these, stop and translate to business language using the table from Step 5. The verification guide is where technical details belong.

**Structure:**

1. **User-facing features** — lead with what users can now do. Group by epic. 2-4 sentences each, focused on the outcome not the mechanism.

2. **Bug fixes** — "Fixed: [what was broken from the user's perspective]". One line each.

3. **Not user-visible (but important)** — a short section for infrastructure, internal tooling, SDK upgrades, and refactors that don't change user behavior. Keep it brief (1 sentence each) and label it clearly so executives can skip it. This is where technical changes that don't have a user-facing translation go.

**Tone:** Write as if briefing a CEO who has 2 minutes. Lead with impact. Be specific about what users can do, not how it works.

## Step 7: Generate the verification guide

This is for an agent that will systematically verify the deployment works. It needs to be concrete and actionable. Technical detail is welcome here — this is the right audience for it.

For each feature/bug fix, include:

- **Issue reference** — `ENG-XXX: Title` with Linear URL
- **What changed** — technical summary: which parts of the app were affected (pages, API endpoints, database, background jobs)
- **Acceptance criteria** — pulled directly from the Linear issue description. These are the primary verification targets.
- **How to verify** — specific, actionable steps:
  - Which pages to visit (use relative paths, the agent knows the base URL)
  - Which API endpoints to call
  - What behavior to look for
  - What edge cases to check
- **Related issues** — siblings or children that provide additional context

The verification guide should be thorough enough that an agent with access to the environment can work through it without needing additional context.

**Scaling guidance:**
- **Small delta (<10 issues):** Full detail for every issue.
- **Medium delta (10-20 issues):** Full detail for features and bugs. One-liner for chores.
- **Large delta (20+ issues):** Group related issues under their parent epic with combined verification steps. Don't repeat shared context across sibling issues. Chores and docs get a summary table, not individual sections.

## Step 8: Output

### Conversation output
This is the primary deliverable — what the user reads immediately. Keep it concise and audience-aware:

- Use markdown headers for structure
- The executive summary in conversation should match the tone of a verbal briefing — polished, no jargon
- The verification guide in conversation can be a condensed version with key areas to check, pointing to the saved file for full detail
- Total conversation output should be scannable in under 2 minutes

### Saved file
Save to `docs/releases/<env>-<YYYY-MM-DD>.md`.

If that file already exists (multiple deployments in one day), append a counter: `<env>-<YYYY-MM-DD>-2.md`.

The saved file has the full, detailed versions of both sections. Use this template:

```markdown
# What's New in [Environment] — [YYYY-MM-DD]

**Deployment range:** `<previous-sha-short>` → `<current-sha-short>`
**Period:** [previous deploy time] → [current deploy time]
**Commits:** [N] | **Issues:** [M]

---

## Executive Summary

### [Epic/Feature Name]
[Human-readable description of what shipped and why it matters.
No technical terms. No code. Pure business impact.]

### Bug Fixes
- Fixed: [what was broken, from the user's perspective]

### Not User-Visible
- [Brief description of infrastructure/internal changes]

---

## Verification Guide

### ENG-XXX: [Issue Title]
**Type:** [label] | **Status:** [status] | [Linear URL]

**What changed:**
- [Technical description — code, tables, endpoints all welcome here]

**Acceptance criteria:**
- [ ] [Criterion from Linear]

**Verify in [env]:**
1. [Concrete step]
2. [Another step]

---

### Commits without issue references
| SHA | Message |
|-----|---------|
| `abc1234` | [message] |
```

## Edge cases

- **Railway not authenticated:** Fall back to git branch comparison. Tell the user what you're doing and suggest `! railway login` for precision.
- **No new deployments:** If both SHAs are the same, say "No new deployments since the last check."
- **Large deltas (>20 issues):** Aggregate aggressively in the executive summary (group under epics, skip individual issue detail). In the verification guide, group sibling issues under their parent with combined steps.
- **Issues without acceptance criteria:** Note this in the verification guide — "No acceptance criteria found. Verify based on issue description and commit changes."
- **Commits referencing issues that are in other projects:** Some commits may reference non-ENG issues. Skip `plan show` for those but still list them.
