# Phase 02: VAIS Prototype Design

Design date: 2026-02-26

---

## 1. Database Schema

### Design Principles

- All tables prefixed `vais_` -- zero coupling to production GFS tables.
- ONE DataStore per project (not 6 stores). Access control via metadata `access_level` field + `ANY()` filtering.
- Reuse Supabase Storage (`user-files` bucket) for file content. VAIS sync is decoupled.
- RLS: keep it simple -- prototype-grade. Project owners can do everything. Members can read.
- Status enum mirrors GFS patterns but is its own Postgres type.

### Migration SQL

```sql
-- Migration: create_vais_prototype_schema
-- Standalone VAIS prototype tables. Zero coupling to production GFS tables.

-- =============================================================================
-- ENUM: vais_sync_status
-- =============================================================================
-- Simplified state machine for VAIS document sync lifecycle.
-- Fewer states than GFS -- VAIS LROs are honest and don't hang.

CREATE TYPE vais_sync_status AS ENUM (
    'pending',           -- Queued for sync worker pickup
    'processing',        -- Worker claimed, uploading to VAIS
    'synced',            -- Successfully indexed in VAIS
    'failed',            -- Upload failed (retryable)
    'excluded',          -- Excluded (content too large, unsupported)
    'retry_exhausted',   -- Max retries reached
    'pending_deletion',  -- Queued for deletion from VAIS
    'deleting',          -- Worker claimed, deleting from VAIS
    'deleted'            -- Successfully removed from VAIS
);

-- =============================================================================
-- TABLE: vais_stores
-- =============================================================================
-- One row per project. Tracks the VAIS DataStore + Engine pair.
-- Unlike GFS (6 stores per project), VAIS uses ONE DataStore per project
-- with metadata filtering for access control.

CREATE TABLE vais_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    datastore_id TEXT NOT NULL,          -- VAIS DataStore ID (e.g., "vais-proj-abc123")
    engine_id TEXT NOT NULL,             -- VAIS Engine ID (e.g., "vais-eng-abc123")
    datastore_name TEXT,                 -- Full resource name (projects/.../dataStores/...)
    engine_name TEXT,                    -- Full resource name (projects/.../engines/...)
    schema_version INTEGER NOT NULL DEFAULT 0,  -- Tracks which schema revision is applied
    status TEXT NOT NULL DEFAULT 'creating'
        CHECK (status IN ('creating', 'ready', 'error')),
    error_message TEXT,                  -- Last error during creation
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT vais_stores_project_key UNIQUE(project_id)
);

CREATE INDEX idx_vais_stores_project ON vais_stores(project_id);
CREATE INDEX idx_vais_stores_status ON vais_stores(status);

-- =============================================================================
-- TABLE: vais_documents
-- =============================================================================
-- Tracks each document uploaded to VAIS. Maps Supabase file to VAIS document.
-- One row per logical file (not per version -- versions tracked separately).

CREATE TABLE vais_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES vais_stores(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    vais_document_id TEXT,               -- VAIS-assigned document ID (set after first upload)
    access_level TEXT NOT NULL CHECK (access_level IN ('internal', 'external')),
    entity_type TEXT NOT NULL DEFAULT 'file'
        CHECK (entity_type IN ('file', 'email', 'email_attachment')),
    metadata JSONB NOT NULL DEFAULT '{}',  -- Arbitrary metadata synced to VAIS struct_data
    sync_status vais_sync_status NOT NULL DEFAULT 'pending',
    sync_error TEXT,                     -- Last sync error message
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,              -- Soft delete (NULL = active)
    CONSTRAINT vais_documents_project_file_key UNIQUE(project_id, file_name, access_level)
);

CREATE INDEX idx_vais_documents_store ON vais_documents(store_id);
CREATE INDEX idx_vais_documents_project ON vais_documents(project_id);
CREATE INDEX idx_vais_documents_sync_status ON vais_documents(sync_status)
    WHERE sync_status IN ('pending', 'failed', 'pending_deletion');
CREATE INDEX idx_vais_documents_active ON vais_documents(project_id)
    WHERE deleted_at IS NULL;

-- =============================================================================
-- TABLE: vais_document_versions
-- =============================================================================
-- Tracks each version of a document uploaded. When a user re-uploads the same
-- filename, a new version is created. The sync worker processes the latest version.

CREATE TABLE vais_document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES vais_documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    storage_path TEXT NOT NULL,           -- Path in Supabase Storage (user-files bucket)
    file_type TEXT NOT NULL,              -- Extension without dot: "txt", "md", "pdf", "docx"
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    mime_type TEXT NOT NULL,
    vais_document_id TEXT,               -- VAIS doc ID for THIS version (may differ across retries)
    sync_status vais_sync_status NOT NULL DEFAULT 'pending',
    sync_error TEXT,
    synced_at TIMESTAMPTZ,               -- When VAIS confirmed indexing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT vais_document_versions_doc_version_key UNIQUE(document_id, version_number)
);

CREATE INDEX idx_vais_doc_versions_document ON vais_document_versions(document_id);
CREATE INDEX idx_vais_doc_versions_sync ON vais_document_versions(sync_status)
    WHERE sync_status IN ('pending', 'failed');

-- =============================================================================
-- TABLE: vais_sync_events (audit log)
-- =============================================================================
-- Optional event log for debugging sync issues. Mirrors file_sync_events.

CREATE TABLE vais_sync_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES vais_documents(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,            -- 'sync_started', 'sync_succeeded', 'sync_failed', etc.
    triggered_by TEXT NOT NULL DEFAULT 'worker',
    vais_doc_id TEXT,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vais_sync_events_document ON vais_sync_events(document_id);
CREATE INDEX idx_vais_sync_events_created ON vais_sync_events(created_at);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
-- Prototype-grade: project members can read, owners can write.
-- Uses existing helper functions: is_project_owner(), get_user_project_role().

ALTER TABLE vais_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE vais_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vais_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vais_sync_events ENABLE ROW LEVEL SECURITY;

-- vais_stores: members can read, owners can write
CREATE POLICY vais_stores_select ON vais_stores
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = vais_stores.project_id
            AND pm.user_id = auth.uid()
        )
    );

CREATE POLICY vais_stores_insert ON vais_stores
    FOR INSERT WITH CHECK (is_project_owner(project_id));

CREATE POLICY vais_stores_update ON vais_stores
    FOR UPDATE USING (is_project_owner(project_id));

-- vais_documents: members can read, owners can write
CREATE POLICY vais_documents_select ON vais_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = vais_documents.project_id
            AND pm.user_id = auth.uid()
        )
    );

CREATE POLICY vais_documents_insert ON vais_documents
    FOR INSERT WITH CHECK (is_project_owner(project_id));

CREATE POLICY vais_documents_update ON vais_documents
    FOR UPDATE USING (is_project_owner(project_id));

CREATE POLICY vais_documents_delete ON vais_documents
    FOR DELETE USING (is_project_owner(project_id));

-- vais_document_versions: members can read via parent document
CREATE POLICY vais_doc_versions_select ON vais_document_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM vais_documents vd
            JOIN project_members pm ON pm.project_id = vd.project_id
            WHERE vd.id = vais_document_versions.document_id
            AND pm.user_id = auth.uid()
        )
    );

CREATE POLICY vais_doc_versions_insert ON vais_document_versions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM vais_documents vd
            WHERE vd.id = vais_document_versions.document_id
            AND is_project_owner(vd.project_id)
        )
    );

-- vais_sync_events: members can read via parent document
CREATE POLICY vais_sync_events_select ON vais_sync_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM vais_documents vd
            JOIN project_members pm ON pm.project_id = vd.project_id
            WHERE vd.id = vais_sync_events.document_id
            AND pm.user_id = auth.uid()
        )
    );

-- Service role bypass (sync worker uses service role key, bypasses RLS)
-- No additional policies needed -- service role ignores RLS by default.

-- =============================================================================
-- RPC: claim_pending_vais_sync
-- =============================================================================
-- Atomic claim for sync worker. Same pattern as claim_pending_file_sync.

CREATE OR REPLACE FUNCTION claim_pending_vais_sync(p_max_retries INTEGER DEFAULT 5)
RETURNS SETOF vais_documents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    UPDATE vais_documents
    SET sync_status = 'processing',
        updated_at = NOW()
    WHERE id = (
        SELECT id FROM vais_documents
        WHERE sync_status IN ('pending', 'failed')
        AND retry_count < p_max_retries
        AND deleted_at IS NULL
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$;

-- =============================================================================
-- RPC: claim_pending_vais_deletion
-- =============================================================================

CREATE OR REPLACE FUNCTION claim_pending_vais_deletion()
RETURNS SETOF vais_documents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    UPDATE vais_documents
    SET sync_status = 'deleting',
        updated_at = NOW()
    WHERE id = (
        SELECT id FROM vais_documents
        WHERE sync_status = 'pending_deletion'
        AND deleted_at IS NULL
        ORDER BY updated_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$;

-- =============================================================================
-- TRIGGER: set deleted_at on successful deletion
-- =============================================================================

CREATE OR REPLACE FUNCTION vais_set_deleted_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.sync_status = 'deleted' AND OLD.sync_status = 'deleting' THEN
        NEW.deleted_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER vais_documents_set_deleted_at
    BEFORE UPDATE ON vais_documents
    FOR EACH ROW
    EXECUTE FUNCTION vais_set_deleted_at();

-- =============================================================================
-- updated_at trigger
-- =============================================================================

CREATE TRIGGER vais_stores_updated_at
    BEFORE UPDATE ON vais_stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER vais_documents_updated_at
    BEFORE UPDATE ON vais_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

### Entity Relationship

```
vais_stores (1 per project)
  └── vais_documents (N per store)
       ├── vais_document_versions (N per document)
       └── vais_sync_events (N per document, audit log)
```

---

## 2. Python Service Architecture

All new services live in `python-services/agent_api/vais/` as a subpackage. Clean boundary from GFS code.

### Package Structure

```
python-services/agent_api/vais/
├── __init__.py
├── config.py              # GCP project, location, collection constants
├── store_service.py       # DataStore + Engine lifecycle
├── schema_service.py      # Metadata schema management
├── document_service.py    # Upload, delete, list documents
├── search_service.py      # CHUNKS mode search with metadata filtering
├── sync_worker.py         # Background worker for VAIS sync
└── types.py               # Pydantic models, enums, shared types
```

### 2.1 `vais/config.py` -- Configuration

```python
"""VAIS prototype configuration."""

import os

# GCP project and VAIS location (always 'global' for Discovery Engine)
GCP_PROJECT = os.getenv("VAIS_GCP_PROJECT", "effi-vertex-experiment")
VAIS_LOCATION = "global"
VAIS_COLLECTION = "default_collection"

# GCS bucket for large file uploads (>1MB inline limit)
GCS_BUCKET = os.getenv("VAIS_GCS_BUCKET", "vais-prototype-uploads")

# Inline upload size limit (bytes) -- VAIS hard limit
INLINE_UPLOAD_LIMIT = 1_000_000  # 1MB

# Chunk configuration
CHUNK_SIZE = 500  # tokens
INCLUDE_ANCESTOR_HEADINGS = True

# Sync worker
VAIS_POLL_INTERVAL = int(os.getenv("VAIS_SYNC_POLL_INTERVAL", "10"))
VAIS_MAX_RETRIES = int(os.getenv("VAIS_MAX_RETRIES", "5"))
VAIS_MAX_ITEMS_PER_CYCLE = int(os.getenv("VAIS_MAX_ITEMS_PER_CYCLE", "10"))
VAIS_LRO_TIMEOUT = int(os.getenv("VAIS_LRO_TIMEOUT", "600"))

# Metadata schema definition (applied to every new DataStore)
METADATA_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
        "project_id":   {"type": "string", "indexable": True, "retrievable": True},
        "access_level": {"type": "string", "indexable": True, "retrievable": True},
        "entity_type":  {"type": "string", "indexable": True, "retrievable": True},
        "file_type":    {"type": "string", "indexable": True, "retrievable": True},
        "file_id":      {"type": "string", "indexable": True, "retrievable": True},
        "file_name":    {"type": "string", "indexable": False, "retrievable": True},
    },
}


def make_parent() -> str:
    """Build the VAIS collection parent path."""
    return f"projects/{GCP_PROJECT}/locations/{VAIS_LOCATION}/collections/{VAIS_COLLECTION}"


def make_branch(datastore_id: str) -> str:
    """Build the VAIS branch path for document operations."""
    return f"{make_parent()}/dataStores/{datastore_id}/branches/default_branch"


def make_serving_config(engine_id: str) -> str:
    """Build the VAIS serving config path for search operations."""
    return f"{make_parent()}/engines/{engine_id}/servingConfigs/default_search"
```

### 2.2 `vais/types.py` -- Shared Types

```python
"""VAIS prototype types and Pydantic models."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class VaisSyncStatus(StrEnum):
    """Mirrors the vais_sync_status Postgres enum."""
    PENDING = "pending"
    PROCESSING = "processing"
    SYNCED = "synced"
    FAILED = "failed"
    EXCLUDED = "excluded"
    RETRY_EXHAUSTED = "retry_exhausted"
    PENDING_DELETION = "pending_deletion"
    DELETING = "deleting"
    DELETED = "deleted"


class StoreStatus(StrEnum):
    CREATING = "creating"
    READY = "ready"
    ERROR = "error"


# --- API Request/Response Models ---

class VaisSearchRequest(BaseModel):
    """Request body for POST /api/vais/projects/{project_id}/search."""
    query: str = Field(..., min_length=1, max_length=1000, description="Search query text")
    entity_type: str | list[str] | None = Field(
        None,
        description="Filter by entity type: 'file', 'email', 'email_attachment', or list"
    )
    access_level: str | None = Field(
        None,
        description="Filter by access level: 'internal' or 'external'"
    )
    filter: str | None = Field(
        None,
        description="Additional VAIS filter expression (ANY() syntax)"
    )
    num_results: int = Field(10, ge=1, le=50, description="Max number of chunk results")


class VaisChunkResult(BaseModel):
    """A single chunk result from VAIS search."""
    content: str
    relevance_score: float
    document_id: str | None = None      # Extracted from chunk.name path
    chunk_id: str | None = None
    source_file: str | None = None      # file_name from metadata
    metadata: dict[str, Any] = Field(default_factory=dict)


class VaisSearchResponse(BaseModel):
    """Response for POST /api/vais/projects/{project_id}/search."""
    success: bool
    query: str
    chunks: list[VaisChunkResult] = Field(default_factory=list)
    total_results: int = 0
    error: str | None = None


class VaisDocumentResponse(BaseModel):
    """Response for document operations."""
    success: bool
    document_id: str | None = None
    vais_document_id: str | None = None
    message: str | None = None
    error: str | None = None


class VaisStoreResponse(BaseModel):
    """Response for GET /api/vais/projects/{project_id}/store."""
    success: bool
    project_id: str
    datastore_id: str | None = None
    engine_id: str | None = None
    status: str | None = None
    schema_version: int = 0
    document_count: int = 0
    error: str | None = None


class VaisDocumentListItem(BaseModel):
    """A document in the list response."""
    id: str
    file_name: str
    access_level: str
    entity_type: str
    sync_status: str
    sync_error: str | None = None
    size_bytes: int | None = None
    file_type: str | None = None
    version_number: int | None = None
    created_at: str
    updated_at: str


class VaisDocumentListResponse(BaseModel):
    """Response for GET /api/vais/projects/{project_id}/documents."""
    success: bool
    documents: list[VaisDocumentListItem] = Field(default_factory=list)
    error: str | None = None
```

### 2.3 `vais/store_service.py` -- DataStore + Engine Lifecycle

```python
"""VAIS DataStore and Engine lifecycle management.

Handles lazy creation: DataStore + Engine + Schema are created on first upload
for a project. Subsequent uploads reuse the existing resources.
"""

import json
import logging

import google.cloud.discoveryengine_v1 as discoveryengine
from supabase import Client

from agent_api.vais.config import (
    CHUNK_SIZE,
    GCP_PROJECT,
    INCLUDE_ANCESTOR_HEADINGS,
    METADATA_SCHEMA,
    make_parent,
)
from agent_api.vais.types import StoreStatus

logger = logging.getLogger(__name__)


class VaisStoreService:
    """Manages VAIS DataStore + Engine lifecycle per project."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    def get_or_create_store(self, project_id: str) -> dict:
        """Get existing store or create DataStore + Engine + Schema for a project.

        Returns:
            dict with keys: id, datastore_id, engine_id, status
        """
        ...

    def _get_existing_store(self, project_id: str) -> dict | None:
        """Query vais_stores for an existing ready store."""
        ...

    def _create_store(self, project_id: str) -> dict:
        """Create DataStore + Engine + Schema, insert into vais_stores.

        Steps:
        1. Insert vais_stores row with status='creating'
        2. Create DataStore via LRO (with chunking config + ancestor headings)
        3. Create Engine via LRO (SEARCH_TIER_ENTERPRISE)
        4. Apply metadata schema via SchemaServiceClient
        5. Update row to status='ready'

        On failure at any step: update row to status='error' with error_message.
        """
        ...

    def _create_datastore(self, project_id: str) -> tuple[str, str]:
        """Create a VAIS DataStore with chunk mode + ancestor headings.

        Returns: (datastore_id, datastore_name)
        """
        ...

    def _create_engine(self, datastore_id: str, project_id: str) -> tuple[str, str]:
        """Create a VAIS search Engine pointing to the DataStore.

        Returns: (engine_id, engine_name)
        """
        ...
```

### 2.4 `vais/schema_service.py` -- Metadata Schema Management

```python
"""VAIS metadata schema management.

The schema MUST be applied to a DataStore BEFORE uploading documents.
Without it, metadata filtering won't work.
"""

import json
import logging

import google.cloud.discoveryengine_v1 as discoveryengine

from agent_api.vais.config import GCP_PROJECT, METADATA_SCHEMA, make_parent

logger = logging.getLogger(__name__)


class VaisSchemaService:
    """Manages VAIS metadata schemas."""

    def ensure_schema(self, datastore_id: str, current_version: int = 0) -> int:
        """Ensure the metadata schema is applied to the DataStore.

        Args:
            datastore_id: The VAIS DataStore ID
            current_version: Current schema version from vais_stores

        Returns:
            New schema version number (incremented if schema was updated)
        """
        ...

    def _apply_schema(self, datastore_id: str) -> None:
        """Apply the METADATA_SCHEMA to the DataStore's default_schema.

        Uses update_schema with allow_missing=True for idempotent creation.
        This is an LRO that triggers re-indexing (~3s).
        """
        ...

    def _verify_schema(self, datastore_id: str) -> bool:
        """Verify the schema was applied correctly by fetching and comparing fields."""
        ...
```

### 2.5 `vais/document_service.py` -- Document Upload/Delete/List

```python
"""VAIS document CRUD operations.

Handles the two upload paths:
- Inline: files < 1MB uploaded directly via ImportDocumentsRequest.InlineSource
- GCS: files >= 1MB uploaded to GCS first, then imported via GcsSource

Both paths set struct_data metadata for filtering.
"""

import logging
import os
import tempfile
from pathlib import Path

import google.cloud.discoveryengine_v1 as discoveryengine
from google.cloud import storage
from google.protobuf.struct_pb2 import Struct
from supabase import Client

from agent_api.vais.config import (
    GCS_BUCKET,
    INLINE_UPLOAD_LIMIT,
    VAIS_LRO_TIMEOUT,
    make_branch,
)

logger = logging.getLogger(__name__)

# MIME type mapping (same as GFS but VAIS supports more formats)
VAIS_MIME_TYPES: dict[str, str] = {
    "txt": "text/plain",
    "md": "text/markdown",
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv",
}


class VaisDocumentService:
    """Manages document upload, deletion, and listing in VAIS."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    def upload_document(
        self,
        datastore_id: str,
        document_id: str,
        file_bytes: bytes,
        mime_type: str,
        metadata: dict[str, str],
    ) -> dict:
        """Upload a document to VAIS.

        Chooses inline vs GCS path based on file size.

        Args:
            datastore_id: VAIS DataStore ID
            document_id: Document ID to use in VAIS (deterministic, e.g. "vais-{uuid}")
            file_bytes: Raw file content
            mime_type: MIME type string
            metadata: Dict of metadata fields to set as struct_data

        Returns:
            dict with keys: success, vais_document_id, error
        """
        ...

    def _upload_inline(
        self,
        branch: str,
        document_id: str,
        file_bytes: bytes,
        mime_type: str,
        metadata: dict[str, str],
    ) -> dict:
        """Upload via ImportDocumentsRequest.InlineSource (< 1MB).

        Builds a Document with:
        - content.raw_bytes + content.mime_type
        - struct_data populated from metadata dict
        - reconciliation_mode = INCREMENTAL (upsert)
        """
        ...

    def _upload_via_gcs(
        self,
        branch: str,
        document_id: str,
        file_bytes: bytes,
        mime_type: str,
        metadata: dict[str, str],
    ) -> dict:
        """Upload via GCS for files >= 1MB.

        Steps:
        1. Upload file_bytes to GCS bucket at path: {datastore_id}/{document_id}
        2. Import via ImportDocumentsRequest with GcsSource + data_schema="content"
        3. Wait for LRO completion
        4. Cleanup GCS blob (fire-and-forget)

        Note: GCS path uploads don't support struct_data inline.
        After import, update the document's struct_data separately via
        DocumentServiceClient.update_document().
        """
        ...

    def _build_struct_data(self, metadata: dict[str, str]) -> Struct:
        """Convert a flat metadata dict to a protobuf Struct.

        All values are stored as string_value in the Struct.
        """
        ...

    def delete_document(self, datastore_id: str, vais_document_id: str) -> dict:
        """Delete a document from VAIS by its document ID.

        Uses DocumentServiceClient.delete_document().
        No force flag needed (unlike GFS).

        Returns:
            dict with keys: success, error
        """
        ...

    def list_documents(self, datastore_id: str) -> list[dict]:
        """List all documents in a VAIS DataStore.

        Uses DocumentServiceClient.list_documents() on the default_branch.

        Returns:
            List of dicts with: id, name, struct_data fields
        """
        ...

    def download_from_storage(self, storage_path: str) -> bytes:
        """Download file content from Supabase Storage.

        Args:
            storage_path: Path in user-files bucket

        Returns:
            Raw file bytes
        """
        ...
```

### 2.6 `vais/search_service.py` -- CHUNKS Mode Search

```python
"""VAIS search service -- CHUNKS mode with metadata filtering.

Unlike GFS (which uses Gemini+FileSearch grounding in one call), VAIS returns
raw chunks via SearchServiceClient.search(). The caller (MCP tool or search
playground) gets raw chunks with content + relevance scores.
"""

import logging
import time
from typing import Any

import sentry_sdk
from google.cloud.discoveryengine_v1 import SearchRequest, SearchServiceClient

from agent_api.vais.config import make_serving_config
from agent_api.vais.types import VaisChunkResult

logger = logging.getLogger(__name__)


class VaisSearchService:
    """Search VAIS DataStores in CHUNKS mode with metadata filtering."""

    def search(
        self,
        engine_id: str,
        query: str,
        filter_expr: str | None = None,
        num_results: int = 10,
        num_previous_chunks: int = 1,
        num_next_chunks: int = 1,
    ) -> dict[str, Any]:
        """Execute a VAIS search in CHUNKS mode.

        Args:
            engine_id: VAIS Engine ID
            query: Search query text (must be semantically meaningful)
            filter_expr: VAIS filter expression, e.g.:
                'access_level: ANY("internal", "external")'
                'project_id: ANY("abc-123") AND entity_type: ANY("file")'
            num_results: Max chunk results to return (1-50)
            num_previous_chunks: Number of preceding chunks for context
            num_next_chunks: Number of following chunks for context

        Returns:
            dict with: success, chunks (list[VaisChunkResult]), total_results, error
        """
        ...

    def _build_search_request(
        self,
        engine_id: str,
        query: str,
        filter_expr: str | None,
        num_results: int,
        num_previous_chunks: int,
        num_next_chunks: int,
    ) -> SearchRequest:
        """Build a SearchRequest with CHUNKS mode and content search spec.

        ContentSearchSpec:
        - search_result_mode = CHUNKS
        - chunk_spec with num_previous_chunks and num_next_chunks
        """
        ...

    def _parse_chunk_results(self, response) -> list[VaisChunkResult]:
        """Parse SearchResponse into VaisChunkResult objects.

        For each result:
        - chunk.content -> content text
        - chunk.relevance_score -> relevance score
        - chunk.name -> extract document_id and chunk_id from path:
            .../documents/{doc_id}/chunks/{chunk_id}
        """
        ...

    def build_access_filter(
        self,
        project_id: str,
        access_level: str | None = None,
        entity_type: str | list[str] | None = None,
        user_filter: str | None = None,
    ) -> str:
        """Build a complete VAIS filter expression with access control.

        Always includes: project_id: ANY("{project_id}")
        Optionally adds: access_level: ANY("{access_level}")
        Optionally adds: entity_type: ANY("{entity_type}")
        Optionally appends: AND ({user_filter})

        All conditions combined with AND.

        Args:
            project_id: Required -- scopes to project
            access_level: "internal" or "external" (None = both)
            entity_type: "file", "email", "email_attachment", list, or None
            user_filter: Additional user-provided filter expression

        Returns:
            Complete filter expression string
        """
        ...
```

### 2.7 `vais/sync_worker.py` -- Background Sync Worker

```python
"""VAIS sync worker -- background processing for document sync.

Mirrors the GFS sync worker architecture but with VAIS-specific upload/delete.
Runs as a separate background task alongside the GFS worker.
"""

import asyncio
import logging
import os
import time
import uuid
from typing import Any

from supabase import create_client

from agent_api.vais.config import VAIS_MAX_ITEMS_PER_CYCLE, VAIS_MAX_RETRIES, VAIS_POLL_INTERVAL
from agent_api.vais.document_service import VaisDocumentService
from agent_api.vais.schema_service import VaisSchemaService
from agent_api.vais.store_service import VaisStoreService

logger = logging.getLogger(__name__)

# Graceful shutdown
vais_shutdown_event = asyncio.Event()


class VaisSyncWorker:
    """Background worker for processing VAIS document sync operations."""

    def __init__(self):
        """Initialize with service-role Supabase client."""
        supabase_url = os.environ.get("SUPABASE_URL", "")
        service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not service_role_key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY required for VAIS sync worker")

        self.supabase = create_client(supabase_url, service_role_key)
        self.store_service = VaisStoreService(self.supabase)
        self.schema_service = VaisSchemaService()
        self.doc_service = VaisDocumentService(self.supabase)

        hostname = os.getenv("HOSTNAME", "local")
        short_id = str(uuid.uuid4())[:8]
        self.worker_id = f"VAIS-Worker-{hostname}-{short_id}"

    def process_pending_syncs(self) -> int:
        """Process documents needing VAIS sync.

        For each claimed document:
        1. Ensure project has a ready VAIS store (lazy creation)
        2. Download file from Supabase Storage
        3. Upload to VAIS (inline or GCS based on size)
        4. Update sync status

        Returns: count processed
        """
        ...

    def process_pending_deletions(self) -> int:
        """Process documents needing VAIS deletion.

        For each claimed document:
        1. Get the VAIS document ID
        2. Call DocumentServiceClient.delete_document()
        3. Update sync status to 'deleted'

        Returns: count processed
        """
        ...

    def _build_metadata(self, doc: dict) -> dict[str, str]:
        """Build metadata dict for VAIS struct_data from a document row.

        Fields:
        - project_id: from doc
        - access_level: from doc
        - entity_type: from doc
        - file_id: doc['id']
        - file_name: doc['file_name']
        - file_type: from latest version
        """
        ...

    def _insert_event(
        self,
        document_id: str,
        event_type: str,
        vais_doc_id: str | None = None,
        error_message: str | None = None,
        duration_ms: int | None = None,
    ) -> None:
        """Insert an audit event into vais_sync_events."""
        ...

    def run_cycle(self) -> None:
        """Run one sync cycle: process syncs, then deletions."""
        ...


async def run_vais_sync_worker() -> None:
    """Main loop: poll every VAIS_POLL_INTERVAL seconds.

    Same fixed-rate scheduling pattern as GFS worker.
    Runs in asyncio.to_thread to avoid blocking the event loop.
    """
    ...
```

---

## 3. API Endpoints (FastAPI)

New router at `python-services/agent_api/api/vais.py`, registered in `main.py` as:
```python
from agent_api.api import vais
app.include_router(vais.router, prefix="/api/vais", tags=["vais"])
```

### Route Definitions

```python
"""VAIS prototype API endpoints."""

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from agent_api.vais.document_service import VaisDocumentService
from agent_api.vais.search_service import VaisSearchService
from agent_api.vais.store_service import VaisStoreService
from agent_api.vais.types import (
    VaisDocumentListResponse,
    VaisDocumentResponse,
    VaisSearchRequest,
    VaisSearchResponse,
    VaisStoreResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# --- Store Status ---

@router.get("/projects/{project_id}/store", response_model=VaisStoreResponse)
async def get_store_status(project_id: str):
    """Get VAIS store status for a project.

    Returns DataStore + Engine IDs, creation status, and document count.
    Returns 200 with status='not_found' if no store exists yet (lazy creation).
    """
    ...


# --- Document Upload ---

@router.post("/projects/{project_id}/documents", response_model=VaisDocumentResponse)
async def upload_document(
    project_id: str,
    file: UploadFile = File(...),
    access_level: Literal["internal", "external"] = Form(...),
    entity_type: str = Form("file"),
):
    """Upload a document to the VAIS prototype.

    This endpoint:
    1. Saves the file to Supabase Storage
    2. Creates/updates vais_documents and vais_document_versions records
    3. Sets sync_status to 'pending' for the sync worker to pick up

    The sync worker handles the actual VAIS upload asynchronously.

    Alternatively, for the prototype, we could do synchronous upload here
    to simplify debugging. Design supports both -- the sync_status field
    controls whether the worker picks it up or not.
    """
    ...


# --- Document Delete ---

@router.delete("/projects/{project_id}/documents/{document_id}", response_model=VaisDocumentResponse)
async def delete_document(project_id: str, document_id: str):
    """Delete a document from the VAIS prototype.

    Sets sync_status to 'pending_deletion'. The sync worker handles
    the actual VAIS deletion asynchronously.
    """
    ...


# --- Document List ---

@router.get("/projects/{project_id}/documents", response_model=VaisDocumentListResponse)
async def list_documents(project_id: str):
    """List all documents for a project in the VAIS prototype.

    Returns documents with their latest version info and sync status.
    """
    ...


# --- Search ---

@router.post("/projects/{project_id}/search", response_model=VaisSearchResponse)
async def search_documents(project_id: str, request: VaisSearchRequest):
    """Search documents in the VAIS prototype.

    Executes a VAIS search in CHUNKS mode with metadata filtering.
    Always scopes to the project (project_id filter auto-injected).
    Optionally filters by access_level and entity_type.

    Returns raw chunks with content, relevance scores, and source info.
    """
    ...
```

### Endpoint Summary Table

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/vais/projects/{project_id}/store` | Store status (DataStore + Engine info) |
| `POST` | `/api/vais/projects/{project_id}/documents` | Upload a file (multipart form) |
| `DELETE` | `/api/vais/projects/{project_id}/documents/{document_id}` | Soft-delete a file |
| `GET` | `/api/vais/projects/{project_id}/documents` | List all documents |
| `POST` | `/api/vais/projects/{project_id}/search` | Semantic search (CHUNKS mode) |

### Authentication

For the prototype, the VAIS endpoints will use a simplified auth approach:
- The API receives the project_id in the URL path.
- For now, no JWT validation on the VAIS prototype endpoints (prototype-grade).
- In production, these would use the same JWT auth middleware as the GFS endpoints.

---

## 4. UI Design

### 4.1 Upload UI -- Wiring Strategy

**Approach: New route with shared component.**

Do NOT modify the existing `project-file-manager.tsx` or its server actions. Instead:

1. Create a new page at `nextjs-app/app/(app)/projects/[projectId]/vais-files/page.tsx`
2. This page renders the existing `<ProjectFileManager>` component BUT with VAIS-specific server actions.
3. Create `nextjs-app/app/actions/vais-files.ts` that mirrors `project-files.ts` but calls the VAIS API endpoints instead of Supabase directly.

This keeps the existing GFS flow untouched. The prototype has its own route.

```
/projects/[projectId]/config       -> Existing GFS file manager
/projects/[projectId]/vais-files   -> VAIS prototype file manager (same UI, different backend)
/projects/[projectId]/vais-search  -> VAIS search playground (new page)
```

**Server action changes:**

```typescript
// nextjs-app/app/actions/vais-files.ts
"use server";

const VAIS_API_BASE = process.env.PYTHON_API_URL || "http://localhost:8000";

export async function uploadVaisFile(projectId: string, formData: FormData): Promise<UploadFileResult> {
    // POST to /api/vais/projects/{projectId}/documents with multipart form
    const response = await fetch(`${VAIS_API_BASE}/api/vais/projects/${projectId}/documents`, {
        method: "POST",
        body: formData,  // Pass through the FormData (file + accessLevel)
    });
    return response.json();
}

export async function deleteVaisFile(projectId: string, documentId: string): Promise<DeleteFileResult> {
    const response = await fetch(`${VAIS_API_BASE}/api/vais/projects/${projectId}/documents/${documentId}`, {
        method: "DELETE",
    });
    return response.json();
}

export async function getVaisFiles(projectId: string): Promise<GetFilesResult> {
    const response = await fetch(`${VAIS_API_BASE}/api/vais/projects/${projectId}/documents`);
    const data = await response.json();
    // Transform VAIS response to match ProjectFile[] shape expected by ProjectFileManager
    ...
}
```

**Alternatively (simpler for prototype):** Create a thin wrapper component `VaisFileManager` that uses the same visual layout but calls VAIS server actions directly. This avoids needing to match the exact `ProjectFile` interface shape.

### 4.2 Search Playground UI

New page: `nextjs-app/app/(app)/projects/[projectId]/vais-search/page.tsx`

#### Component Structure

```
VaisSearchPage (page.tsx)
├── VaisSearchForm (client component)
│   ├── Text input: query
│   ├── Select dropdown: entity_type (file | email | email_attachment | all)
│   ├── Select dropdown: access_level (internal | external | all)
│   ├── Text input: additional filter (raw VAIS syntax)
│   ├── Number input: max results (1-50, default 10)
│   └── Submit button
├── VaisSearchResults (client component)
│   ├── Result count + timing
│   └── VaisChunkCard[] (one per chunk)
│       ├── Relevance score badge (e.g., "0.74")
│       ├── Source document info (file name, entity type)
│       ├── Content preview (expandable, first 500 chars)
│       └── Metadata display (raw JSON, collapsible)
└── VaisStoreStatus (client component)
    ├── DataStore ID + Engine ID
    ├── Status badge (creating | ready | error)
    └── Document count
```

#### Rough React Structure

```tsx
// nextjs-app/app/(app)/projects/[projectId]/vais-search/page.tsx
import { VaisSearchPlayground } from "./vais-search-playground";

export default function VaisSearchPage({ params }: { params: { projectId: string } }) {
    return (
        <div className="container mx-auto py-6 space-y-6">
            <h1 className="text-2xl font-bold">VAIS Search Playground</h1>
            <VaisSearchPlayground projectId={params.projectId} />
        </div>
    );
}
```

```tsx
// nextjs-app/app/(app)/projects/[projectId]/vais-search/vais-search-playground.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface VaisSearchPlaygroundProps {
    projectId: string;
}

export function VaisSearchPlayground({ projectId }: VaisSearchPlaygroundProps) {
    const [query, setQuery] = useState("");
    const [entityType, setEntityType] = useState<string>("all");
    const [accessLevel, setAccessLevel] = useState<string>("all");
    const [additionalFilter, setAdditionalFilter] = useState("");
    const [maxResults, setMaxResults] = useState(10);
    const [results, setResults] = useState<VaisSearchResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [latencyMs, setLatencyMs] = useState<number | null>(null);

    const handleSearch = async () => {
        setLoading(true);
        const start = performance.now();

        try {
            const response = await fetch(
                `/api/vais-proxy/projects/${projectId}/search`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query,
                        entity_type: entityType === "all" ? null : entityType,
                        access_level: accessLevel === "all" ? null : accessLevel,
                        filter: additionalFilter || null,
                        num_results: maxResults,
                    }),
                }
            );
            const data = await response.json();
            setResults(data);
            setLatencyMs(Math.round(performance.now() - start));
        } catch (error) {
            setResults({ success: false, query, chunks: [], total_results: 0, error: String(error) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Search Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Search</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        placeholder="Enter search query..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <div className="flex gap-4">
                        <Select value={entityType} onValueChange={setEntityType}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Entity Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="file">File</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="email_attachment">Email Attachment</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={accessLevel} onValueChange={setAccessLevel}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Access Level" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Levels</SelectItem>
                                <SelectItem value="internal">Internal</SelectItem>
                                <SelectItem value="external">External</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder='Additional filter (e.g., file_type: ANY("pdf"))'
                            value={additionalFilter}
                            onChange={(e) => setAdditionalFilter(e.target.value)}
                            className="flex-1"
                        />
                    </div>
                    <Button onClick={handleSearch} disabled={loading || !query.trim()}>
                        {loading ? "Searching..." : "Search"}
                    </Button>
                </CardContent>
            </Card>

            {/* Results */}
            {results && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Results ({results.total_results} chunks)</span>
                            {latencyMs && (
                                <span className="text-sm font-normal text-muted-foreground">
                                    {latencyMs}ms
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {results.error && (
                            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
                                {results.error}
                            </div>
                        )}
                        <div className="space-y-4">
                            {results.chunks.map((chunk, i) => (
                                <ChunkCard key={i} chunk={chunk} />
                            ))}
                            {results.chunks.length === 0 && !results.error && (
                                <p className="text-muted-foreground text-sm">No results found.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function ChunkCard({ chunk }: { chunk: VaisChunkResult }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        {chunk.relevance_score.toFixed(3)}
                    </span>
                    {chunk.source_file && (
                        <span className="text-sm text-muted-foreground">{chunk.source_file}</span>
                    )}
                </div>
                {chunk.document_id && (
                    <span className="text-xs text-muted-foreground font-mono">
                        {chunk.document_id.slice(0, 12)}...
                    </span>
                )}
            </div>
            <div className="text-sm whitespace-pre-wrap">
                {expanded ? chunk.content : chunk.content.slice(0, 500)}
                {chunk.content.length > 500 && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="ml-1 text-blue-600 hover:underline"
                    >
                        {expanded ? "Show less" : "...Show more"}
                    </button>
                )}
            </div>
            {Object.keys(chunk.metadata).length > 0 && (
                <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Metadata</summary>
                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                        {JSON.stringify(chunk.metadata, null, 2)}
                    </pre>
                </details>
            )}
        </div>
    );
}
```

### 4.3 Next.js API Route Proxy

The search playground client component needs to call the Python API. To avoid CORS issues, create a Next.js API route that proxies to the Python backend.

```
nextjs-app/app/api/vais-proxy/projects/[projectId]/search/route.ts
nextjs-app/app/api/vais-proxy/projects/[projectId]/documents/route.ts
nextjs-app/app/api/vais-proxy/projects/[projectId]/store/route.ts
```

Each route proxies the request to `PYTHON_API_URL/api/vais/...` and returns the response. Straightforward passthrough -- no auth transformation needed for prototype.

---

## 5. Sync Worker Design

### 5.1 Lifecycle

The VAIS sync worker runs **alongside** the GFS sync worker as a separate `asyncio.Task` in the FastAPI lifespan. Both workers are independent.

In `main.py`:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ... existing GFS worker startup ...

    vais_worker_task = None
    if os.getenv("VAIS_SYNC_ENABLED", "false").lower() == "true":
        from agent_api.vais.sync_worker import run_vais_sync_worker, vais_shutdown_event
        vais_worker_task = asyncio.create_task(run_vais_sync_worker())
        logger.info("VAIS sync worker started")

    yield

    # Graceful shutdown
    if vais_worker_task:
        from agent_api.vais.sync_worker import vais_shutdown_event
        vais_shutdown_event.set()
        await vais_worker_task
```

Controlled by `VAIS_SYNC_ENABLED=true` env var. Disabled by default.

### 5.2 Polling Pattern

Same fixed-rate polling as GFS:
```
every VAIS_POLL_INTERVAL (10s):
    1. process_pending_syncs()    -- upload documents to VAIS
    2. process_pending_deletions() -- delete documents from VAIS
    3. cleanup_timed_out()        -- reset stuck 'processing' rows
```

No concurrency semaphore needed for prototype (single cycle at a time is fine). Add if needed later.

### 5.3 Status State Machine

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    v                                          │
pending ──> processing ──> synced ──> pending_deletion ──> deleting ──> deleted
                │                                              │
                ├──> failed ─────┐                             │
                │                │ (retry_count < max)         │
                │                └──> pending ─────────────────┘
                │
                ├──> excluded (content too large / unsupported)
                │
                └──> retry_exhausted (retry_count >= max)
```

### 5.4 Sync Flow Per Document

```
1. claim_pending_vais_sync RPC
   └── Atomically: WHERE sync_status IN ('pending', 'failed')
                   AND retry_count < MAX
                   SET sync_status = 'processing'
                   SKIP LOCKED (no contention)

2. Get or create VAIS store for project
   └── VaisStoreService.get_or_create_store(project_id)
       ├── Existing store (status='ready')? Use it
       └── No store? Create DataStore + Engine + Schema (LROs, ~5s total)

3. Get latest version
   └── Query vais_document_versions ORDER BY version_number DESC LIMIT 1

4. Download from Supabase Storage
   └── supabase.storage.from_("user-files").download(storage_path)

5. Upload to VAIS
   ├── size < 1MB? Inline upload (ImportDocuments + InlineSource)
   └── size >= 1MB? GCS upload (upload to bucket, ImportDocuments + GcsSource)

6. Update status
   ├── Success: sync_status='synced', vais_document_id=<id>
   ├── Failure: sync_status='failed', retry_count++, sync_error=<msg>
   └── Excluded: sync_status='excluded' (content too large)

7. Insert vais_sync_events audit row
```

### 5.5 Deletion Flow Per Document

```
1. claim_pending_vais_deletion RPC
   └── Atomically: WHERE sync_status = 'pending_deletion'
                   SET sync_status = 'deleting'
                   SKIP LOCKED

2. Get vais_document_id from vais_documents row

3. Delete from VAIS
   └── DocumentServiceClient.delete_document(name=<full_path>)

4. Update status
   ├── Success: sync_status='deleted' (trigger sets deleted_at)
   └── Failure: sync_status='pending_deletion' (will retry next cycle)

5. Insert vais_sync_events audit row
```

### 5.6 Error Handling

| Error | Action |
|-------|--------|
| VAIS LRO timeout (>600s) | Mark `failed`, increment retry_count |
| VAIS API 4xx | Mark `failed` with error message |
| VAIS API 5xx / transient | Mark `failed`, will retry next cycle |
| File too large (future gate) | Mark `excluded` |
| Supabase Storage download fail | Mark `failed`, retry |
| DataStore creation fails | Mark store `error`, document stays `pending` |
| Max retries reached | Mark `retry_exhausted` |

### 5.7 Work Discovery

The sync worker discovers pending work through the `claim_pending_vais_sync` and `claim_pending_vais_deletion` RPCs. These use `FOR UPDATE SKIP LOCKED` to avoid contention if multiple workers run.

New documents enter the pipeline when:
- The upload endpoint creates a `vais_documents` row with `sync_status = 'pending'`
- The delete endpoint sets `sync_status = 'pending_deletion'`

---

## 6. Implementation Plan

### Slice Order (dependencies flow downward)

1. **DB Migration** -- Create all `vais_*` tables, enums, RPCs, triggers, RLS policies
2. **VAIS config + types** -- `vais/config.py`, `vais/types.py`
3. **Store service** -- `vais/store_service.py` (DataStore + Engine creation)
4. **Schema service** -- `vais/schema_service.py` (metadata schema)
5. **Document service** -- `vais/document_service.py` (upload, delete, list)
6. **Search service** -- `vais/search_service.py` (CHUNKS mode search)
7. **Sync worker** -- `vais/sync_worker.py` + lifespan registration
8. **API routes** -- `api/vais.py` + router registration in main.py
9. **Search playground UI** -- Next.js page + proxy routes
10. **Upload UI** -- VAIS file manager page + server actions

### Key Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDDHHMMSS_create_vais_prototype.sql` | DB schema |
| `python-services/agent_api/vais/__init__.py` | Package init |
| `python-services/agent_api/vais/config.py` | VAIS configuration |
| `python-services/agent_api/vais/types.py` | Pydantic models + enums |
| `python-services/agent_api/vais/store_service.py` | DataStore + Engine lifecycle |
| `python-services/agent_api/vais/schema_service.py` | Metadata schema management |
| `python-services/agent_api/vais/document_service.py` | Document CRUD |
| `python-services/agent_api/vais/search_service.py` | CHUNKS mode search |
| `python-services/agent_api/vais/sync_worker.py` | Background sync worker |
| `python-services/agent_api/api/vais.py` | FastAPI router |
| `nextjs-app/app/(app)/projects/[projectId]/vais-search/page.tsx` | Search playground page |
| `nextjs-app/app/(app)/projects/[projectId]/vais-search/vais-search-playground.tsx` | Search UI component |
| `nextjs-app/app/(app)/projects/[projectId]/vais-files/page.tsx` | Upload UI page |
| `nextjs-app/app/actions/vais-files.ts` | VAIS server actions |
| `nextjs-app/app/api/vais-proxy/[...path]/route.ts` | Proxy to Python API |

### Key Files to Modify

| File | Change |
|------|--------|
| `python-services/agent_api/main.py` | Import + register vais router, start vais sync worker |
| `python-services/agent_api/api/__init__.py` | No change needed (routers imported directly in main.py) |
