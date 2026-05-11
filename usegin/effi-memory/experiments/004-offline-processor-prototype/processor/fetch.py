"""Stage 1 — read the wiki note + run project-delta against its watermark.

Output:
  - note_text: full markdown body (including frontmatter, for synthesis context)
  - watermark: ISO date string from frontmatter `updated:`
  - delta: parsed JSON from `effi dev agent-tools project-delta --after <watermark>`
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import frontmatter


@dataclass
class FetchResult:
    note_text: str
    note_frontmatter: dict
    watermark: str
    delta: dict


def _normalize_watermark(updated) -> str:
    """Turn a frontmatter `updated:` into a precise ISO timestamp.

    Date-only (`2026-05-08`) → end-of-day UTC (`2026-05-08T23:59:59Z`), so
    the delta is "strictly after the day the note was authored" — items
    that happened on the authoring day are assumed already incorporated.

    Full timestamp → used as-is.
    """
    s = str(updated)
    if "T" not in s:
        return f"{s}T23:59:59Z"
    return s


def read_note(note_path: Path) -> tuple[str, dict, str]:
    raw = note_path.read_text()
    post = frontmatter.loads(raw)
    updated = post.metadata.get("updated")
    if not updated:
        raise ValueError(f"note {note_path} has no `updated:` frontmatter")
    watermark = _normalize_watermark(updated)
    return raw, dict(post.metadata), watermark


def run_project_delta(
    watermark: str,
    profile: str = "dogfooding",
    types: str = "email,meeting,file",
    no_conversations: bool = True,
) -> dict:
    cmd = [
        "effi", "--profile", profile,
        "dev", "agent-tools", "project-delta",
        "--after", watermark,
        "--types", types,
        "--json",
    ]
    if no_conversations:
        cmd.append("--no-conversations")
    proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(proc.stdout)


def fetch(note_path: Path) -> FetchResult:
    note_text, fm, watermark = read_note(note_path)
    delta = run_project_delta(watermark)
    return FetchResult(
        note_text=note_text,
        note_frontmatter=fm,
        watermark=watermark,
        delta=delta,
    )
