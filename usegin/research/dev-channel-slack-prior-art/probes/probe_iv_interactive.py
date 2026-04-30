"""Probe iv (interactive) — opens 2 Socket Mode listeners, then waits for
the human to type messages in #spike-slack-unified. Prints every event
each listener sees so we can tell load-balance from broadcast (and rule
out the "events not subscribed" failure mode that the auto-poster variant
hit because bot-self events may be filtered).

Run:  doppler run -- uv run --project experiments/slack-direct \\
        python usegin/research/dev-channel-slack-prior-art/probes/probe_iv_interactive.py

Then type a few messages in #spike-slack-unified from your Slack account.
Ctrl-C when done.
"""

from __future__ import annotations

import json
import os
import sys
import time
from collections import defaultdict

from slack_sdk import WebClient
from slack_sdk.socket_mode import SocketModeClient
from slack_sdk.socket_mode.request import SocketModeRequest
from slack_sdk.socket_mode.response import SocketModeResponse

CHANNEL_ID = "C0B01M3MJMB"  # effi-dev


def load_bot_token() -> str:
    bundle = json.load(open(os.path.expanduser("~/.cache/slack-direct/token.json")))
    return bundle["bot_token"]


def make_listener(name: str, app_token: str, bot_token: str, log: list):
    client = SocketModeClient(app_token=app_token, web_client=WebClient(token=bot_token))

    def handler(c: SocketModeClient, req: SocketModeRequest):
        c.send_socket_mode_response(SocketModeResponse(envelope_id=req.envelope_id))
        ptype = req.payload.get("type") if isinstance(req.payload, dict) else "?"
        print(f"  [{name}] envelope_type={req.type} payload_type={ptype}", flush=True)
        if req.type == "events_api":
            ev = req.payload.get("event", {})
            print(
                f"  [{name}]   event.type={ev.get('type')} ch={ev.get('channel')} "
                f"ts={ev.get('ts')} bot_id={ev.get('bot_id')} subtype={ev.get('subtype')} "
                f"user={ev.get('user')} text={ev.get('text','')[:80]!r}",
                flush=True,
            )
            if ev.get("type") == "message":
                log.append({"listener": name, "ts": ev.get("ts"), "user": ev.get("user")})

    client.socket_mode_request_listeners.append(handler)
    return client


def main() -> int:
    app_token = os.environ.get("USEGIN_SLACK_APP_TOKEN")
    if not app_token:
        print("ERR: USEGIN_SLACK_APP_TOKEN not set", file=sys.stderr)
        return 1
    bot_token = load_bot_token()

    log: list[dict] = []
    listeners = [make_listener(f"L{i+1}", app_token, bot_token, log) for i in range(2)]

    print("connecting 2 Socket Mode listeners (L1, L2)...")
    for L in listeners:
        L.connect()
    time.sleep(2.0)
    print(
        f"\nREADY — both listeners connected to app via Socket Mode.\n"
        f"Type messages in #effi-dev ({CHANNEL_ID}) now.\n"
        f"Ctrl-C when done.\n"
    )

    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        pass
    finally:
        for L in listeners:
            L.close()

    by_ts: dict[str, set[str]] = defaultdict(set)
    for e in log:
        if e["ts"]:
            by_ts[e["ts"]].add(e["listener"])

    print("\n=== TALLY ===")
    print(f"distinct messages observed: {len(by_ts)}")
    only_one = sum(1 for s in by_ts.values() if len(s) == 1)
    both = sum(1 for s in by_ts.values() if len(s) == 2)
    print(f"  only-one-listener: {only_one}")
    print(f"  both-listeners:    {both}")
    if by_ts:
        if both == len(by_ts):
            print("\n  VERDICT: BROADCAST")
        elif only_one == len(by_ts):
            print("\n  VERDICT: LOAD-BALANCED")
        else:
            print("\n  VERDICT: MIXED")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
