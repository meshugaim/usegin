"""Live-wire half-test: verify auth + list + history works against #social.

Originally meant for "after Oria's morning /invite", but Oria invited
the bot before sleep — so this is a verification, not an unblock.
Should print "ok=True" three times.
"""

from poc.slack_reader import auth_test, fetch_history, list_channels, load_token, SlackError


def main() -> int:
    token = load_token()

    print("auth.test:")
    who = auth_test(token)
    print(f"  ok=True  team={who['team']}  user={who['user']}")

    print("conversations.list:")
    chans = list_channels(token)
    print(f"  ok=True  channels={len(chans)}")

    print("conversations.history (#social):")
    try:
        msgs = fetch_history(token, "C0B00CM9E0G", limit=20)
        print(f"  ok=True  messages={len(msgs)}")
    except SlackError as e:
        print(f"  ok=False  {e}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
