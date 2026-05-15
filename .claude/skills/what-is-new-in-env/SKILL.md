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

### 2a. Orphan-commit triage (don't dismiss wholesale)

Orphan commits (no `ENG-\d+`) are NOT automatically housekeeping. On a typical week ~30% of commits are orphan and a meaningful fraction of those are real product work that just didn't get an ENG tag. Triage before dismissing:

1. Filter orphans through the shipping-verb subject filter (see Step 5.5 for the full list): keep subjects starting with `feat`, `fix`, or `refactor`.
2. Group the survivors by directory cluster (e.g. all `nextjs-app/src/components/integrations/slack/*` commits together).
3. Each surviving cluster becomes a candidate "Untagged user-facing work" bullet in the executive summary — apply the Step 5.5 self-check to it like any other cluster.

The orphan-commits table in the verification guide (Step 7 / Step 8) is reserved for **truly** orphan commits — auto-memory snapshots (`memory: auto-update`), scratchpads, scattered chore commits, doc tweaks. Real feat/fix work that survives the triage above gets a proper executive-summary section, not a row in the orphan table.

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
4. **Orphan commits** — commits with no issue reference (already triaged in Step 2a)

### 4a. Cross-check: directory-based bucketing

Issue titles can hide distinct workstreams. A single issue may host two unrelated efforts in the same week, and the issue title will describe only one of them. Catch this with two checks:

**New top-level directories.** Enumerate paths added during the window:

```bash
git diff --diff-filter=A --name-only <prev>..<curr> | awk -F/ '{print $1"/"$2}' | sort -u
```

Any **new** top-level directory is a strong signal of a distinct workstream — they almost always represent a new product capability that the parent issue title doesn't describe. Each new top-level dir becomes its own candidate cluster in the executive summary, even if its commits already live under an existing ENG-xxxx grouping.

**Same-issue-different-paths split.** For any issue with >20 commits, list the unique top-level paths its commits touched:

```bash
git log <prev>..<curr> --grep='ENG-XXXX' --name-only --pretty=format: | awk -F/ 'NF>1 {print $1"/"$2}' | sort -u
```

If those paths span unrelated areas (e.g. `usegin/zettel/` AND `python-services/wiki/`), the issue is hosting multiple workstreams. Split into separate clusters in the summary, each with its own user-facing translation. Do not collapse them under the issue title.

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
| `chore: remove webChatHistory toggle (always-on)` | Web chat history (refresh-resume, history dropdown) is now live for all users — previously flag-gated |

If you can't articulate the user-facing impact, the change probably belongs in "Infrastructure / Not user-visible" rather than the executive summary.

### Step 5 self-check: before writing "X shipped"

Before placing any cluster in "User-facing features", confirm **all three**:

- **(a) Linear status** of the issue — or of its leaf-slice children — is `Done`. `Backlog` and `In Progress` do not ship.
- **(b) Shipping-verb evidence** — at least one commit with a shipping-verb subject (see Step 5.5 lists) touched **user-reachable** code paths. `tests/`, `docs/`, `experiments/`, and pure flag-registration changes are not user-reachable.
- **(c) Flag state, if applicable** — if the feature was gated behind a toggle, confirm one of: the toggle was removed in this window, the toggle was set to always-on, or the issue notes mention dogfooding-complete graduation.

If any of (a)/(b)/(c) fails, the cluster belongs in **"In flight"** (Step 5.5) or **"Not user-visible"** — not in "User-facing features."

## Step 5.5: Verify shipped, don't infer from references

A commit *mentioning* `ENG-XXXX` is not evidence that `ENG-XXXX` shipped. Distinguish the two commit classes below, and gate inclusion in the executive summary's "User-facing features" on **both** (i) at least one shipping-verb commit in the cluster AND (ii) Linear status `Done` on the issue or on a leaf-slice issue.

**Shipping verbs (subject-line prefixes that indicate user-reachable change):**

- `feat(...)` — but only when NOT qualified by scaffolding markers below
- `fix(...)`
- `refactor(...)` — only if it changes user-reachable behavior
- `feat(...): Green` — the Green phase of a TDD slice, where the production code lands

**Scaffolding patterns to watch for (these do NOT indicate shipping, even though they reference an issue):**

| Pattern | Why it's scaffolding |
|---------|---------------------|
| `slice 0` | Convention: slice 0 is substrate/setup, no user-facing change |
| `register .* (flag\|toggle)` | Flag registration only — the gated code may not exist yet |
| `feat(...): register .* flag` | Flag registration dressed as feat — still substrate |
| `RED` / `Red` / `test(... Red)` | TDD red phase — test exists, production code does not |
| `docs(spec)` / `docs(specs)` | Spec document only, no implementation |
| `test-plan` in subject | Spec/test-plan sync, no implementation |
| `chore(deps)` | Dependency bump |
| `chore(...): sync` | Doc/state sync, not user-facing |

**Graduation events (positive scaffolding pattern — these DO ship):**

When triaging `chore(...)` commits, grep first for these patterns — they look like housekeeping but are functionally shipping events because they flip a feature from flag-gated to live-for-all:

- `remove .*toggle`
- `retire .*toggle`
- `(always[.-]on)`
- `make .* (default|always-on)`
- subject or body mentions "flag removal" / "toggle retirement" / "graduate"

Promote graduation events to "User-facing features" with a one-liner of the shape: **"[Feature X] was flag-gated; now live for all users."** Cite the toggle name and the commit SHA in the verification guide.

**Routing rule:**

For each cluster, after applying the above:

- ≥1 shipping-verb commit on user-reachable paths **AND** Linear `Done` on issue / leaf-slice → **"User-facing features"**
- Only scaffolding commits, OR Linear status is `Backlog` / `In Progress`, OR commits touch only `tests/` `docs/` `experiments/` `flags/` → **"In flight — substrate landed, user-facing feature did NOT ship"** (a subsection inside "Not user-visible")
- Graduation event commits → **"User-facing features"**, framed as graduation

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

1. **User-facing features** — lead with what users can now do. Group by epic. 2-4 sentences each, focused on the outcome not the mechanism. Only include clusters that passed the Step 5 self-check and Step 5.5 routing rule. Include graduation events here, framed as "[Feature] was flag-gated; now live for all users."

2. **Untagged user-facing work** — surviving orphan clusters from Step 2a (real feat/fix work that didn't get an ENG tag). One bullet per directory cluster, in the same translated-to-user-impact style as #1. Omit this section if Step 2a produced nothing.

3. **Bug fixes** — "Fixed: [what was broken from the user's perspective]". One line each.

4. **Not user-visible (but important)** — a short section for infrastructure, internal tooling, SDK upgrades, and refactors that don't change user behavior. Keep it brief (1 sentence each) and label it clearly so executives can skip it. This is where technical changes that don't have a user-facing translation go.

   - **In flight — substrate landed, user-facing feature did NOT ship** — a sub-bullet list for clusters that referenced an `ENG-XXXX` but failed the Step 5 self-check (only scaffolding commits, or Linear status not `Done`, or flag still gated). Name the issue, note what substrate landed (specs / RED tests / flag registration / slice 0), and explicitly state that the user-facing feature is not yet live. This prevents the "treated as shipped because commits referenced it" failure.

**Tone:** Write as if briefing a CEO who has 2 minutes. Lead with impact. Be specific about what users can do, not how it works.

## Step 7: Generate the verification guide

This is for an agent that will systematically verify the deployment works. It needs to be concrete and actionable. Technical detail is welcome here — this is the right audience for it.

The verification agent has access to the app (via browser automation), the API, Sentry, and Railway logs — but it doesn't have credentials to third-party OAuth providers, and it can't set up test data from scratch. Write verification steps that account for this.

### Structure

Start the verification guide with a **discovery preamble** — steps the agent should take first to orient itself:

```markdown
## Verification Guide

### Prerequisites
1. Identify a test project: visit `/projects` and pick one with active data connections
2. Check which integrations are connected: Google Drive, SharePoint, email
3. Note: steps requiring OAuth flows (connect SharePoint, connect Drive) need a human — flag these as "Manual only" and verify the post-connection state instead
```

Then for each feature/bug fix, include:

- **Issue reference** — `ENG-XXX: Title` with Linear URL
- **What changed** — technical summary: which parts of the app were affected (pages, API endpoints, database, background jobs)
- **Acceptance criteria** — pulled directly from the Linear issue description. These are the primary verification targets.
- **How to verify** — specific, actionable steps with pass/fail criteria:
  - Which pages to visit (use relative paths, the agent knows the base URL)
  - Which API endpoints to call
  - What behavior to look for
  - **What failure looks like** — how to distinguish "broken" from "not set up" or "slow"
  - What edge cases to check
- **Requires human?** — flag steps that need OAuth flows, third-party credentials, or manual data setup. The agent should verify the post-action state, not perform the action itself.
- **Related issues** — siblings or children that provide additional context

### Prioritization

Assign each verification item a priority:
- **P0 — Regression risk:** Core flows that worked before and must still work (existing features touched by this release)
- **P1 — New feature verification:** New capabilities that need end-to-end confirmation
- **P2 — Edge cases and polish:** Error handling, empty states, UI details

The agent should work through P0 first, then P1, then P2. If time is limited, P0 alone is valuable.

### Pass/fail criteria

Every verification step should have an observable outcome. Don't write "verify it works" — write what "works" looks like:

| Weak | Strong |
|------|--------|
| "Verify the scope picker works" | "Open scope picker → expand a site → should see libraries with file counts within 5s. If spinner persists >10s or tree is empty, flag as broken." |
| "Check Sentry for errors" | "Search Sentry for `AttributeError` in the last hour. Zero new events = pass. Any new events = fail with link." |
| "Test the search" | "Ask Effi 'what files do we have about Q4?' — should return results within 10s. If 'no results found' for a workspace with known data, flag as broken." |

### Scaling guidance
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

### Untagged user-facing work
- [Cluster description, translated to user impact] (commits: `abc1234`, `def5678`)

### Bug Fixes
- Fixed: [what was broken, from the user's perspective]

### Not User-Visible
- [Brief description of infrastructure/internal changes]

#### In flight — substrate landed, user-facing feature did NOT ship
- **ENG-XXXX [Title]:** [what substrate landed — specs / RED tests / flag registration / slice 0]. User-facing feature is not yet live (Linear status: [Backlog | In Progress]).

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
