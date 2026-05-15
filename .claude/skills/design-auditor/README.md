# design-auditor

Vendored third-party Claude Code skill: UI/UX audit against 19 design rules (Nielsen heuristics, WCAG, visual consistency, ethics).

**Upstream:** github.com/Ashutos1997/claude-design-auditor-skill — see [SOURCE.md](SOURCE.md) for pinned commit + refresh steps.

## What it does

Given a route, page, component, or Figma URL, produces a prioritized report with:
- Overall score (0–100) plus subscores for Accessibility, Ethics, Usability
- Severity-grouped findings (🚫 Blocker / 🔴 Critical / 🟡 Warning / 🟢 Tip)
- Per-finding: file:line + before/after code diff
- Per-category breakdown across all 19 categories

Output is structured for downstream agent consumption — hand a report straight to Wes.

## Triggers

The skill auto-fires on phrases like *"audit my UI"*, *"check my design"*, *"is this accessible?"*, *"design review"*, *"WCAG"*, *"dark patterns"*, *"Nielsen heuristics"* — see SKILL.md frontmatter for the full trigger list.

## Team conventions

- **Reports live at:** `docs/design-audits/<route-slug>.md`. See [`docs/design-audits/README.md`](../../../docs/design-audits/README.md).
- **One report per route or tightly-related route group.** Don't produce one mega-report.
- **Cross-surface findings:** aggregate into `docs/design-audits/cross-cutting.md` at the end of a sweep.
- **Linear:** file an umbrella issue at sweep start; keep findings in the markdown unless/until you schedule fixes.

## Cost note

SKILL.md is ~150KB, with 15 references totaling ~200KB. On invocation, only the entrypoint loads; reference files load lazily as findings touch each category. Reports for a single ~300-line component typically run 800–1500 lines. Plan triage time accordingly.
