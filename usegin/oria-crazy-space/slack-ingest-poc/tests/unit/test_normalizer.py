"""Normalizer unit tests against the recorded #social fixture.

The fixture is a real `conversations.history` response captured 2026-04-28
after Oria invited the bot. Eight messages covering every shape called
out in the charter: code-fenced slash command, plain text, long-line
reasoning, angle-wrapped URL, Hebrew+Latin mix, multi-line TODO with
thread_ts, channel_join system messages, mention-formatted user ids.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from poc.normalizer import _strip_url_brackets, normalize


FIXTURE = (
    Path(__file__).resolve().parent.parent / "fixtures" / "social-history-2026-04-28.json"
)
CHANNEL_ID = "C0B00CM9E0G"
CHANNEL_NAME = "social"


@pytest.fixture(scope="module")
def messages() -> list[dict]:
    data = json.loads(FIXTURE.read_text())
    assert data["ok"], "fixture must be a successful conversations.history response"
    return data["messages"]


@pytest.fixture(scope="module")
def by_ts(messages: list[dict]) -> dict[str, dict]:
    return {m["ts"]: m for m in messages}


def test_fixture_has_all_eight_messages(messages: list[dict]) -> None:
    assert len(messages) == 8


def test_canonical_id_is_channel_colon_ts(by_ts: dict[str, dict]) -> None:
    rec = normalize(by_ts["1777415075.720219"], channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME)
    assert rec["id"] == f"{CHANNEL_ID}:1777415075.720219"


def test_plain_user_message_classifies_as_user(by_ts: dict[str, dict]) -> None:
    rec = normalize(by_ts["1777415075.720219"], channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME)
    assert rec["kind"] == "user"
    assert rec["subtype"] is None


def test_channel_join_classifies_as_system(by_ts: dict[str, dict]) -> None:
    rec = normalize(by_ts["1777415490.106739"], channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME)
    assert rec["kind"] == "system"
    assert rec["subtype"] == "channel_join"


def test_shortcode_emoji_preserved(by_ts: dict[str, dict]) -> None:
    rec = normalize(by_ts["1777415075.720219"], channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME)
    assert ":sleeping_accommodation:" in rec["text"]
    assert ":sleeping_accommodation:" in rec["text_clean"]


def test_url_brackets_stripped_in_text_clean(by_ts: dict[str, dict]) -> None:
    rec = normalize(by_ts["1777415111.742679"], channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME)
    assert "<https://" in rec["text"]
    assert "<https://" not in rec["text_clean"]
    assert "https://api.slack.com/apps/A0B0B7HBATC" in rec["text_clean"]


def test_hebrew_latin_mix_byte_exact(by_ts: dict[str, dict]) -> None:
    rec = normalize(by_ts["1777415119.094619"], channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME)
    # Hebrew "את הקוד" + arrow + Latin
    assert "את הקוד" in rec["text"]
    assert "→" in rec["text"]
    assert "conversations.history" in rec["text"]
    assert rec["text"] == rec["text_clean"]  # no URL brackets in this one


def test_thread_parent_marked(by_ts: dict[str, dict]) -> None:
    # The TODO message has thread_ts == ts (parent of its own thread).
    rec = normalize(by_ts["1777415133.241249"], channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME)
    assert rec["thread_ts"] == "1777415133.241249"
    assert rec["is_thread_parent"] is True


def test_non_threaded_message_has_no_thread_ts(by_ts: dict[str, dict]) -> None:
    rec = normalize(by_ts["1777415075.720219"], channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME)
    assert rec["thread_ts"] is None
    assert rec["is_thread_parent"] is False


def test_mention_syntax_preserved(by_ts: dict[str, dict]) -> None:
    rec = normalize(by_ts["1777415490.106739"], channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME)
    assert "<@U0B0A8AKVH9>" in rec["text"]


def test_multiline_text_keeps_newlines(by_ts: dict[str, dict]) -> None:
    rec = normalize(by_ts["1777415133.241249"], channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME)
    assert "\n" in rec["text"]


# Pure-logic seam: _strip_url_brackets


def test_strip_unwraps_plain_angle_url() -> None:
    assert _strip_url_brackets("see <https://example.com> please") == "see https://example.com please"


def test_strip_uses_label_when_present() -> None:
    out = _strip_url_brackets("see <https://example.com|click here> please")
    assert out == "see click here please"


def test_strip_handles_mailto() -> None:
    assert _strip_url_brackets("<mailto:a@b.co>") == "mailto:a@b.co"


def test_strip_leaves_mention_alone() -> None:
    # `<@USERID>` is NOT a URL; must not be touched.
    assert _strip_url_brackets("hi <@U123>") == "hi <@U123>"
