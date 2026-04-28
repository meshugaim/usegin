"""Query the index — substring search with citation.

POC scope: substring match on `text_clean` (case-insensitive,
unicode-safe).  No tokenization, no ranking, no semantic search.
Returns hits with citation:

    {
        "text": "...",
        "channel_name": "social",
        "channel_id": "C...",
        "ts": "1777415133.241249",
        "user_id": "U...",
        "citation": "#social @ 1777415133.241249 (U...)",
    }

Default filter: `kind=system` excluded.  Pass `include_system=True`
to surface channel-join etc.
"""

from __future__ import annotations

from typing import Any

from .indexer import load_index


def _format_citation(rec: dict) -> str:
    return f"#{rec['channel_name']} @ {rec['ts']} ({rec['user_id'] or '?'})"


def query(
    needle: str,
    *,
    include_system: bool = False,
    index: list[dict] | None = None,
) -> list[dict[str, Any]]:
    """Substring search; case-insensitive; unicode-preserving."""
    rows = index if index is not None else load_index()
    needle_low = needle.casefold()
    hits: list[dict[str, Any]] = []
    for rec in rows:
        if not include_system and rec.get("kind") == "system":
            continue
        haystack = rec.get("text_clean", "").casefold()
        if needle_low in haystack:
            hits.append(
                {
                    "text": rec.get("text_clean", ""),
                    "channel_name": rec["channel_name"],
                    "channel_id": rec["channel_id"],
                    "ts": rec["ts"],
                    "user_id": rec["user_id"],
                    "citation": _format_citation(rec),
                }
            )
    # Newest first.
    hits.sort(key=lambda h: h["ts"], reverse=True)
    return hits
