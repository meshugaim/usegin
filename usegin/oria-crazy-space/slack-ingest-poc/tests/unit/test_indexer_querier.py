"""Indexer + querier unit tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from poc.indexer import index_messages, load_index
from poc.querier import query


def _make(id_: str, text: str, *, kind: str = "user", ts: str | None = None) -> dict:
    return {
        "id": id_,
        "channel_id": "C1",
        "channel_name": "social",
        "ts": ts or id_.split(":")[-1],
        "user_id": "U1",
        "text": text,
        "text_clean": text,
        "thread_ts": None,
        "is_thread_parent": False,
        "subtype": None if kind == "user" else "channel_join",
        "kind": kind,
    }


def test_index_writes_jsonl(tmp_path: Path) -> None:
    idx = tmp_path / "messages.jsonl"
    index_messages([_make("C1:1.0", "hello")], path=idx)
    assert idx.exists()
    rows = [json.loads(l) for l in idx.read_text().splitlines() if l.strip()]
    assert rows[0]["text"] == "hello"


def test_index_upserts_by_id(tmp_path: Path) -> None:
    idx = tmp_path / "messages.jsonl"
    index_messages([_make("C1:1.0", "first")], path=idx)
    index_messages([_make("C1:1.0", "second")], path=idx)
    rows = load_index(idx)
    assert len(rows) == 1
    assert rows[0]["text"] == "second"


def test_index_appends_new_ids(tmp_path: Path) -> None:
    idx = tmp_path / "messages.jsonl"
    index_messages([_make("C1:1.0", "a")], path=idx)
    index_messages([_make("C1:2.0", "b")], path=idx)
    rows = load_index(idx)
    assert {r["id"] for r in rows} == {"C1:1.0", "C1:2.0"}


def test_query_substring_finds(tmp_path: Path) -> None:
    idx = tmp_path / "messages.jsonl"
    index_messages([_make("C1:1.0", "hello world"), _make("C1:2.0", "goodbye")], path=idx)
    hits = query("world", index=load_index(idx))
    assert len(hits) == 1
    assert hits[0]["text"] == "hello world"


def test_query_is_case_insensitive(tmp_path: Path) -> None:
    idx = tmp_path / "messages.jsonl"
    index_messages([_make("C1:1.0", "Hello WORLD")], path=idx)
    hits = query("hello world", index=load_index(idx))
    assert len(hits) == 1


def test_query_filters_system_by_default(tmp_path: Path) -> None:
    idx = tmp_path / "messages.jsonl"
    index_messages(
        [
            _make("C1:1.0", "user said hello"),
            _make("C1:2.0", "joined the channel hello", kind="system"),
        ],
        path=idx,
    )
    hits = query("hello", index=load_index(idx))
    assert len(hits) == 1
    assert hits[0]["text"] == "user said hello"


def test_query_can_include_system(tmp_path: Path) -> None:
    idx = tmp_path / "messages.jsonl"
    index_messages(
        [
            _make("C1:1.0", "user hello"),
            _make("C1:2.0", "join hello", kind="system"),
        ],
        path=idx,
    )
    hits = query("hello", include_system=True, index=load_index(idx))
    assert len(hits) == 2


def test_query_returns_citation(tmp_path: Path) -> None:
    idx = tmp_path / "messages.jsonl"
    index_messages([_make("C1:1.0", "hi there")], path=idx)
    hits = query("hi", index=load_index(idx))
    assert hits[0]["citation"] == "#social @ 1.0 (U1)"


def test_query_finds_hebrew(tmp_path: Path) -> None:
    idx = tmp_path / "messages.jsonl"
    index_messages([_make("C1:1.0", "את הקוד של effi ingest")], path=idx)
    hits = query("הקוד", index=load_index(idx))
    assert len(hits) == 1


def test_query_newest_first(tmp_path: Path) -> None:
    idx = tmp_path / "messages.jsonl"
    index_messages(
        [
            _make("C1:1.0", "older hello"),
            _make("C1:2.0", "newer hello"),
        ],
        path=idx,
    )
    hits = query("hello", index=load_index(idx))
    assert hits[0]["ts"] == "2.0"
    assert hits[1]["ts"] == "1.0"
