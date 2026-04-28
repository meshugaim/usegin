# Rooms

The rooms of the house. Each room is a part of the codebase mapped to a part of a home. Walking the house = visiting each room, briefly, noting state.

## The rooms

### Hearth

The dev loop. The warm core of the house — where the family gathers because being there feels good. A working pre-commit. Fast tests. Hot reload. Cached deps. Devcontainers that come up cleanly.

**State signals:** Warm (everything fast and working) / cool (slow, partly broken) / cold (the family avoids being here — `just dev` doesn't work).

**Tending:** Mother + Builder. Mother keeps the embers; Builder fixes when the hearth structurally fails.

### Kitchen

Where work gets prepared. Active development surfaces — the parts of the codebase the team is *currently* in. PRs, branches, work-in-progress files.

**State signals:** Tidy (PRs flowing, branches active and being merged) / cluttered (dishes stacking, branches piling) / chaos (uncommitted changes everywhere, lost what was being made).

**Tending:** Daily dishes (merge ready PRs). Wipe counters (squash, rebase, clean diffs). Mother's primary room.

### Pantry

The dependencies. `package.json`, `pyproject.toml`, lockfiles. What the house consumes.

**State signals:** Stocked (current versions, no security advisories) / low (deprecation notices, minor version drift) / empty (broken installs, missing packages, security alerts).

**Tending:** Periodic restocks (`bun update`, `uv sync`). Mother + the `update-deps` skill.

### Drawers

Config. `.env`, `settings.json`, `.claude/`, lint configs, justfile, package scripts. The small switches that change house behavior.

**State signals:** Organized (everything in its drawer, documented) / messy (env vars duplicated, configs scattered) / locked (config Lihu set up that nobody else can navigate).

**Tending:** Mother (occasional sort). Builder when restructuring config.

### Garden

Documentation. READMEs, CLAUDE.mds, decision docs, zettels.

**State signals:** Lush (recent, accurate, useful) / weedy (stale, slightly wrong, decorative) / overgrown (so much doc nobody reads any of it).

**Tending:** Garden needs *daily* small attention — pulling a weed (fix one stale claim), watering (add a recent learning). The big "weekend cleanup" garden cleanups never happen.

### Basement

Legacy code. Old features kept-but-not-active. Migrations from years ago. Boxes nobody's opened.

**State signals:** Dry (still useful, occasionally referenced) / damp (slowly rotting, increasingly orphaned) / flooded (legacy actively breaking, blocking new work).

**Tending:** Hyena (animal — finds bones) + Elephant (animal — knows what's still load-bearing) + Mother decides. Don't clean the basement in a Hunter pass.

### Attic

Archive. Things explicitly preserved — old experiments, important historical artifacts, things the team agreed to keep.

**State signals:** Organized (intentional, indexed) / dusty (forgotten preservation) / haunted (we kept this *because*… and nobody remembers why).

**Tending:** Sage walks the attic. Tikur if a haunted box turns out to be a buried lekach.

### Walls

API boundaries. Type contracts. The lines between rooms.

**State signals:** Solid (boundaries clear, contracts enforced) / cracking (silent contract drift, boundary erosion) / fallen (modules bleeding into each other; "everything imports everything").

**Tending:** Builder (fix structural). Mevaker (audit periodically).

### Windows

Observability. Logs, metrics, traces, dashboards, Sentry.

**State signals:** Clear (we can see in/out — logs flow, dashboards meaningful) / smudged (data flowing but hard to read) / boarded (we can't see — broken logging, dark Sentry, dashboards that mean nothing).

**Tending:** Mother (regular wipe). Owl (animal — watches the night windows).

### Doors

External integrations. Stripe, Sentry, Supabase, GitHub, Slack, Linear.

**State signals:** Working (open in both directions) / sticky (intermittent failures) / locked (broken integration, auth expired, webhook dead).

**Tending:** Owl (sleeping integrations) + Mother (daily checks).

### Foundations

Infrastructure. Deploy. DB. The substrate everything sits on.

**State signals:** Solid / settling (small drift) / cracking (bigger drift, scary).

**Tending:** Builder (any structural fix). Mevaker (audit). **Never tend foundations alone** — pair with the human.

### Yard

Public-facing surfaces. Marketing site, customer-visible UI, landing pages.

**State signals:** Mowed (looks intentional) / overgrown (out of sync with product) / weeds (visibly broken).

**Tending:** Mother + Builder, and usually involves the human (the yard is what neighbors see).

### Mailbox

Inbox. Sentry alerts, customer messages, Linear assigned issues.

**State signals:** Empty (read and triaged) / piling (pending) / overflowing (drowning, signal lost).

**Tending:** Daily triage. Mother + Mevaker pair (Mother reads + categorizes; Mevaker calls red on signal-loss).

## Walking the house

A walk visits *each room*, briefly. The output is `walks/<YYYY-MM-DD>.md` with one line per room:

```markdown
# House walk — 2026-04-28

- Hearth: warm. `just agent-dev` clean.
- Kitchen: 8 dishes (open PRs, two stale).
- Pantry: low. 3 minor-version drift, no advisories.
- Drawers: organized.
- Garden: weedy. CLAUDE.md in `python-services/` has 3 broken refs.
- Basement: dry.
- Attic: dusty.
- Walls: solid.
- Windows: smudged. Sentry dashboard for `agent_api` mostly empty post-migration.
- Doors: working. Stripe webhook flapped twice this week — owl flag.
- Foundations: solid.
- Yard: mowed.
- Mailbox: piling. 12 Sentry alerts, 4 unread customer messages.

## Tending pass for today

- Merge dish #1 (ENG-XXXX) — clearly ready
- Pull 3 weeds in the python-services CLAUDE.md
- Restock pantry — bun update on the lowest-risk three packages

## Escalations

- Sentry dashboard (windows) — Builder job, not Mother. Queue.
- Stripe webhook flapping — Owl scan needed.
```

That's a complete walk record. Short, structured, honest.
