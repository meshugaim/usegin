"""Stage 2 — annotate delta items with which tracked people they plausibly touch.

At small scale (single-digit items per run) this is a no-op for dropping —
we keep all items and let the synthesizer decide. But we still annotate
matches so the synthesizer prompt can emphasise person-touching items.

The annotation is a `matched_names: [str]` field per item, derived from
substring matching of names extracted from the wiki note. When the project-
delta gives us only an item title (no body), this is the only filtering
signal available; bodies live one indirection away inside Effi's index.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


# Bold names in the wiki note: **Guy Levit**, **Lihu Berman**, etc.
_BOLD_NAME_RE = re.compile(r"\*\*([A-Z][\w'\-]+(?:\s+[A-Z][\w'\-]+)+)\*\*")


def extract_tracked_names(note_text: str) -> list[str]:
    """Pull person/entity names from `**Bold**` markers in the note body.

    Falls back to a small set of token-shapes we know appear in our wiki
    style — multi-word capitalised tokens inside markdown bold.
    """
    seen: set[str] = set()
    out: list[str] = []
    for m in _BOLD_NAME_RE.finditer(note_text):
        name = m.group(1).strip()
        if name not in seen:
            seen.add(name)
            out.append(name)
    return out


def _name_tokens(name: str) -> list[str]:
    """Tokens to match against — first name + full name (lowercased)."""
    parts = name.split()
    tokens = {name.lower()}
    if parts:
        tokens.add(parts[0].lower())
    return list(tokens)


@dataclass
class AnnotatedItem:
    id: str
    entity_type: str
    title: str
    created_at: str
    matched_names: list[str]


def annotate(delta: dict, tracked_names: list[str]) -> list[AnnotatedItem]:
    items = delta.get("new_items", [])
    out: list[AnnotatedItem] = []
    for it in items:
        title_l = (it.get("title") or "").lower()
        matched: list[str] = []
        for name in tracked_names:
            for tok in _name_tokens(name):
                if tok in title_l:
                    matched.append(name)
                    break
        out.append(AnnotatedItem(
            id=it["id"],
            entity_type=it["entity_type"],
            title=it.get("title") or "",
            created_at=it.get("created_at") or "",
            matched_names=matched,
        ))
    return out
