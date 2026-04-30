"""Probe i — does chat.postMessage(metadata={event_type, event_payload})
work with our bot token, or does it require an app-level token?

Slack docs are inconsistent across pages. This is a one-call test:
post a message with metadata, observe whether the call succeeds and
whether the response includes the metadata back.

Run:  doppler run -- uv run --project experiments/slack-direct \\
        python usegin/research/dev-channel-slack-prior-art/probes/probe_i_metadata.py
"""

from __future__ import annotations

import json
import os
import sys

from slack_sdk import WebClient

CHANNEL_ID = "C0B01M3MJMB"  # effi-dev


def main() -> int:
    bundle = json.load(open(os.path.expanduser("~/.cache/slack-direct/token.json")))
    client = WebClient(token=bundle["bot_token"])

    metadata = {
        "event_type": "dev_ping",
        "event_payload": {
            "sender_kind": "agent",
            "owner": "lihu",
            "agent_id": "gin-claude-opus-4-7",
            "session_id": "probe-i-test",
            "target": "all",
        },
    }

    try:
        r = client.chat_postMessage(
            channel=CHANNEL_ID,
            text="probe-i: chat.postMessage with metadata field (bot token)",
            metadata=metadata,
        )
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        return 1

    print("posted ts:", r["ts"])
    print("ok:", r["ok"])
    print()
    print("=== response.message.metadata (echoed back?) ===")
    print(json.dumps(r["message"].get("metadata"), indent=2))
    print()

    # Pull it back via conversations.history to confirm metadata is persisted
    h = client.conversations_history(channel=CHANNEL_ID, latest=r["ts"], limit=1, inclusive=True)
    msg = h["messages"][0] if h["messages"] else None
    print("=== conversations.history → message.metadata (persisted?) ===")
    print(json.dumps(msg.get("metadata") if msg else None, indent=2))

    # Clean up so #effi-dev doesn't fill with probe noise
    try:
        client.chat_delete(channel=CHANNEL_ID, ts=r["ts"])
        print("\n(deleted probe message)")
    except Exception as e:
        print(f"\n(delete failed: {e})")

    print()
    if r["message"].get("metadata"):
        print("VERDICT: bot token CAN post with metadata, and Slack echoes it back.")
    else:
        print("VERDICT: bot token can post but metadata NOT echoed — likely rejected silently.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
