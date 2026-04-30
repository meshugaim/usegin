"""Probe i (continued) — does Socket Mode event delivery include the
chat.postMessage `metadata.event_payload`, or only `event_type`?

This matters because the dev-channel design routes messages by reading
event_payload.target on the receiver side. If Socket Mode strips the
payload, every receiver has to round-trip via conversations.history with
include_all_metadata=true to get it — adds a hop per message.

Plan: open ONE Socket Mode listener, post a message with full metadata
via the bot token, wait for the event to arrive, print what's in the
event payload.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time

from slack_sdk import WebClient
from slack_sdk.socket_mode import SocketModeClient
from slack_sdk.socket_mode.request import SocketModeRequest
from slack_sdk.socket_mode.response import SocketModeResponse

CHANNEL_ID = "C0B01M3MJMB"  # effi-dev


def main() -> int:
    app_token = os.environ.get("USEGIN_SLACK_APP_TOKEN")
    if not app_token:
        print("ERR: USEGIN_SLACK_APP_TOKEN not set", file=sys.stderr)
        return 1
    bundle = json.load(open(os.path.expanduser("~/.cache/slack-direct/token.json")))
    bot_token = bundle["bot_token"]

    captured: list[dict] = []
    arrived = threading.Event()

    sm = SocketModeClient(app_token=app_token, web_client=WebClient(token=bot_token))

    def handler(c: SocketModeClient, req: SocketModeRequest):
        c.send_socket_mode_response(SocketModeResponse(envelope_id=req.envelope_id))
        if req.type == "events_api":
            ev = req.payload.get("event", {})
            if ev.get("type") == "message" and ev.get("channel") == CHANNEL_ID:
                captured.append(ev)
                if "probe-i-sm" in (ev.get("text") or ""):
                    arrived.set()

    sm.socket_mode_request_listeners.append(handler)
    sm.connect()
    time.sleep(2.0)

    poster = WebClient(token=bot_token)
    payload = {
        "event_type": "dev_ping",
        "event_payload": {
            "sender_kind": "agent",
            "owner": "lihu",
            "agent_id": "gin-claude-opus-4-7",
            "session_id": "probe-i-sm-test",
            "target": "all",
        },
    }
    r = poster.chat_postMessage(channel=CHANNEL_ID, text="probe-i-sm metadata via socket mode", metadata=payload)
    ts = r["ts"]

    arrived.wait(timeout=8)
    sm.close()

    matched = [e for e in captured if "probe-i-sm" in (e.get("text") or "")]
    print(f"events captured for our message: {len(matched)}")
    if matched:
        ev = matched[0]
        print()
        print("=== Socket Mode event JSON (truncated to relevant keys) ===")
        relevant = {k: ev.get(k) for k in ("type", "subtype", "channel", "ts", "bot_id", "user", "text", "metadata")}
        print(json.dumps(relevant, indent=2))
        if "metadata" in ev:
            md = ev["metadata"]
            has_payload = bool(md.get("event_payload"))
            print()
            if has_payload:
                print("VERDICT: Socket Mode DELIVERS event_payload directly. Routing on receiver requires no extra API call.")
            else:
                print("VERDICT: Socket Mode delivers event_type only. Receiver must call conversations.history(include_all_metadata=true) to get event_payload.")
        else:
            print()
            print("VERDICT: Socket Mode does NOT include any metadata field on the event. Receiver must round-trip.")
    poster.chat_delete(channel=CHANNEL_ID, ts=ts)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
