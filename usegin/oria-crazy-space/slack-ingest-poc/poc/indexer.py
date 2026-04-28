"""JSONL indexer — append normalized messages to messages.jsonl.

Idempotent on `id` (channel_id:ts): repeat-ingest of the same row
overwrites in place rather than duplicating.  Implementation: load
the current file into a dict-by-id, upsert, rewrite.  This is fine
at POC scale (single channel, ≤100 messages).  Production would do
a real upsert (sqlite, real index).

The index file location defaults to
`usegin/oria-crazy-space/slack-ingest-poc/index/messages.jsonl`,
relative to this module's parent.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable


_DEFAULT_INDEX = (
    Path(__file__).resolve().parent.parent / "index" / "messages.jsonl"
)


def index_messages(
    records: Iterable[dict],
    *,
    path: Path | None = None,
) -> Path:
    """Upsert each record into the JSONL index by `id`. Returns path written."""
    target = path or _DEFAULT_INDEX
    target.parent.mkdir(parents=True, exist_ok=True)

    existing: dict[str, dict] = {}
    if target.exists():
        for line in target.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            existing[row["id"]] = row

    for rec in records:
        existing[rec["id"]] = rec

    # Sort by ts (newest-first) for human-readable diffs.
    ordered = sorted(existing.values(), key=lambda r: r["ts"], reverse=True)
    target.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in ordered) + "\n")
    return target


def load_index(path: Path | None = None) -> list[dict]:
    target = path or _DEFAULT_INDEX
    if not target.exists():
        return []
    return [json.loads(l) for l in target.read_text().splitlines() if l.strip()]
