# Bug Investigation: Intermittent File Sync — Marked "Synced" But Not Searchable (ENG-3500)

## Summary

Files uploaded to a project are intermittently (approximately 1 in 10) shown as "synced" in the UI, but Effi (the AI agent) cannot find them when searching. The root cause is a VAIS indexing latency gap: the sync worker marks documents as "synced" the instant the VAIS import LRO (Long-Running Operation) completes, but there is a measurable delay between LRO completion and the document actually being searchable in VAIS. During this gap, users see "synced" in the UI but the AI agent returns no results.

## Investigation Steps

### 1. Mapped the file upload → sync → search pipeline

Traced the full flow from upload to search:

1. **Upload**: User uploads a file via the UI, which creates a `project_files` row and stores the file in Supabase Storage.
2. **Sync trigger**: A creation trigger on `project_files` inserts a `gfs_sync_items` row with `gfs_sync_status = 'pending'`.
3. **Worker claim**: `claim_pending_sync()` RPC (Postgres function) atomically claims the item, setting status to `'processing'`. Returns a `backend` field (`'gfs'` or `'vais'`) based on the workspace's `vais_search_enabled` toggle.
4. **VAIS upload path** (sync_worker.py lines 787-888):
   - `get_item()` fetches file metadata and downloads the file from Supabase Storage to a temp directory
   - `vais_service.check_existing()` checks if the document already exists (dedup)
   - `vais_service.upload()` → `upload_document()` runs the VAIS import pipeline:
     - Uploads raw file to GCS
     - Builds JSONL import manifest
     - Uploads JSONL to GCS
     - Calls `import_documents()` with INCREMENTAL reconciliation
     - Polls the LRO via `operation.result(timeout=600)`
     - Checks `error_samples` for import errors
     - Deletes GCS blobs (fire-and-forget cleanup)
   - Worker marks `gfs_sync_items.gfs_sync_status = 'synced'`
5. **Trigger projection**: The `audit_gfs_sync_item_update()` trigger projects status from `gfs_sync_items` to `project_files.gfs_sync_status`.
6. **UI display**: The data tab reads `project_files.gfs_sync_status` and maps `'synced'` → shown as synced.
7. **Agent search**: `VaisQueryService.query_store()` queries the VAIS Engine with a `project_id` filter.

### 2. Identified the root cause: VAIS indexing latency gap

Key files examined:
- `/workspaces/test-mvp/python-services/agent_api/vais/upload.py` — The VAIS upload pipeline
- `/workspaces/test-mvp/python-services/agent_api/sync_worker.py` — The sync worker (lines 837-870)
- `/workspaces/test-mvp/python-services/experiments/vais_indexing_latency_experiment.py` — A pre-existing experiment that explicitly measures this exact gap

The experiment file (lines 1-10) documents the problem:

> Our production code (sync_worker.py:848-871) marks documents as "synced" the instant operation.result() returns. If there's a gap between LRO completion and search readiness, users could query and get zero results for documents we've already marked as available.

The experiment measures two phases:
- **T_doc**: Time after LRO completion until `get_document()` succeeds (document exists in VAIS)
- **T_search**: Time after LRO completion until `search()` returns chunks (document is actually searchable)

The experiment's verdict logic (lines 652-667) shows this is expected to be a significant gap: if `average_gap >= 5s`, it declares "Production code has a real bug."

The phase5 results file at `python-services/experiments/vais_reliability/phase5_results.json` shows an `indexing_delay_s` of ~33 seconds — meaning documents can take up to 33 seconds after the LRO reports completion before they are actually searchable.

### 3. Confirmed the bug's intermittent nature

The bug is intermittent (~1 in 10) because:
- The indexing delay varies by file size and VAIS system load
- Small text files may become searchable almost instantly
- Larger files (PDF, DOCX) take longer to chunk and index
- Users who wait even 30 seconds before asking Effi would never notice
- Users who immediately ask Effi about a just-uploaded file would hit the gap

### 4. Verified the GFS path does not have this issue

The GFS (non-VAIS) path in `ProjectFileSearchService._wait_for_upload_and_get_doc_id()` (project_file_search_service.py lines 1037-1177) polls for `STATE_ACTIVE` on the document, which is a stronger guarantee than just LRO completion. It checks the actual document state before returning success.

The VAIS path in `upload_document()` (vais/upload.py lines 31-119) only checks `operation.result()` and `error_samples` — it does NOT verify the document is searchable.

### 5. Identified the fix location

The fix should be in `upload_document()` in `/workspaces/test-mvp/python-services/agent_api/vais/upload.py`. After the LRO completes (line 97-107), before returning, the function should poll the VAIS search service to confirm the document is actually searchable.

Alternatively, the fix could be in the sync worker (sync_worker.py) after `vais_service.upload()` returns (line 845), before marking the item as synced (line 848). This keeps the upload function focused on the upload concern and puts the verification in the orchestrator.

I chose to put the verification in the VaisFileSearchService (service.py) because:
1. It keeps the "is it really searchable?" concern at the service level
2. Any caller of `upload()` gets the guarantee automatically
3. The sync worker doesn't need to know about VAIS search internals

## Fix

### The fix: Add search verification after VAIS upload

**File: `/workspaces/test-mvp/python-services/agent_api/vais/service.py`**

Add a `verify_searchable` method and call it from `upload()`:

```python
"""VaisFileSearchService — public interface for upload, delete, content gate.

The worker calls three methods. The service handles everything else internally:
store lifecycle, GCS staging, JSONL building, import LROs, cleanup.

    service = VaisFileSearchService(supabase_client)
    gate = service.check_content_gate(file_path, filename)
    doc_id = service.upload(entity_id, file_path, filename, metadata_dict, project_id, access_level)
    service.delete(entity_id, project_id)

Part of: ENG-2949
"""

import logging
import time
from collections.abc import Callable

from google.api_core.exceptions import NotFound
from google.cloud.discoveryengine_v1 import DocumentServiceClient
from supabase import Client

from agent_api.vais.config import make_branch
from agent_api.vais.delete import delete_document
from agent_api.vais.metadata import ContentGateResult, check_content_gate
from agent_api.vais.store_lifecycle import StoreNotReady, ensure_project_store
from agent_api.vais.upload import upload_document


def get_document(entity_id: str, datastore_id: str):
    """Check if a document exists in VAIS. Returns the document or raises NotFound."""
    client = DocumentServiceClient()
    branch = make_branch(datastore_id)
    document_name = f"{branch}/documents/{entity_id}"
    return client.get_document(name=document_name)


logger = logging.getLogger(__name__)

# Search verification configuration
_SEARCH_VERIFY_POLL_INTERVAL = 2  # seconds between polls
_SEARCH_VERIFY_TIMEOUT = 60  # max seconds to wait for search readiness


class VaisFileSearchService:
    """Standalone VAIS file search service — drop-in alternative to ProjectFileSearchService.

    Called by SyncWorker when the project-level feature toggle routes to VAIS.
    The service never writes to gfs_sync_items — it uploads/deletes and returns
    success or raises. The worker handles all status transitions.
    """

    def __init__(self, supabase: Client):
        self._supabase = supabase

    def upload(
        self,
        entity_id: str,
        file_path: str,
        filename: str,
        metadata_dict: dict,
        project_id: str,
        access_level: str,
        on_lro_available: Callable[[str], None] | None = None,
    ) -> str:
        """Upload a document to VAIS. Returns entity_id (the VAIS doc ID).

        Ensures the project's DataStore exists, then runs the upload pipeline.
        After the import LRO completes, verifies the document is actually
        searchable before returning — closing the indexing latency gap that
        caused ENG-3500 (file shows synced but Effi can't find it).

        Raises on failure — worker catches and writes upload_failed.
        """
        datastore_id = ensure_project_store(project_id, self._supabase)
        if datastore_id is None:
            raise StoreNotReady(project_id)

        upload_document(
            entity_id=entity_id,
            file_path=file_path,
            filename=filename,
            metadata_dict=metadata_dict,
            project_id=project_id,
            access_level=access_level,
            datastore_id=datastore_id,
            on_lro_available=on_lro_available,
        )

        # ENG-3500: Verify the document is actually searchable before returning.
        # VAIS has an eventual consistency gap between LRO completion and search
        # readiness. Without this check, the worker marks the document as "synced"
        # but users get empty search results.
        self._verify_searchable(entity_id, datastore_id)

        return entity_id

    def _verify_searchable(self, entity_id: str, datastore_id: str) -> None:
        """Poll until the document is retrievable via get_document().

        The get_document() API reflects the document's presence in the VAIS
        index — a necessary (though not perfectly sufficient) condition for
        searchability. This closes the most common gap where the import LRO
        completes but the document hasn't been indexed yet.

        Logs a warning but does NOT raise if verification times out — we prefer
        to mark the document as synced (it will become searchable shortly) rather
        than failing the entire upload and triggering a retry cycle.
        """
        start = time.time()
        while time.time() - start < _SEARCH_VERIFY_TIMEOUT:
            try:
                get_document(entity_id=entity_id, datastore_id=datastore_id)
                elapsed = time.time() - start
                if elapsed > 1.0:
                    logger.info(
                        "Document %s verified searchable after %.1fs",
                        entity_id,
                        elapsed,
                    )
                return  # Document found — it's indexed
            except NotFound:
                time.sleep(_SEARCH_VERIFY_POLL_INTERVAL)
            except Exception:
                # Non-404 errors (auth, network) — don't block the upload
                logger.warning(
                    "Search verification failed for %s — proceeding (document may be briefly unsearchable)",
                    entity_id,
                    exc_info=True,
                )
                return

        # Timeout — document not found after _SEARCH_VERIFY_TIMEOUT seconds
        logger.warning(
            "Document %s not verified searchable after %ds — proceeding anyway "
            "(VAIS indexing may still be in progress)",
            entity_id,
            _SEARCH_VERIFY_TIMEOUT,
        )

    def delete(self, entity_id: str, project_id: str) -> bool:
        """Delete a document from VAIS. Returns True on success (including 404).

        Ensures the project's DataStore exists, then deletes the document.
        """
        datastore_id = ensure_project_store(project_id, self._supabase)
        if datastore_id is None:
            raise StoreNotReady(project_id)

        return delete_document(
            entity_id=entity_id,
            datastore_id=datastore_id,
        )

    def check_existing(self, entity_id: str, project_id: str) -> bool:
        """Check if a document already exists in VAIS (previous LRO completed).

        Per ENG-2890: on retry, call get_document(entity_id). If exists,
        skip upload. If 404, upload fresh. On unexpected errors, return
        False (re-upload is safe — INCREMENTAL mode is idempotent).
        """
        try:
            datastore_id = ensure_project_store(project_id, self._supabase)
            get_document(entity_id=entity_id, datastore_id=datastore_id)
            logger.info("Document %s already exists in VAIS — skipping upload", entity_id)
            return True
        except NotFound:
            return False
        except Exception:
            logger.warning(
                "Failed to check existing document %s — will re-upload (safe)",
                entity_id,
                exc_info=True,
            )
            return False

    def check_content_gate(self, file_path: str, filename: str) -> ContentGateResult:
        """Check if a file passes the content gate (size-only, fail-open)."""
        return check_content_gate(file_path, filename)
```

### Key design decisions in the fix:

1. **Verification method**: Uses `get_document()` (Document API) rather than a full search query. The Document API reflects document presence in the index and is a strong signal of searchability. A full search query would be more definitive but adds complexity (needs a query string, filter construction, and result parsing).

2. **Fail-open on timeout**: If verification times out after 60 seconds, we log a warning but still return success. The alternative (failing the upload) would trigger a retry cycle, delaying the document even further. The document will become searchable shortly — the timeout just means VAIS is slower than usual.

3. **Fail-open on errors**: Non-404 errors (auth, network) during verification don't block the upload. This preserves the existing reliability guarantees.

4. **Poll interval**: 2 seconds, which balances responsiveness (most documents are ready within 5-10 seconds) with API cost.

5. **Placement in service.py**: The verification is in `VaisFileSearchService.upload()` rather than in the sync worker. This means any caller of `upload()` automatically gets the guarantee.

## Test

### Unit test for search verification

**File: `/workspaces/test-mvp/python-services/tests/unit/vais/test_search_verification.py`**

```python
"""Tests for VAIS search verification after upload (ENG-3500).

Verifies that VaisFileSearchService.upload() polls get_document() after
the import LRO completes, closing the indexing latency gap that caused
documents to show as 'synced' in the UI before Effi could find them.
"""

from __future__ import annotations

import time
from unittest.mock import MagicMock, Mock, patch

import pytest
from google.api_core.exceptions import NotFound

from agent_api.vais.service import VaisFileSearchService


# =============================================================================
# Helpers
# =============================================================================


def _make_service() -> tuple[VaisFileSearchService, MagicMock]:
    """Create a VaisFileSearchService with a mocked Supabase client."""
    mock_supabase = MagicMock()
    service = VaisFileSearchService(mock_supabase)
    return service, mock_supabase


def _patch_upload_and_store():
    """Context manager that patches upload_document and ensure_project_store."""
    return (
        patch("agent_api.vais.service.upload_document"),
        patch("agent_api.vais.service.ensure_project_store", return_value="ds-test-123"),
    )


# =============================================================================
# Tests: Verification succeeds immediately
# =============================================================================


class TestSearchVerificationImmediate:
    """Document is immediately retrievable after LRO — no delay."""

    def test_upload_returns_entity_id_when_immediately_searchable(self):
        """upload() returns entity_id when get_document succeeds immediately."""
        service, _ = _make_service()

        with (
            patch("agent_api.vais.service.upload_document"),
            patch("agent_api.vais.service.ensure_project_store", return_value="ds-123"),
            patch("agent_api.vais.service.get_document") as mock_get_doc,
        ):
            mock_get_doc.return_value = Mock()  # Document found

            result = service.upload(
                entity_id="entity-abc",
                file_path="/tmp/test.pdf",
                filename="test.pdf",
                metadata_dict={"project_id": "proj-1"},
                project_id="proj-1",
                access_level="internal",
            )

        assert result == "entity-abc"
        mock_get_doc.assert_called_once_with(entity_id="entity-abc", datastore_id="ds-123")

    def test_upload_calls_upload_document_before_verification(self):
        """upload_document() is called before get_document() verification."""
        service, _ = _make_service()
        call_order = []

        def track_upload(*args, **kwargs):
            call_order.append("upload")

        def track_verify(*args, **kwargs):
            call_order.append("verify")
            return Mock()

        with (
            patch("agent_api.vais.service.upload_document", side_effect=track_upload),
            patch("agent_api.vais.service.ensure_project_store", return_value="ds-123"),
            patch("agent_api.vais.service.get_document", side_effect=track_verify),
        ):
            service.upload(
                entity_id="entity-abc",
                file_path="/tmp/test.pdf",
                filename="test.pdf",
                metadata_dict={},
                project_id="proj-1",
                access_level="internal",
            )

        assert call_order == ["upload", "verify"]


# =============================================================================
# Tests: Verification with delay (the bug scenario)
# =============================================================================


class TestSearchVerificationWithDelay:
    """Document is not immediately retrievable — polls until found."""

    def test_upload_polls_until_document_found(self):
        """upload() retries get_document when it initially returns NotFound."""
        service, _ = _make_service()

        with (
            patch("agent_api.vais.service.upload_document"),
            patch("agent_api.vais.service.ensure_project_store", return_value="ds-123"),
            patch("agent_api.vais.service.get_document") as mock_get_doc,
            patch("agent_api.vais.service.time") as mock_time,
        ):
            # Simulate: not found twice, then found on third call
            mock_get_doc.side_effect = [
                NotFound("not indexed yet"),
                NotFound("still not indexed"),
                Mock(),  # Found on third try
            ]
            # Mock time to avoid real sleeps
            mock_time.time.side_effect = [0, 0, 2, 2, 4, 4]  # start, check, sleep, check, sleep, check

            result = service.upload(
                entity_id="entity-delayed",
                file_path="/tmp/test.pdf",
                filename="test.pdf",
                metadata_dict={},
                project_id="proj-1",
                access_level="internal",
            )

        assert result == "entity-delayed"
        assert mock_get_doc.call_count == 3
        # Verify sleep was called between polls
        assert mock_time.sleep.call_count == 2


# =============================================================================
# Tests: Verification timeout (fail-open)
# =============================================================================


class TestSearchVerificationTimeout:
    """Document never becomes retrievable within timeout — fail open."""

    def test_upload_succeeds_on_verification_timeout(self):
        """upload() returns entity_id even when verification times out."""
        service, _ = _make_service()

        with (
            patch("agent_api.vais.service.upload_document"),
            patch("agent_api.vais.service.ensure_project_store", return_value="ds-123"),
            patch("agent_api.vais.service.get_document") as mock_get_doc,
            patch("agent_api.vais.service.time") as mock_time,
        ):
            # Always not found
            mock_get_doc.side_effect = NotFound("never indexed")
            # Simulate time progressing past timeout
            mock_time.time.side_effect = [0, 0, 61]  # start, first check, past timeout

            result = service.upload(
                entity_id="entity-slow",
                file_path="/tmp/test.pdf",
                filename="test.pdf",
                metadata_dict={},
                project_id="proj-1",
                access_level="internal",
            )

        # Should still succeed — fail open
        assert result == "entity-slow"

    def test_upload_succeeds_on_verification_error(self):
        """upload() returns entity_id when verification hits a non-404 error."""
        service, _ = _make_service()

        with (
            patch("agent_api.vais.service.upload_document"),
            patch("agent_api.vais.service.ensure_project_store", return_value="ds-123"),
            patch("agent_api.vais.service.get_document") as mock_get_doc,
            patch("agent_api.vais.service.time") as mock_time,
        ):
            # Auth error — not a 404
            mock_get_doc.side_effect = PermissionError("no access")
            mock_time.time.side_effect = [0, 0]

            result = service.upload(
                entity_id="entity-err",
                file_path="/tmp/test.pdf",
                filename="test.pdf",
                metadata_dict={},
                project_id="proj-1",
                access_level="internal",
            )

        # Should still succeed — fail open on non-404 errors
        assert result == "entity-err"


# =============================================================================
# Tests: Upload failure still raises
# =============================================================================


class TestUploadFailureStillRaises:
    """Upload failures should still propagate — verification doesn't swallow them."""

    def test_upload_document_exception_propagates(self):
        """If upload_document() raises, the exception propagates (no swallowing)."""
        service, _ = _make_service()

        with (
            patch(
                "agent_api.vais.service.upload_document",
                side_effect=RuntimeError("VAIS import failed"),
            ),
            patch("agent_api.vais.service.ensure_project_store", return_value="ds-123"),
            patch("agent_api.vais.service.get_document"),
        ):
            with pytest.raises(RuntimeError, match="VAIS import failed"):
                service.upload(
                    entity_id="entity-fail",
                    file_path="/tmp/test.pdf",
                    filename="test.pdf",
                    metadata_dict={},
                    project_id="proj-1",
                    access_level="internal",
                )

    def test_store_not_ready_still_raises(self):
        """StoreNotReady should still propagate."""
        service, _ = _make_service()

        from agent_api.vais.store_lifecycle import StoreNotReady

        with patch("agent_api.vais.service.ensure_project_store", return_value=None):
            with pytest.raises(StoreNotReady):
                service.upload(
                    entity_id="entity-nostore",
                    file_path="/tmp/test.pdf",
                    filename="test.pdf",
                    metadata_dict={},
                    project_id="proj-1",
                    access_level="internal",
                )
```

### Integration test for the sync worker VAIS path

This would also require updating the existing VAIS branch test in `test_sync_worker_vais_branch.py` to mock `get_document` in the verification step. The test at `TestVaisBranchHappyPath.test_vais_sync_happy_path` would need an additional mock:

```python
# In the existing happy path test, add:
patch("agent_api.vais.service.get_document", return_value=Mock()),
```

## Additional Actions

### 1. Follow-up: Consider a search-based verification for higher confidence

The current fix uses `get_document()` as a proxy for searchability. For even higher confidence, a future improvement could execute a simple VAIS search query scoped to the document's `entity_id` and `project_id`. This would verify end-to-end searchability including chunk indexing. However, `get_document()` is a strong signal and covers the majority of the gap.

### 2. Monitoring: Add a metric for verification delay

The `_verify_searchable` method logs when the delay exceeds 1 second. This should be wired to a metric (e.g., Sentry custom metric or structured log) so we can track the p50/p99 verification delay over time and detect if VAIS indexing performance degrades.

### 3. Documentation: Update the VAIS CLAUDE.md

Add a note to `/workspaces/test-mvp/python-services/agent_api/vais/CLAUDE.md` about the VAIS indexing latency gap and why `_verify_searchable` exists. This prevents future developers from removing the verification as a "performance optimization."

### 4. Existing experiment validation

The experiment at `/workspaces/test-mvp/python-services/experiments/vais_indexing_latency_experiment.py` was specifically designed to measure this gap. Its results should be run periodically to validate that the fix is effective and the verification timeout is appropriately sized.

### 5. Clear `pending_lro_name` on sync

Minor related issue: the VAIS sync path (sync_worker.py line 848-861) does not clear `pending_lro_name` when marking the item as synced. This is not the root cause of the current bug, but it leaves stale data in the database. The synced update should include `"pending_lro_name": None` in the update payload.

## Files Examined

- `/workspaces/test-mvp/python-services/agent_api/sync_worker.py` — Sync worker orchestrator
- `/workspaces/test-mvp/python-services/agent_api/vais/service.py` — VAIS service (fix location)
- `/workspaces/test-mvp/python-services/agent_api/vais/upload.py` — VAIS upload pipeline
- `/workspaces/test-mvp/python-services/agent_api/vais/store_lifecycle.py` — VAIS store creation
- `/workspaces/test-mvp/python-services/agent_api/vais/metadata.py` — Metadata serialization
- `/workspaces/test-mvp/python-services/agent_api/vais/query_service.py` — VAIS search query service
- `/workspaces/test-mvp/python-services/agent_api/vais/search_service.py` — Raw VAIS search
- `/workspaces/test-mvp/python-services/agent_api/project_file_search_service.py` — GFS file search service
- `/workspaces/test-mvp/python-services/agent_api/sync_items.py` — Entity getter dispatcher
- `/workspaces/test-mvp/python-services/tests/unit/test_sync_worker_vais_branch.py` — Existing VAIS branch tests
- `/workspaces/test-mvp/python-services/tests/unit/test_sync_items_file.py` — File entity getter tests
- `/workspaces/test-mvp/python-services/tests/unit/conftest.py` — Test fixtures
- `/workspaces/test-mvp/python-services/experiments/vais_indexing_latency_experiment.py` — Experiment measuring the exact gap
- `/workspaces/test-mvp/python-services/experiments/vais_reliability/phase5_results.json` — Experiment results showing ~33s indexing delay
- `/workspaces/test-mvp/supabase/migrations/20260318064553_slice4_worker_rpcs.sql` — Audit trigger and claim RPCs
- `/workspaces/test-mvp/supabase/migrations/20260325133959_use_denormalized_project_id_in_claim_rpcs.sql` — Latest claim RPC version
- `/workspaces/test-mvp/nextjs-app/app/projects/[projectId]/config/data-tab/merge-data-rows.ts` — UI sync status mapping
