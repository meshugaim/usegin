"""Slack JSON -> canonical message.

The canonical shape (one record):

    {
        "id": "<channel_id>:<ts>",          # stable cross-pipeline id
        "channel_id": "C...",
        "channel_name": "social",           # caller supplies; not in history rows
        "ts": "1777415133.241249",          # raw Slack ts (lossless)
        "user_id": "U...",                  # author user id (or bot_id)
        "text": "...",                      # raw text (NOT URL-unwrapped here)
        "text_clean": "...",                # URL <...> wrappers stripped
        "thread_ts": "1777415133.241249" or None,
        "is_thread_parent": True/False,     # ts == thread_ts
        "subtype": "channel_join" or None,
        "kind": "user" | "system",          # "system" if subtype is set
    }

Decisions (z020 in whiteboard):

* shortcode emoji like `:sleeping_accommodation:` are preserved as-is.
* URLs wrapped in `<https://...>` are kept on `text` and stripped on
  `text_clean`.
* `<@USERID>` mention syntax is preserved verbatim in both fields.
* `channel_join` (and other subtypes) are indexed as `kind: system`.
  Querier's default behaviour is to filter `kind=system` out, but
  the data round-trips losslessly.
"""

from __future__ import annotations

import re
from typing import Any


# Matches `<https://...>` and `<http://...>` (no display label) and
# `<https://...|label>` (with label).  We replace the bracketed form
# with the inner URL (preserve label-less form's URL; for labeled
# form, surface the label since that's what the human typed).
_URL_BRACKET = re.compile(r"<((?:https?|mailto):[^|>]+)(?:\|([^>]+))?>")


def _strip_url_brackets(text: str) -> str:
    """Replace `<http(s)://...>` with `https://...` and `<url|label>` with `label`."""
    def _sub(m: re.Match[str]) -> str:
        url, label = m.group(1), m.group(2)
        return label if label else url
    return _URL_BRACKET.sub(_sub, text)


def normalize(
    raw: dict[str, Any],
    *,
    channel_id: str,
    channel_name: str,
) -> dict[str, Any]:
    """Map a single conversations.history row to canonical shape."""
    ts: str = raw["ts"]
    subtype = raw.get("subtype")
    user_id = raw.get("user") or raw.get("bot_id") or ""
    text = raw.get("text", "") or ""
    thread_ts = raw.get("thread_ts")
    is_thread_parent = bool(thread_ts) and thread_ts == ts

    return {
        "id": f"{channel_id}:{ts}",
        "channel_id": channel_id,
        "channel_name": channel_name,
        "ts": ts,
        "user_id": user_id,
        "text": text,
        "text_clean": _strip_url_brackets(text),
        "thread_ts": thread_ts,
        "is_thread_parent": is_thread_parent,
        "subtype": subtype,
        "kind": "system" if subtype else "user",
    }
