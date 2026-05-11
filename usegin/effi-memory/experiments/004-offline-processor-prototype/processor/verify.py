"""Stage 5 — verify every cited ID in the proposal resolves.

A citation like `gmail:abcdef12` is valid iff its 8-char short ID appears:
  (a) as the first 8 chars of some delta item's UUID, OR
  (b) already in the current note's body (the model is allowed to re-cite
      anchors the human already trusted).

If ANY citation fails, the whole proposal is rejected — we'd rather have
zero hallucinated IDs in the wiki than a 95%-correct mixed proposal.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


_CITE_RE = re.compile(r"\b(gmail|fathom|drive|chat|file)\s*:\s*([0-9a-f]{6,12})\b", re.IGNORECASE)


@dataclass
class CitationCheck:
    kind: str           # gmail | fathom | drive | chat | file
    short_id: str       # the 6-12-hex captured
    resolved: bool
    source: str         # "delta" | "current_note" | ""


@dataclass
class VerifyReport:
    all_citations: list[CitationCheck]
    rejected: bool
    failures: list[CitationCheck]


def _collect_citations(parsed: dict) -> list[str]:
    """All raw `kind:hexid` strings the model produced."""
    seen: set[str] = set()
    order: list[str] = []

    def add(s: str | None) -> None:
        if not s:
            return
        for m in _CITE_RE.finditer(s):
            key = f"{m.group(1).lower()}:{m.group(2).lower()}"
            if key not in seen:
                seen.add(key)
                order.append(key)

    for p in parsed.get("proposals") or []:
        for c in p.get("citations") or []:
            add(c)
        add(p.get("rationale"))
        add(p.get("proposed_value"))
        add(p.get("current_value"))
    for h in parsed.get("headline_shifts") or []:
        for c in h.get("citations") or []:
            add(c)
        add(h.get("rationale"))
        add(h.get("proposed"))
        add(h.get("current"))
    add(parsed.get("summary"))
    return order


def _delta_short_ids(delta: dict) -> set[str]:
    return {it["id"][:8].lower() for it in (delta.get("new_items") or []) if it.get("id")}


def verify(parsed: dict, delta: dict, note_text: str) -> VerifyReport:
    delta_shorts = _delta_short_ids(delta)
    note_l = note_text.lower()
    citations: list[CitationCheck] = []
    failures: list[CitationCheck] = []
    for raw in _collect_citations(parsed):
        kind, short = raw.split(":", 1)
        short = short.lower()
        in_delta = short in delta_shorts
        # citation as exact `kind:short` should appear in note body
        in_note = f"{kind}:{short}" in note_l
        if in_delta:
            chk = CitationCheck(kind=kind, short_id=short, resolved=True, source="delta")
        elif in_note:
            chk = CitationCheck(kind=kind, short_id=short, resolved=True, source="current_note")
        else:
            chk = CitationCheck(kind=kind, short_id=short, resolved=False, source="")
            failures.append(chk)
        citations.append(chk)
    return VerifyReport(
        all_citations=citations,
        rejected=bool(failures),
        failures=failures,
    )
