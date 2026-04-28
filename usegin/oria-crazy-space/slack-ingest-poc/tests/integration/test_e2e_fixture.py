"""End-to-end fixture-driven test.

Drives the full pipeline against the saved 2026-04-28 #social fetch:

    fixture JSON -> normalize each row -> index_messages -> query

This is the "S6" deliverable from the charter — proves the *shape*
of the pipeline without depending on live Slack.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from poc.indexer import index_messages, load_index
from poc.normalizer import normalize
from poc.querier import query


FIXTURE = (
    Path(__file__).resolve().parent.parent / "fixtures" / "social-history-2026-04-28.json"
)
CHANNEL_ID = "C0B00CM9E0G"
CHANNEL_NAME = "social"


@pytest.fixture
def populated_index(tmp_path: Path) -> Path:
    """Run the full ingest into a temp index and return its path."""
    raw = json.loads(FIXTURE.read_text())
    records = [
        normalize(m, channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME)
        for m in raw["messages"]
    ]
    idx = tmp_path / "messages.jsonl"
    index_messages(records, path=idx)
    return idx


def test_e2e_indexes_all_eight_messages(populated_index: Path) -> None:
    rows = load_index(populated_index)
    assert len(rows) == 8


def test_e2e_query_finds_eng_5399(populated_index: Path) -> None:
    rows = load_index(populated_index)
    hits = query("ENG-5399", index=rows)
    assert len(hits) == 1
    assert "shipping ENG-5399" in hits[0]["text"]
    # Citation must include channel name + ts
    assert hits[0]["citation"].startswith("#social @ ")


def test_e2e_query_finds_hebrew_kod(populated_index: Path) -> None:
    rows = load_index(populated_index)
    hits = query("הקוד", index=rows)
    assert len(hits) == 1
    assert hits[0]["channel_name"] == "social"


def test_e2e_query_finds_url_target_after_strip(populated_index: Path) -> None:
    """The slack-formatted URL `<https://api.slack.com/apps/...>` becomes a clean URL after strip."""
    rows = load_index(populated_index)
    hits = query("api.slack.com", index=rows)
    assert len(hits) == 1
    assert "<https://" not in hits[0]["text"]


def test_e2e_query_filters_channel_join_by_default(populated_index: Path) -> None:
    """Two channel_join system messages exist in the fixture; query should not return them."""
    rows = load_index(populated_index)
    hits = query("joined the channel", index=rows)
    assert hits == []


def test_e2e_query_can_include_system(populated_index: Path) -> None:
    rows = load_index(populated_index)
    hits = query("joined the channel", include_system=True, index=rows)
    assert len(hits) == 2


def test_e2e_query_finds_thread_parent_text(populated_index: Path) -> None:
    rows = load_index(populated_index)
    hits = query("TODO", index=rows)
    assert len(hits) == 1
    # Thread parent flag preserved through the pipeline
    parent_row = next(r for r in rows if r["ts"] == "1777415133.241249")
    assert parent_row["is_thread_parent"] is True


def test_e2e_idempotent_reingest(tmp_path: Path) -> None:
    """Running the full ingest twice produces the same record count."""
    raw = json.loads(FIXTURE.read_text())
    records = [
        normalize(m, channel_id=CHANNEL_ID, channel_name=CHANNEL_NAME)
        for m in raw["messages"]
    ]
    idx = tmp_path / "messages.jsonl"
    index_messages(records, path=idx)
    index_messages(records, path=idx)
    assert len(load_index(idx)) == 8
