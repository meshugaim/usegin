"""Slack Ingestion POC — overnight build, 2026-04-28→29.

End-to-end pipeline: Slack history -> normalize -> JSONL index ->
query-with-citation. Self-contained; uses only stdlib + `requests` to
keep the POC dep-free vs the larger `experiments/slack-direct/` spike.

Charter: usegin/oria-crazy-space/poc-reports/whiteboard-slack-ingest.md
"""

from __future__ import annotations
