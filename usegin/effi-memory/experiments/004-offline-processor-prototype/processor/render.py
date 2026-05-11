"""Stage 4 — render the parsed proposal as a human-readable markdown diff.

Sections:
  ## Summary           — model's 2-3 sentence overall delta
  ## Updates           — per-person field changes (current → proposed)
  ## No-change         — explicit no-change entries (absence-of-evidence rows)
  ## New people        — newly tracked entities
  ## Headline shifts   — meta-changes to the headline-shifts section

A confidence badge and citation list rides each row.
"""

from __future__ import annotations

from typing import Any


_CONF_BADGE = {"high": "🟢 high", "medium": "🟡 med", "low": "🔴 low"}


def _cite_list(cs: list[str]) -> str:
    if not cs:
        return "_(no citations — absence-of-evidence claim)_"
    return ", ".join(f"`{c}`" for c in cs)


def _conf(c: str | None) -> str:
    return _CONF_BADGE.get((c or "").lower(), f"_{c}_")


def render(parsed: dict, watermark: str, n_items: int) -> str:
    lines: list[str] = []
    lines.append("# Proposal — `notes/activity.md`\n")
    lines.append(
        f"Watermark: `{watermark}`. New artifacts considered: **{n_items}**.\n"
    )

    summary = parsed.get("summary", "").strip()
    if summary:
        lines.append("## Summary\n")
        lines.append(summary + "\n")

    proposals = parsed.get("proposals", []) or []

    def by_kind(kind: str) -> list[dict[str, Any]]:
        return [p for p in proposals if p.get("kind") == kind]

    updates = by_kind("update")
    no_changes = by_kind("no-change")
    new_people = by_kind("new-person")

    if updates:
        lines.append("\n## Updates\n")
        for p in updates:
            lines.append(
                f"### {p.get('person','?')} — field `{p.get('field','?')}` "
                f"({_conf(p.get('confidence'))})\n"
            )
            cur = (p.get("current_value") or "").strip()
            nxt = (p.get("proposed_value") or "").strip()
            lines.append(f"- **current:** {cur or '_(none)_'}")
            lines.append(f"- **proposed:** {nxt or '_(none)_'}")
            lines.append(f"- **rationale:** {p.get('rationale','').strip()}")
            lines.append(f"- **citations:** {_cite_list(p.get('citations') or [])}\n")

    if new_people:
        lines.append("\n## New people\n")
        for p in new_people:
            lines.append(
                f"### {p.get('person','?')} ({_conf(p.get('confidence'))})\n"
            )
            lines.append(f"- **proposed row:** {(p.get('proposed_value') or '').strip()}")
            lines.append(f"- **rationale:** {p.get('rationale','').strip()}")
            lines.append(f"- **citations:** {_cite_list(p.get('citations') or [])}\n")

    headline = parsed.get("headline_shifts", []) or []
    if headline:
        lines.append("\n## Headline shifts\n")
        for h in headline:
            lines.append(
                f"### {h.get('kind','?')} ({_conf(h.get('confidence'))})\n"
            )
            cur = (h.get("current") or "").strip()
            nxt = (h.get("proposed") or "").strip()
            if cur:
                lines.append(f"- **current:** {cur}")
            lines.append(f"- **proposed:** {nxt}")
            lines.append(f"- **rationale:** {h.get('rationale','').strip()}")
            lines.append(f"- **citations:** {_cite_list(h.get('citations') or [])}\n")

    if no_changes:
        lines.append("\n## No-change (explicitly confirmed)\n")
        for p in no_changes:
            lines.append(
                f"- **{p.get('person','?')}** ({_conf(p.get('confidence'))}) — "
                f"{p.get('rationale','').strip()}"
            )

    return "\n".join(lines) + "\n"
