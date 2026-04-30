"""Probe iii — does chat.update preserve username/icon_emoji overrides set
on the original chat.postMessage(... username=..., icon_emoji=...), or
does the update need to re-pass them?

Three sub-tests:
  A. post with override → update WITHOUT override → check rendered identity
  B. post with override → update WITH SAME override → check
  C. post with override → update WITH DIFFERENT override → check (does
     update accept different identity, or is identity bound at post time?)

Run:  doppler run -- uv run --project experiments/slack-direct \\
        python usegin/research/dev-channel-slack-prior-art/probes/probe_iii_chat_update.py
"""

from __future__ import annotations

import json
import os

from slack_sdk import WebClient

CHANNEL_ID = "C0B01M3MJMB"  # effi-dev


def fetch_msg(c: WebClient, ts: str) -> dict:
    h = c.conversations_history(channel=CHANNEL_ID, latest=ts, limit=1, inclusive=True)
    return h["messages"][0] if h["messages"] else {}


def show(label: str, msg: dict) -> None:
    keys = ["username", "icons", "user", "bot_id", "bot_profile", "text"]
    print(f"  {label}:")
    for k in keys:
        v = msg.get(k)
        if v is not None:
            if k == "bot_profile" and isinstance(v, dict):
                v = {kk: v.get(kk) for kk in ("name", "icons") if kk in v}
            print(f"    {k}: {json.dumps(v) if not isinstance(v, str) else v}")


def run_subtest(name: str, c: WebClient, post_kwargs: dict, update_kwargs: dict) -> None:
    print(f"\n--- {name} ---")
    r = c.chat_postMessage(channel=CHANNEL_ID, text=f"probe-iii {name} v1", **post_kwargs)
    ts = r["ts"]
    show("post-state", r["message"])
    after_post = fetch_msg(c, ts)
    show("post (history)", after_post)

    try:
        u = c.chat_update(channel=CHANNEL_ID, ts=ts, text=f"probe-iii {name} v2-updated", **update_kwargs)
        show("update-state", u["message"])
    except Exception as e:
        print(f"  UPDATE FAILED: {e}")
        c.chat_delete(channel=CHANNEL_ID, ts=ts)
        return

    after_update = fetch_msg(c, ts)
    show("update (history)", after_update)
    c.chat_delete(channel=CHANNEL_ID, ts=ts)


def main() -> int:
    bundle = json.load(open(os.path.expanduser("~/.cache/slack-direct/token.json")))
    c = WebClient(token=bundle["bot_token"])

    run_subtest(
        "A: post-with-override → update-WITHOUT",
        c,
        post_kwargs={"username": "oria", "icon_emoji": ":sparkles:"},
        update_kwargs={},
    )
    run_subtest(
        "B: post-with-override → update-WITH-SAME",
        c,
        post_kwargs={"username": "oria", "icon_emoji": ":sparkles:"},
        update_kwargs={"username": "oria", "icon_emoji": ":sparkles:"},
    )
    run_subtest(
        "C: post-with-override → update-WITH-DIFFERENT",
        c,
        post_kwargs={"username": "oria", "icon_emoji": ":sparkles:"},
        update_kwargs={"username": "lihu", "icon_emoji": ":wave:"},
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
