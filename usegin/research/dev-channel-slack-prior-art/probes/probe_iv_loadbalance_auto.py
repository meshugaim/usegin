"""Probe iv (auto, larger N) — re-run the load-balance test now that
event subscription is wired and we know bot-self events DO come through.

Opens N_LISTENERS Socket Mode connections, posts N_MESSAGES via the bot
token in quick succession, tallies which listener got which message.

Default: 3 listeners (matches the 3-dev scenario), 20 messages.

Run:  doppler run -- uv run --project experiments/slack-direct \\
        python usegin/research/dev-channel-slack-prior-art/probes/probe_iv_loadbalance_auto.py
"""

from __future__ import annotations

import json
import os
import sys
import time
import uuid
from collections import defaultdict

from slack_sdk import WebClient
from slack_sdk.socket_mode import SocketModeClient
from slack_sdk.socket_mode.request import SocketModeRequest
from slack_sdk.socket_mode.response import SocketModeResponse

CHANNEL_ID = "C0B01M3MJMB"  # effi-dev
N_LISTENERS = 3
N_MESSAGES = 20
SETTLE_SECONDS = 8


def main() -> int:
    app_token = os.environ["USEGIN_SLACK_APP_TOKEN"]
    bot_token = json.load(open(os.path.expanduser("~/.cache/slack-direct/token.json")))["bot_token"]

    log: list[dict] = []
    listeners = []
    for i in range(N_LISTENERS):
        name = f"L{i+1}"
        sm = SocketModeClient(app_token=app_token, web_client=WebClient(token=bot_token))

        def handler(c, req, _name=name):
            c.send_socket_mode_response(SocketModeResponse(envelope_id=req.envelope_id))
            if req.type == "events_api":
                ev = req.payload.get("event", {})
                if ev.get("type") == "message" and ev.get("channel") == CHANNEL_ID:
                    log.append({"listener": _name, "ts": ev.get("ts"), "text": ev.get("text", "")})

        sm.socket_mode_request_listeners.append(handler)
        listeners.append((name, sm))

    print(f"connecting {N_LISTENERS} Socket Mode listeners...")
    for _, sm in listeners:
        sm.connect()
    time.sleep(2.5)

    run_id = uuid.uuid4().hex[:6]
    poster = WebClient(token=bot_token)
    posted_ts: list[str] = []
    print(f"posting {N_MESSAGES} messages (run_id={run_id})...")
    for i in range(N_MESSAGES):
        r = poster.chat_postMessage(channel=CHANNEL_ID, text=f"probe-iv {run_id} seq={i+1:03d}")
        posted_ts.append(r["ts"])
        time.sleep(0.25)

    print(f"waiting {SETTLE_SECONDS}s for events to settle...")
    time.sleep(SETTLE_SECONDS)
    for _, sm in listeners:
        sm.close()

    # cleanup messages
    for ts in posted_ts:
        try:
            poster.chat_delete(channel=CHANNEL_ID, ts=ts)
        except Exception:
            pass

    ours = [e for e in log if f"probe-iv {run_id}" in (e.get("text") or "")]
    by_ts: dict[str, list[str]] = defaultdict(list)
    for e in ours:
        by_ts[e["ts"]].append(e["listener"])

    counts: dict[str, int] = defaultdict(int)
    distribution: dict[str, int] = defaultdict(int)
    print()
    print("=== per-message ===")
    for ts in posted_ts:
        seen = sorted(set(by_ts.get(ts, [])))
        distribution[",".join(seen) or "(none)"] += 1
        for L in seen:
            counts[L] += 1
        print(f"  {ts}  →  {seen}")

    print()
    print("=== summary ===")
    print(f"  total messages: {len(posted_ts)}")
    print(f"  per-listener counts: {dict(counts)}")
    print(f"  distribution (which-listener-set seen-by): {dict(distribution)}")
    only_one = sum(1 for ts in posted_ts if len(set(by_ts.get(ts, []))) == 1)
    multi = sum(1 for ts in posted_ts if len(set(by_ts.get(ts, []))) > 1)
    missed = sum(1 for ts in posted_ts if not by_ts.get(ts))
    print(f"  exactly-one-listener: {only_one}/{len(posted_ts)}")
    print(f"  multiple-listeners:   {multi}/{len(posted_ts)}")
    print(f"  missed-by-all:        {missed}/{len(posted_ts)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
