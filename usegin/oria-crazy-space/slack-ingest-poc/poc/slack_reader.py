"""Slack live-wire reader for the POC.

Stdlib-only (urllib + json) so the POC has no extra deps on top of
the monorepo's python toolchain. The slack-direct lib could be reused
if we wanted slack_sdk's retry logic, but the POC's needs are small
and a 60-line urllib client is more transparent than a wrapper.

Public surface:

* ``auth_test(token) -> dict`` — calls auth.test, returns parsed
  response (raises on Slack-level error)
* ``list_channels(token) -> list[dict]`` — public channels only,
  one page (POC scope; pagination not needed for the askeffi
  workspace at 3 channels)
* ``fetch_history(token, channel_id, *, limit=100) -> list[dict]`` —
  raw conversations.history rows newest-first
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


SLACK_API = "https://slack.com/api"


class SlackError(RuntimeError):
    """Raised when Slack returns ok=False or a non-2xx HTTP status."""


def _call(method: str, token: str, params: dict[str, Any] | None = None) -> dict:
    url = f"{SLACK_API}/{method}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        body = resp.read().decode("utf-8")
    data = json.loads(body)
    if not data.get("ok"):
        raise SlackError(f"slack {method} failed: {data.get('error', '<no error>')}")
    return data


def auth_test(token: str) -> dict:
    """Identity probe.  Returns the parsed Slack auth.test response."""
    return _call("auth.test", token)


def list_channels(token: str) -> list[dict]:
    """List public channels (single page; POC scope)."""
    data = _call(
        "conversations.list",
        token,
        {"types": "public_channel", "exclude_archived": "true", "limit": 200},
    )
    return data.get("channels", [])


def fetch_history(token: str, channel_id: str, *, limit: int = 100) -> list[dict]:
    """Newest-first messages for a channel.  Single page (POC scope)."""
    data = _call(
        "conversations.history",
        token,
        {"channel": channel_id, "limit": limit},
    )
    return data.get("messages", [])


def load_token(env_path: str | os.PathLike | None = None, *, key: str = "SLACK_BOT_TOKEN") -> str:
    """Load a token from a dotenv-style file. Default: ~/.config/ingest-poc/.env."""
    path = Path(env_path) if env_path else Path.home() / ".config" / "ingest-poc" / ".env"
    if not path.exists():
        raise FileNotFoundError(f"token env file not found: {path}")
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() == key:
            return v.strip().strip('"').strip("'")
    raise KeyError(f"{key} not found in {path}")
