"""Probe iii (continued) — does chat.delete work on a message that was
posted with a username/icon_emoji override?

Handoff said: 'chat.delete is blocked on overridden messages' — suspected,
not confirmed. Direct test: post 4 cases, attempt chat.delete on each.
"""

from __future__ import annotations

import json
import os

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

CHANNEL_ID = "C0B01M3MJMB"  # effi-dev


def attempt(c: WebClient, label: str, post_kwargs: dict) -> None:
    print(f"\n--- {label} ---")
    print(f"  post kwargs: {post_kwargs}")
    r = c.chat_postMessage(channel=CHANNEL_ID, text=f"probe-iii-delete {label}", **post_kwargs)
    ts = r["ts"]
    print(f"  posted ts={ts}")

    try:
        d = c.chat_delete(channel=CHANNEL_ID, ts=ts)
        print(f"  delete ok={d['ok']}")
        # Verify it's actually gone
        h = c.conversations_history(channel=CHANNEL_ID, latest=ts, limit=1, inclusive=True)
        msgs = [m for m in h["messages"] if m.get("ts") == ts]
        if msgs:
            print(f"  WARN: message still in history despite ok=True. subtype={msgs[0].get('subtype')} hidden={msgs[0].get('hidden')}")
        else:
            print(f"  confirmed: message removed from history.")
    except SlackApiError as e:
        print(f"  delete FAILED: {e.response.get('error')!r}")
        # Cleanup attempt with as_user=True (won't help but tries)
        try:
            c.chat_delete(channel=CHANNEL_ID, ts=ts, as_user=True)
        except Exception:
            pass


def main() -> int:
    bundle = json.load(open(os.path.expanduser("~/.cache/slack-direct/token.json")))
    c = WebClient(token=bundle["bot_token"])

    attempt(c, "control: no override", {})
    attempt(c, "username only", {"username": "oria"})
    attempt(c, "icon_emoji only", {"icon_emoji": ":sparkles:"})
    attempt(c, "username + icon_emoji", {"username": "claude-on-lihu", "icon_emoji": ":robot_face:"})

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
