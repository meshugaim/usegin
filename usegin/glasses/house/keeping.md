# Keeping

What housekeeping looks like, day to day, week to week. The vocabulary of ongoing tending.

## The chores

### Dishes

Open PRs. They were used for cooking; now they need to be washed and put away. A house with the dishes done is a livable house; a house with dishes piling up *feels* worse than the same house with dishes done, even before any concrete cost.

**Healthy:** Dishes done within ~48h of the meal. PRs merged or explicitly returned to the cook for revision within a couple of days.

**Drift:** PRs sitting >1 week. The cook walks past them and feels guilt; the cook stops cooking.

**Tending:** Mother — daily walk through the dishwasher. Either merge or return-with-pointed-feedback.

### Laundry

Stale branches. Used, set down, forgotten. Smells if left long enough.

**Healthy:** Branches deleted within a week of merge. Branches with no commits in 30 days flagged.

**Drift:** Repo has 80 branches; nobody can remember what most are.

**Tending:** Periodic laundry day. `git branch -r` review. Hyena (animal) finds bones; Mother decides what to delete.

### Pantry

Dependency restocks. Without them, things you cook stop tasting right.

**Healthy:** Quarterly minor-version sweeps. Major-version migrations on intent. Security advisories cleared promptly.

**Drift:** Lockfile from a year ago. `bun install` produces hundreds of warnings. Security advisories piled up.

**Tending:** `update-deps` skill — Mother runs it on a cadence.

### Garden weeding

Doc edits. Stale claims, broken refs, outdated examples.

**Healthy:** Docs match the code within a few days of changes.

**Drift:** Docs claim things that haven't been true for months. New people read them and get confused.

**Tending:** Daily small. Pull one weed when you walk past it. Don't schedule "documentation sprints" — they don't happen.

### Hearth-tending

Keeping the dev loop warm. Pre-commit working, tests fast, devcontainer clean, deps cached.

**Healthy:** `just agent-dev` brings the dev server up in <30s. `bun test` runs in <60s on the relevant slice. New devcontainer comes up cleanly.

**Drift:** First-run setup is broken. Tests slow because the cache is stale. The team avoids running `just dev` because it's flaky.

**Tending:** Builder for structural fixes. Mother for daily small (clear caches, restart, rebuild).

### Wall-checking

Are the API boundaries holding? Are types still accurate? Are the contracts the tests claim still real?

**Healthy:** Type-check clean, contract tests pass, no `any` creep.

**Drift:** Types getting wider. Contract tests skipped because they're slow. Module boundaries blurring.

**Tending:** Mevaker audit. Builder fixes. Suricate (animal — wild glass) chirps when patterns drift.

### Mailbox triage

Sentry, customer mail, Linear assignments. Inputs from outside.

**Healthy:** Empty within 24h — every alert/message is either acted on, queued, or explicitly ignored.

**Drift:** Inbox-zero is a memory. Important signals get lost in noise.

**Tending:** Daily triage. Owl (animal) for the night-arrived ones.

### Window-cleaning

Observability. Are we still seeing what we need to see?

**Healthy:** Dashboards are current and meaningful. Sentry catches what we want it to catch. Logs are queryable.

**Drift:** Dashboard shows what was useful last quarter. Half the alerts are noise. Logging changed and the queries didn't.

**Tending:** Owl + Builder. Mevaker audits.

### Foundation-checking

Infra, deploy, DB. The substrate.

**Healthy:** Deploys boring. DB queries on plan. Backups verified.

**Drift:** Deploy "usually works." Migrations cause incidents. Backups never tested.

**Tending:** Builder + the human. **Never tend foundations without the human in the loop** — blast radius is too high.

## Cadences

| Frequency | What gets done |
|---|---|
| **Daily** | Dishes (PR merge pass), garden weed pulls (one or two doc edits), mailbox triage, hearth check (`just agent-dev` quick run). |
| **Weekly** | Walk the house. Note state of each room. Prioritize next week's chores. |
| **Monthly** | Pantry restock. Laundry day. Mevaker audit on four axes. |
| **Quarterly** | Wall-check. Window-clean. Basement sort (Hyena pass + Elephant interpretation). Attic walk-through. |
| **As needed** | Foundation-check. Yard work. Renovation projects (Builder mode). |

## Tending vs renovation

Mother *tends* — small, frequent, low-blast. Builder *renovates* — big, structural. The categorical mistake is to start tending and silently slip into renovating. ("I was just going to clean the kitchen, but actually we should redesign the whole layout…") When the urge to renovate appears mid-tending, **stop the tending pass, name the renovation as a separate piece of work**, and decide explicitly.

## Tending vs incident

Mother tends; Tikur investigates incidents. The categorical mistake is to silently absorb an incident into a tending pass. ("I noticed mold in the basement — let me just bleach it…") No. Mold is incident territory. Stop tending; spawn a Tikur (size: medium); only resume after the lekach lands.

## What "house is in order" means

A house is in order when:

- A new family member could walk in and the rules are clear.
- Sage could walk in tomorrow after a long absence and feel oriented.
- Daily life produces dishes — but the dishes get done.
- The hearth is warm; the family wants to be here.

It does not mean: every room perfect, every drawer organized, every doc current. Houses don't work that way. Houses work when *the cadence works* — chores get done at the right rhythm, and small messes don't accumulate into big ones.

The Mother archetype's whole job is keeping the cadence.
