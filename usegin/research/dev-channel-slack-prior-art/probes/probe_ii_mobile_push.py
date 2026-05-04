"""Probe ii — does mobile push notification show the username-overridden
identity ("oria") or the bot's identity ("Effi Spike")?

Posts THREE @-mention messages with different overrides into a DM with
the human running this script (who then watches their phone for the
banner / lock-screen previews). The bot DMs Lihu directly so Slack pushes
a notification.

Usage:
  doppler run -- uv run --project experiments/slack-direct \\
      python usegin/research/dev-channel-slack-prior-art/probes/probe_ii_mobile_push.py <slack_user_id>

The user_id must be the human's Slack U... id (not their email/name).
We open a DM with that user and post three messages.
"""

from __future__ import annotations

import json
import os
import sys
import time

from slack_sdk import WebClient


def main(target_user: str) -> int:
    bundle = json.load(open(os.path.expanduser("~/.cache/slack-direct/token.json")))
    c = WebClient(token=bundle["bot_token"])

    dm = c.conversations_open(users=target_user)
    ch = dm["channel"]["id"]
    print(f"opened DM channel: {ch}")

    cases = [
        {"username": "oria", "icon_emoji": ":sparkles:", "text": "probe-ii / 1: as oria — what does push show?"},
        {"username": "claude-on-lihu", "icon_emoji": ":robot_face:", "text": "probe-ii / 2: as claude-on-lihu — what does push show?"},
        {"username": None, "icon_emoji": None, "text": "probe-ii / 3: NO override (control) — what does push show?"},
    ]

    posted = []
    for i, case in enumerate(cases, 1):
        kwargs = {"channel": ch, "text": case["text"]}
        if case["username"]:
            kwargs["username"] = case["username"]
        if case["icon_emoji"]:
            kwargs["icon_emoji"] = case["icon_emoji"]
        r = c.chat_postMessage(**kwargs)
        posted.append((case, r["ts"]))
        print(f"  posted #{i}: username={case['username']!r}  icon={case['icon_emoji']!r}  ts={r['ts']}", flush=True)
        if i < len(cases):
            print("  (waiting 20s before next so you can read this banner)", flush=True)
            time.sleep(20)

    print()
    print("Messages will stay visible for 60s — check your phone now.")
    print("For each, note: what NAME shows in the push notification banner?")
    print("Then come back and tell the agent what you saw.")
    print()
    for remaining in range(60, 0, -10):
        print(f"  ...{remaining}s remaining")
        time.sleep(10)

    for case, ts in posted:
        try:
            c.chat_delete(channel=ch, ts=ts)
        except Exception:
            pass
    print("done — messages deleted.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: probe_ii_mobile_push.py <slack_user_id>", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1]))
