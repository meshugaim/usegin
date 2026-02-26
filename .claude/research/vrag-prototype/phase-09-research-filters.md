# Phase 09 Research: Semantic Search Filter System

Research date: 2026-02-26
Source files:
- `python-services/agent_api/agent/file_search_tool.py` — MCP tool definition, parameter schema
- `python-services/agent_api/gfs_metadata.py` — metadata key definitions, field constructors
- `python-services/agent_api/agent/multi_store_query_service.py` — per-store filter application
- `python-services/agent_api/project_file_search_service.py` — file metadata set during upload
- `python-services/agent_api/email_sync_service.py` — email/attachment metadata set during upload
- `python-services/agent_api/drive_sync_service.py` — Drive file metadata set during upload

---

## 1. All Filter Keys by Entity Type

### entity_type = "file" (8 keys)

| Key | GFS Type | Python Type | Source | Example |
|-----|----------|-------------|--------|---------|
| `entity_type` | string_value | str | `file_fields()` — always `"file"` | `"file"` |
| `file_id` | string_value | str | `file_fields(file_id=...)` — UUID of the project_files row | `"a1b2c3d4-..."` |
| `filename` | string_value | str | `file_fields(filename=...)` — original filename | `"report.pdf"` |
| `file_extension` | string_value | str | Derived via `extract_file_extension(filename)` | `".pdf"` |
| `mime_type` | string_value | str | `file_fields(mime_type=...)` — detected or provided | `"application/pdf"` |
| `access_level` | string_value | str | `file_fields(access_level=...)` — `"internal"` or `"external"` | `"internal"` |
| `date_epoch` | numeric_value | float | `file_fields(date=...)` — `datetime.timestamp()` | `1704067200` |
| `size_bytes` | numeric_value | int | `file_fields(size_bytes=...)` — file size | `102400` |

### entity_type = "email" (14 keys)

| Key | GFS Type | Python Type | Source | Example |
|-----|----------|-------------|--------|---------|
| `entity_type` | string_value | str | `email_fields()` — always `"email"` | `"email"` |
| `email_id` | string_value | str | `email_fields(email_id=...)` — UUID of inbound_emails row | `"b2c3d4e5-..."` |
| `sender` | string_value | str | `email_fields(sender=...)` — full email address | `"alice@company.com"` |
| `sender_domain` | string_value | str | Derived via `extract_domain(sender)` | `"company.com"` |
| `date_epoch` | numeric_value | float | `email_fields(date=...)` — `datetime.timestamp()` | `1704067200` |
| `thread_id` | string_value | str | `email_fields(thread_id=...)` — email thread ID | `"thread-abc123"` |
| `recipients` | string_list_value | list[str] | Derived via `parse_addresses(to_header)` | `["bob@co.com", "carol@co.com"]` |
| `recipient_domains` | string_list_value | list[str] | Derived via `extract_domains(to_header)` | `["co.com"]` |
| `cc_addresses` | string_list_value | list[str] | Derived via `parse_addresses(cc_header)` | `["dave@co.com"]` |
| `subject` | string_value | str | `email_fields(subject=...)` — email subject line | `"Q4 Budget Review"` |
| `has_attachments` | numeric_value | int | `1` if `attachment_count > 0`, else `0` | `1` |
| `attachment_count` | numeric_value | int | `email_fields(attachment_count=...)` | `3` |
| `access_level` | string_value | str | `email_fields(access_level=...)` | `"internal"` |
| `is_reply` | numeric_value | int | `1` if `in_reply_to` is truthy, else omitted | `1` |

### entity_type = "email_attachment" (19 keys — 6 own + 13 inherited from parent email)

| Key | GFS Type | Python Type | Source | Example |
|-----|----------|-------------|--------|---------|
| **Own fields (6):** | | | | |
| `entity_type` | string_value | str | `attachment_fields()` — always `"attachment"` (note: stored as `"attachment"`, tool uses `"email_attachment"`) | `"attachment"` |
| `attachment_id` | string_value | str | `attachment_fields(attachment_id=...)` — UUID | `"c3d4e5f6-..."` |
| `filename` | string_value | str | `attachment_fields(filename=...)` — original filename | `"invoice.pdf"` |
| `file_extension` | string_value | str | Derived via `extract_file_extension(filename)` | `".pdf"` |
| `mime_type` | string_value | str | `attachment_fields(mime_type=...)` | `"application/pdf"` |
| `size_bytes` | numeric_value | int | `attachment_fields(size_bytes=...)` | `51200` |
| **Inherited email fields (13):** | | | | |
| `email_id` | string_value | str | Parent email UUID | `"b2c3d4e5-..."` |
| `sender` | string_value | str | Parent email sender | `"alice@company.com"` |
| `sender_domain` | string_value | str | Derived from parent sender | `"company.com"` |
| `date_epoch` | numeric_value | float | Parent email date | `1704067200` |
| `thread_id` | string_value | str | Parent email thread | `"thread-abc123"` |
| `recipients` | string_list_value | list[str] | Parent email To header | `["bob@co.com"]` |
| `recipient_domains` | string_list_value | list[str] | Parent email To domains | `["co.com"]` |
| `cc_addresses` | string_list_value | list[str] | Parent email CC | `["dave@co.com"]` |
| `subject` | string_value | str | Parent email subject | `"Q4 Budget Review"` |
| `has_attachments` | numeric_value | int | Parent email (always 1 for attachments) | `1` |
| `attachment_count` | numeric_value | int | Parent email attachment count | `3` |
| `access_level` | string_value | str | Inherited from parent email | `"internal"` |
| `is_reply` | numeric_value | int | Inherited from parent email | `1` |

---

## 2. AIP-160 Syntax

The `semantic_search` tool accepts filter expressions in AIP-160 syntax, passed as-is to the GFS `metadata_filter` parameter.

### Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equals | `sender = "alice@co.com"` |
| `!=` | Not equals | `access_level != "external"` |
| `>` | Greater than | `date_epoch > 1704067200` |
| `<` | Less than | `size_bytes < 1000000` |
| `>=` | Greater than or equal | `date_epoch >= 1704067200` |
| `<=` | Less than or equal | `attachment_count <= 5` |
| `AND` | Logical AND | `sender = "alice@co.com" AND date_epoch >= 1704067200` |
| `OR` | Logical OR | `sender = "alice@co.com" OR sender = "bob@co.com"` |

### Quoting Rules

- **String values must be double-quoted**: `sender = "alice@co.com"`
- **Numeric values are bare**: `date_epoch >= 1704067200`
- **Key names are bare** (no quotes on left side): `sender_domain = "company.com"`

### Examples from Tool Description

```
sender = "alice@company.com"
date_epoch >= 1704067200 AND sender_domain = "company.com"
file_extension = ".pdf"
```

### Important Limitation

From MEMORY.md: `ANY()` syntax does NOT work in GFS (it is Vertex AI Search only). Use `=` with `OR` instead.

---

## 3. How Filters Are Applied in GFS

### Store Architecture

The `MultiStoreQueryService` manages three categories of stores:

| Store category | Store attribute | Entity types stored | Content |
|---|---|---|---|
| `file_store_ids` | `file_store_ids` | `file` | Uploaded project files |
| `email_store_ids` | `email_store_ids` | `email` + `attachment` | Email bodies + email attachments (colocated) |
| `drive_store_ids` | `drive_store_ids` | `file` (with `entity_type="file"`) | Google Drive synced files |

### Entity Type -> Store Routing

When `entity_type` is specified, only relevant stores are queried:

| Tool-facing entity_type | Stores queried | Reason |
|---|---|---|
| `"file"` | `file_store_ids` + `drive_store_ids` | Drive files use `entity_type="file"` in metadata |
| `"email"` | `email_store_ids` | Emails live in email stores |
| `"email_attachment"` | `email_store_ids` | Attachments live alongside emails in email stores |
| `None` (omitted) | All stores | Search everything |
| `["email", "email_attachment"]` | `email_store_ids` (deduplicated) | Both types in same stores |
| `["file", "email"]` | `file_store_ids` + `drive_store_ids` + `email_store_ids` | Union of both store sets |

### Native GFS Metadata Filters vs Auto-Injected Filters

**Auto-injected filters** (handled by `_ENTITY_TYPE_FILTER_INJECTION`):

Since email stores hold both emails AND attachments, the service auto-injects an `entity_type` filter to disambiguate:

| Tool-facing entity_type | Auto-injected GFS filter | Reason |
|---|---|---|
| `"email"` | `entity_type = "email"` | Only return emails, not attachments |
| `"email_attachment"` | `entity_type = "attachment"` | Only return attachments, not emails |
| `"file"` | *(none)* | File stores only contain files, no ambiguity |
| `None` | *(none)* | Search everything, no filtering needed |

**Important**: The stored GFS value for attachments is `"attachment"` (not `"email_attachment"`). The tool-facing name differs from the stored metadata value. This mapping is internal to `_ENTITY_TYPE_FILTER_INJECTION`.

### Filter Combination Logic

The `_build_metadata_filter` and `_build_store_filter_map` methods combine auto-injected and user-provided filters:

```
Final filter = injection AND (user_filter)
```

Parentheses around user_filter preserve precedence. Examples:

| entity_type | user filter | Final GFS filter |
|---|---|---|
| `"email"` | `None` | `entity_type = "email"` |
| `"email"` | `sender = "alice@co.com"` | `entity_type = "email" AND (sender = "alice@co.com")` |
| `"file"` | `org_id = "org-1"` | `org_id = "org-1"` |
| `"file"` | `None` | `None` |
| `None` | `None` | `None` |
| `["email", "email_attachment"]` | `None` | `(entity_type = "email" OR entity_type = "attachment")` (for email stores) |
| `["email", "file"]` | `date >= 100` | email stores: `entity_type = "email" AND (date >= 100)`, file stores: `date >= 100` |

### What Happens When a Filter Key Doesn't Exist

From the tool description: "If a filter key doesn't exist on an entity type, that entity type returns no results." This is native GFS behavior -- filtering on a metadata key that doesn't exist on a document causes that document to be excluded from results. The tool warns the model about this to prevent confusion.

### Parallel Query Execution

All stores are queried in parallel using `ThreadPoolExecutor`. Each store gets its own filter from the per-store filter map. Results are merged (answers concatenated, chunks combined).

---

## 4. Metadata Set During Upload

### File Upload (`project_file_search_service.py` + `drive_sync_service.py`)

Both direct file uploads and Google Drive synced files use `file_fields()`:

```python
metadata = to_custom_metadata(
    file_fields(
        file_id=file_id,          # UUID from project_files or drive_files table
        filename=filename,         # Original filename
        mime_type=mime_type,       # Detected or provided MIME type
        access_level=access_level, # "internal" or "external"
        date=date,                 # datetime (drive: updated_at, files: upload time)
        size_bytes=size_bytes,     # File size in bytes
    )
)
```

This produces 8 GFS CustomMetadata entries (skipping Nones): `entity_type`, `file_id`, `filename`, `file_extension`, `mime_type`, `access_level`, `date_epoch`, `size_bytes`.

### Email Upload (`email_sync_service.py`)

```python
metadata = to_custom_metadata(
    email_fields(
        email_id=email_id,
        sender=sender,
        date=date,
        thread_id=thread_id,
        to_header=to_header,
        cc_header=cc_header,
        subject=subject,
        attachment_count=attachment_count,
        access_level=access_level,
        in_reply_to=in_reply_to,
    )
)
```

This produces up to 14 GFS CustomMetadata entries.

### Email Attachment Upload (`email_sync_service.py`)

```python
metadata = to_custom_metadata(
    attachment_fields(
        attachment_id=attachment_id,
        filename=filename,
        mime_type=mime_type,
        size_bytes=size_bytes,
        email_id=inbound_email_id,
        sender=sender,
        date=date,
        thread_id=thread_id,
        to_header=to_header,
        cc_header=cc_header,
        subject=subject,
        attachment_count=attachment_count,
        access_level=access_level,
        in_reply_to=in_reply_to,
    )
)
```

This produces up to 19 GFS CustomMetadata entries (6 own + 13 inherited from parent email).

---

## 5. Mapping to Supabase Columns on `vrag_prototype.files`

### Existing columns (from migration `20260226112339`)

| Column | Type | Maps to filter key | Notes |
|---|---|---|---|
| `id` | UUID PK | `file_id` / `email_id` / `attachment_id` | Single ID column for all entity types |
| `project_id` | UUID FK | *(not a filter key)* | Scoping, not exposed to tool |
| `filename` | TEXT | `filename` | Already exists |
| `entity_type` | TEXT | `entity_type` | Already exists, CHECK constraint |
| `access_level` | TEXT | `access_level` | Already exists, CHECK constraint |
| `current_version_id` | UUID FK | *(not a filter key)* | Version tracking |
| `sync_status` | ENUM | *(not a filter key)* | Sync state |

### New columns needed

These are all the filter keys from the tool that are NOT already covered by existing columns:

| Filter key | Proposed column | Type | Nullable | Entity types | Notes |
|---|---|---|---|---|---|
| `file_extension` | `file_extension` | TEXT | YES | file, email_attachment | Derived from filename; store materialized to avoid re-deriving at query time |
| `mime_type` | `mime_type` | TEXT | YES | file, email_attachment | MIME type of the file content |
| `size_bytes` | *(exists on file_versions)* | BIGINT | YES | all | Already on `file_versions.size_bytes`; consider denormalizing to `files` |
| `date_epoch` | `date_epoch` | DOUBLE PRECISION | YES | all | Unix timestamp of upload/email date |
| `sender` | `sender` | TEXT | YES | email, email_attachment | Full email address |
| `sender_domain` | `sender_domain` | TEXT | YES | email, email_attachment | Derived from sender; materialize for filter efficiency |
| `thread_id` | `thread_id` | TEXT | YES | email, email_attachment | Email thread ID |
| `recipients` | `recipients` | TEXT[] | YES | email, email_attachment | Parsed To: addresses |
| `recipient_domains` | `recipient_domains` | TEXT[] | YES | email, email_attachment | Parsed To: domains |
| `cc_addresses` | `cc_addresses` | TEXT[] | YES | email, email_attachment | Parsed CC: addresses |
| `subject` | `subject` | TEXT | YES | email, email_attachment | Email subject line |
| `has_attachments` | `has_attachments` | BOOLEAN | YES | email, email_attachment | True if attachment_count > 0 |
| `attachment_count` | `attachment_count` | INTEGER | YES | email, email_attachment | Number of attachments on parent email |
| `is_reply` | `is_reply` | BOOLEAN | YES | email, email_attachment | True if email has In-Reply-To header |
| `email_id` | `parent_email_id` | UUID | YES | email_attachment | FK to parent email's files row (for attachments); for emails, `id` itself is the email_id |
| `attachment_id` | *(use `id`)* | UUID | — | email_attachment | The row's own `id` serves as attachment_id |

### Recommended approach

**Option A: Denormalized columns (recommended for VRAG prototype)**

Add all metadata as direct columns on `vrag_prototype.files`. This is the simplest approach for a prototype:
- Enables native PostgreSQL `WHERE` clauses that mirror AIP-160 filter semantics
- No JSONB path queries needed
- Index-friendly for common filter patterns (sender, date_epoch, file_extension)
- Entity-type-specific columns are simply NULL for non-applicable entity types (mirrors GFS behavior where missing keys = no match)

**Option B: JSONB metadata column**

A single `metadata JSONB` column could hold all entity-specific fields. Simpler schema but:
- Harder to index efficiently
- GIN index on JSONB doesn't help for range queries (date_epoch >=)
- AIP-160 -> JSONB query translation is more complex

**Recommendation**: Option A. The column count (15 new) is manageable, and filter translation from AIP-160 to SQL WHERE clauses is straightforward with direct columns.

### Type mapping notes

- GFS `numeric_value` for booleans (`has_attachments`, `is_reply`): In GFS these are stored as `1`/`0` (numeric) because GFS has no boolean type. In Supabase, use native `BOOLEAN`. The filter translation layer should map `has_attachments = 1` -> `has_attachments = true`.
- GFS `string_list_value` (`recipients`, `recipient_domains`, `cc_addresses`): In GFS these are `StringList`. In Supabase, use `TEXT[]` arrays. Filter translation should map `recipients = "bob@co.com"` -> `'bob@co.com' = ANY(recipients)`.
- `date_epoch` is a Unix timestamp (float). Keep as `DOUBLE PRECISION` in Supabase to avoid precision loss. The filter `date_epoch >= 1704067200` maps directly to SQL.
