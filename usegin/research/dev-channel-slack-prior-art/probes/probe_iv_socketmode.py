"""Probe iv — does Slack Socket Mode load-balance events across multiple
connections to the same app, or broadcast to all of them?

Opens TWO SocketModeClient connections with the same app-level token,
posts N messages via a separate WebClient (bot token), and tallies which
listener(s) received each message.

- load-balance → each message lands on exactly one listener (need
  poll-as-correctness layer per Synthesis D1 lean B).
- broadcast → each message lands on both (handoff assumption holds).

Run:  doppler run -- uv run --project experiments/slack-direct \\
        python usegin/research/dev-channel-slack-prior-art/probes/probe_iv_socketmode.py
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
import uuid
from collections import defaultdict

from slack_sdk import WebClient
from slack_sdk.socket_mode import SocketModeClient
from slack_sdk.socket_mode.request import SocketModeRequest
from slack_sdk.socket_mode.response import SocketModeResponse

CHANNEL_ID = "C0B093XFYB0"  # spike-slack-unified
N_MESSAGES = 5
SETTLE_SECONDS = 6


def load_bot_token() -> str:
    bundle = json.load(open(os.path.expanduser("~/.cache/slack-direct/token.json")))
    return bundle["bot_token"]


def make_listener(name: str, app_token: str, bot_token: str, log: list):
    client = SocketModeClient(app_token=app_token, web_client=WebClient(token=bot_token))

    def handler(c: SocketModeClient, req: SocketModeRequest):
        c.send_socket_mode_response(SocketModeResponse(envelope_id=req.envelope_id))
        # Diagnostic: log EVERYTHING this listener sees.
        print(f"  [{name}] type={req.type} payload_type={req.payload.get('type') if isinstance(req.payload, dict) else '?'}")
        if req.type == "events_api":
            ev = req.payload.get("event", {})
            print(f"  [{name}]   event.type={ev.get('type')} channel={ev.get('channel')} ts={ev.get('ts')} bot_id={ev.get('bot_id')} subtype={ev.get('subtype')} text={ev.get('text','')[:60]!r}")
            if ev.get("type") == "message" and ev.get("channel") == CHANNEL_ID:
                log.append(
                    {
                        "listener": name,
                        "ts": ev.get("ts"),
                        "text": ev.get("text", ""),
                        "subtype": ev.get("subtype"),
                        "bot_id": ev.get("bot_id"),
                    }
                )

    client.socket_mode_request_listeners.append(handler)
    return client


def main() -> int:
    app_token = os.environ.get("USEGIN_SLACK_APP_TOKEN")
    if not app_token:
        print("ERR: USEGIN_SLACK_APP_TOKEN not set (run via `doppler run --`)", file=sys.stderr)
        return 1
    bot_token = load_bot_token()

    log: list[dict] = []
    listeners = [make_listener(f"L{i+1}", app_token, bot_token, log) for i in range(2)]

    print("connecting 2 Socket Mode listeners...")
    for L in listeners:
        L.connect()
    time.sleep(2.0)  # let WS handshakes finish

    poster = WebClient(token=bot_token)
    run_id = uuid.uuid4().hex[:6]
    print(f"posting {N_MESSAGES} test messages (run_id={run_id})...")
    posted_ts: list[str] = []
    for i in range(N_MESSAGES):
        r = poster.chat_postMessage(
            channel=CHANNEL_ID,
            text=f"probe-iv {run_id} seq={i+1}",
        )
        posted_ts.append(r["ts"])
        time.sleep(0.4)

    print(f"waiting {SETTLE_SECONDS}s for events to settle...")
    time.sleep(SETTLE_SECONDS)

    for L in listeners:
        L.close()

    # Filter log to just our run
    ours = [e for e in log if f"probe-iv {run_id}" in (e.get("text") or "")]
    by_ts: dict[str, set[str]] = defaultdict(set)
    for e in ours:
        by_ts[e["ts"]].add(e["listener"])

    print("\n=== RESULTS ===")
    print(f"posted: {len(posted_ts)} msgs, ts={posted_ts}")
    print(f"received events for our run: {len(ours)}")
    for ts in posted_ts:
        seen = sorted(by_ts.get(ts, set()))
        print(f"  ts={ts}  seen_by={seen}")

    only_one = sum(1 for ts in posted_ts if len(by_ts.get(ts, set())) == 1)
    both = sum(1 for ts in posted_ts if len(by_ts.get(ts, set())) == 2)
    missed = sum(1 for ts in posted_ts if len(by_ts.get(ts, set())) == 0)

    print()
    print(f"  only-one-listener: {only_one}/{len(posted_ts)}")
    print(f"  both-listeners:    {both}/{len(posted_ts)}")
    print(f"  missed-by-both:    {missed}/{len(posted_ts)}")

    if both == len(posted_ts):
        print("\n  VERDICT: BROADCAST (every connection got every message)")
    elif only_one == len(posted_ts):
        print("\n  VERDICT: LOAD-BALANCED (each message went to exactly one listener)")
    else:
        print("\n  VERDICT: MIXED — see counts above")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
