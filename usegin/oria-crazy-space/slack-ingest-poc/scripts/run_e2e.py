"""End-to-end demo: live fetch from #social -> normalize -> index -> query.

Reads SLACK_BOT_TOKEN from ~/.config/ingest-poc/.env.
Channel id is hardcoded for the POC scope (askeffi #social).
"""

from poc.indexer import index_messages
from poc.normalizer import normalize
from poc.querier import query
from poc.slack_reader import auth_test, fetch_history, list_channels, load_token


CHANNEL_ID = "C0B00CM9E0G"
CHANNEL_NAME = "social"


def main() -> int:
    token = load_token()

    print("---- auth.test ----")
    who = auth_test(token)
    print(f"  workspace = {who['team']} ({who['team_id']})")
    print(f"  bot       = {who['user']}  ({who['user_id']})")

    print("---- list_channels ----")
    for c in list_channels(token):
        print(
            f"  {c['id']} #{c['name']}  is_member={c['is_member']}  members={c['num_members']}"
        )

    print("---- fetch_history ----")
    raw = fetch_history(token, CHANNEL_ID, limit=50)
    print(f"  fetched {len(raw)} raw messages")

    print("---- normalize + index ----")
    records = [
        normalize(m, channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME) for m in raw
    ]
    path = index_messages(records)
    print(f"  wrote {len(records)} records to {path}")

    print("---- queries ----")
    for needle in ("ENG-5399", "הקוד", "TODO", "api.slack.com"):
        hits = query(needle)
        print(f"  q={needle!r:25s} -> {len(hits)} hit(s)")
        for h in hits:
            text_preview = h["text"].replace("\n", " ")[:70]
            print(f"      {h['citation']}  {text_preview!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
