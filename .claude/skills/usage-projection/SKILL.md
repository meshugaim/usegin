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

Two passes. Always show the baseline. Offer the refinement.

### Pass 1 — Baseline (linear, calendar time)

For each bucket that has a percent-used and a reset datetime:

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

Report the baseline. Then move to Pass 2.

### Pass 2 — Active-hours refinement (offer via AskUserQuestion)

Calendar projection treats 3am and 3pm as equivalent. Real usage clusters in waking/working hours, so the calendar elapsed-fraction usually overstates effective elapsed time and understates headroom.

Ask the user:

> **Refine with an active-hours model?**
> - Yes, use defaults (09:00–23:00 local, all days counted equally)
> - Yes, custom window
> - No, baseline is enough

If **defaults**: confirm the local timezone if not already known (ask once).
If **custom**: ask for `start_hour`, `end_hour`, weekend treatment (`full` / `half` / `off`), and timezone.
If **no**: stop.

Then recompute:

1. `active_hours_per_day(d)` = `(end_hour − start_hour) × weekend_factor(d)`
   where `weekend_factor = 1.0` for weekdays, and `1.0` / `0.5` / `0.0` for weekends per the user's choice.
2. Iterate each day from `period_start` to `period_end` in local tz; sum `active_hours_per_day` → `total_active_hours`.
3. Similarly sum from `period_start` to `now` → `elapsed_active_hours` (partial current day: clip to `[start_hour, end_hour]`).
4. `elapsed_fraction_active = elapsed_active_hours / total_active_hours`
5. `projected_active% = current_usage% / elapsed_fraction_active`
6. Same verdict thresholds as baseline.

Do the arithmetic in Bash (`python3 -c` is fine) — don't eyeball it.

## Output

Show baseline first; if the user approved refinement, append the active-hours line per bucket.

Example (baseline only):

> **Current week (all models):** Below pace. 72% used with ~86% of the period elapsed → projects to ~84% by Apr 23 7pm UTC. ~16pp headroom.
>
> **Extra usage:** Below pace. $80.01 / $150 (53%) with ~70% of the month elapsed → projects to ~$114 by May 1.

Example (with active-hours refinement, 09:00–23:00 Asia/Jerusalem, weekends full):

> **Current week (all models):**
> - Baseline: Below pace — projects to ~84%.
> - Active-hours: On pace — ~82% of active hours elapsed, projects to ~88%.

## Caveats

- Linear projection assumes steady usage — call it out if a bucket is close to the edge.
- `/usage` is approximate and local-only — excludes other machines.
