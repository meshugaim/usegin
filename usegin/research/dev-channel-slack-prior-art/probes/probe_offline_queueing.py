"""Probe (extra) — when there's NO Socket Mode listener connected for a
window, do messages posted during that window get delivered when a
listener reconnects, or are they dropped?

This determines whether the poll-as-correctness layer (Synthesis D1
lean B) is genuinely necessary or whether Slack already covers offline
periods.

Test:
  1. Open a single listener, confirm a baseline message arrives.
  2. Close the listener.
  3. Post 3 messages while no listener is connected (run_id-tagged).
  4. Wait 5s (gives Slack server-side any chance to buffer).
  5. Reconnect a listener.
  6. Wait 8s.
  7. Did any of the 3 'gap' messages get delivered after reconnect?

Run:  doppler run -- uv run --project experiments/slack-direct \\
        python usegin/research/dev-channel-slack-prior-art/probes/probe_offline_queueing.py
"""

from __future__ import annotations

import json
import os
import sys
import time
import uuid

from slack_sdk import WebClient
from slack_sdk.socket_mode import SocketModeClient
from slack_sdk.socket_mode.request import SocketModeRequest
from slack_sdk.socket_mode.response import SocketModeResponse

CHANNEL_ID = "C0B01M3MJMB"  # effi-dev


def make_listener(name: str, app_token: str, bot_token: str, log: list):
    sm = SocketModeClient(app_token=app_token, web_client=WebClient(token=bot_token))

    def handler(c, req):
        c.send_socket_mode_response(SocketModeResponse(envelope_id=req.envelope_id))
        if req.type == "events_api":
            ev = req.payload.get("event", {})
            if ev.get("type") == "message" and ev.get("channel") == CHANNEL_ID:
                log.append({"listener": name, "ts": ev.get("ts"), "text": ev.get("text", "")})

    sm.socket_mode_request_listeners.append(handler)
    return sm


def main() -> int:
    app_token = os.environ["USEGIN_SLACK_APP_TOKEN"]
    bot_token = json.load(open(os.path.expanduser("~/.cache/slack-direct/token.json")))["bot_token"]
    poster = WebClient(token=bot_token)

    run_id = uuid.uuid4().hex[:6]
    log: list[dict] = []

    # Step 1: baseline
    print("step 1: connect listener, post baseline message, confirm delivery")
    sm1 = make_listener("L1-pre", app_token, bot_token, log)
    sm1.connect()
    time.sleep(2.0)
    r0 = poster.chat_postMessage(channel=CHANNEL_ID, text=f"probe-offline {run_id} baseline")
    time.sleep(3.0)
    print(f"  baseline delivered: {any(e['ts']==r0['ts'] for e in log)}")

    # Step 2: disconnect
    print("step 2: close listener (no Socket Mode connection)")
    sm1.close()
    time.sleep(2.0)

    # Step 3: post 3 messages during the gap
    print("step 3: post 3 messages during the gap")
    gap_ts: list[str] = []
    for i in range(3):
        r = poster.chat_postMessage(channel=CHANNEL_ID, text=f"probe-offline {run_id} gap-{i+1}")
        gap_ts.append(r["ts"])
        time.sleep(0.4)

    print("step 4: wait 5s")
    time.sleep(5.0)

    # Step 5: reconnect
    print("step 5: reconnect a fresh listener")
    sm2 = make_listener("L2-post", app_token, bot_token, log)
    sm2.connect()

    print("step 6: wait 8s for any buffered events")
    time.sleep(8.0)
    sm2.close()

    # cleanup
    for ts in gap_ts + [r0["ts"]]:
        try:
            poster.chat_delete(channel=CHANNEL_ID, ts=ts)
        except Exception:
            pass

    # report
    print()
    print("=== RESULTS ===")
    delivered_to_post = []
    for ts in gap_ts:
        evs = [e for e in log if e["ts"] == ts]
        post_evs = [e for e in evs if e["listener"] == "L2-post"]
        delivered_to_post.append((ts, len(post_evs)))
        print(f"  gap ts={ts}  delivered_to_L2-post={len(post_evs)}  all_listeners={[e['listener'] for e in evs]}")

    n_redelivered = sum(1 for _, n in delivered_to_post if n > 0)
    print()
    if n_redelivered == len(gap_ts):
        print("  VERDICT: Slack BUFFERED offline events; reconnect delivered all gap messages.")
    elif n_redelivered == 0:
        print("  VERDICT: Slack DROPPED offline events; reconnect saw none of the gap messages.")
        print("  → poll-as-correctness layer (conversations.history backfill) is mandatory.")
    else:
        print(f"  VERDICT: PARTIAL — {n_redelivered}/{len(gap_ts)} gap messages re-delivered.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
