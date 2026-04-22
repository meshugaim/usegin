---
name: usage-projection
description: Project whether Claude Code /usage consumption is on track to exhaust weekly or monthly limits before reset. Triggered by "/usage projection", "am I on track with my usage", "will I hit my limit", "project my usage", "usage burndown", "am I below projected limit", or similar questions about allowance pace.
---

# Usage Projection

Project whether current `/usage` consumption will exhaust the allowance before reset.

## When to Use

- User asks whether they're on track to use up their allowance
- User asks for a projection based on `/usage` data
- User wants to know if they're ahead of or behind pace

## Input

The `/usage` output. If not already in the conversation, ask the user to paste it.

## Method

Linear projection per bucket that has a percent-used and a reset datetime.

1. Get current UTC time — `date -u` via Bash. Do not rely on the conversation's `currentDate`.
2. Determine period length from the reset cadence:
   - Weekly bucket → 7 days
   - Monthly bucket (e.g. "Extra usage · Resets May 1") → days in the reset's calendar month
3. `period_start = reset_datetime − period_length`
4. `elapsed_fraction = (now − period_start) / period_length`
5. `projected_end_usage% = current_usage% / elapsed_fraction`
6. Verdict:
   - `< 95%` → **Below pace**
   - `95–105%` → **On pace**
   - `> 105%` → **Over pace** — report the projected end-of-period %

Skip the "Current session" bucket unless the user asks — rolling ~5h windows aren't meaningful to project.

## Output

Lead with the verdict per bucket, then the numbers.

Example:

> **Current week (all models):** Below pace. 72% used with ~86% of the period elapsed → projects to ~84% by Apr 23 7pm UTC. ~16pp headroom.
>
> **Extra usage:** Below pace. $80.01 / $150 (53%) with ~70% of the month elapsed → projects to ~$114 by May 1.

## Caveats

- Linear projection assumes steady usage — call it out if a bucket is close to the edge.
- `/usage` is approximate and local-only — excludes other machines.
