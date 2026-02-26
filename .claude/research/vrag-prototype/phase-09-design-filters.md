# Phase 09: AIP-160 Filter System Design

**Date:** 2026-02-26
**Depends on:** phase-09-research-filters.md
**Status:** Design complete

---

## Overview

Add full AIP-160 metadata filter support to the VRAG prototype. Today the search service has a bare-bones `filename:` / `rag_file_id:` filter. This design replaces it with a proper AIP-160 expression parser that translates to Supabase `WHERE` clauses, powered by new metadata columns on `vrag_prototype.files`.

---

## 1. DB Schema Addition (Migration)

New migration: `supabase/migrations/<timestamp>_vrag_filter_columns.sql`

### 1.1 New Columns on `vrag_prototype.files`

All columns are nullable. Entity-type-specific columns are simply NULL for non-applicable entity types (mirrors GFS behavior where missing metadata keys exclude documents from results).

```sql
ALTER TABLE vrag_prototype.files
    -- File metadata (entity_type = 'file' and 'email_attachment')
    ADD COLUMN file_extension      TEXT,
    ADD COLUMN mime_type            TEXT,
    ADD COLUMN size_bytes           BIGINT,
    ADD COLUMN date_epoch           DOUBLE PRECISION,

    -- Email metadata (entity_type = 'email' and 'email_attachment')
    ADD COLUMN sender               TEXT,
    ADD COLUMN sender_domain         TEXT,
    ADD COLUMN thread_id             TEXT,
    ADD COLUMN recipients            TEXT[],
    ADD COLUMN recipient_domains     TEXT[],
    ADD COLUMN cc_addresses          TEXT[],
    ADD COLUMN subject               TEXT,
    ADD COLUMN has_attachments       BOOLEAN,
    ADD COLUMN attachment_count      INTEGER,
    ADD COLUMN is_reply              BOOLEAN,

    -- Attachment metadata (entity_type = 'email_attachment' only)
    ADD COLUMN parent_email_id       UUID;
```

**Total: 15 new columns.**

### 1.2 Column Mapping to Filter Keys

| AIP-160 Filter Key | Column | Type | Notes |
|---|---|---|---|
| `file_id` | `id` | UUID | Already exists; row's own PK for files |
| `email_id` | `id` (emails) / `parent_email_id` (attachments) | UUID | Per-entity-type column mapping. For emails, resolves to `id`. For attachments, resolves to `parent_email_id`. Matches GFS where `email_id` is metadata on both entity types. |
| `attachment_id` | `id` | UUID | Row's own PK for attachments |
| `filename` | `filename` | TEXT | Already exists |
| `file_extension` | `file_extension` | TEXT | NEW. Derived from filename at upload time. |
| `mime_type` | `mime_type` | TEXT | NEW |
| `size_bytes` | `size_bytes` | BIGINT | NEW (denormalized from `file_versions`) |
| `date_epoch` | `date_epoch` | DOUBLE PRECISION | NEW. Unix timestamp. |
| `entity_type` | `entity_type` | TEXT | Already exists |
| `access_level` | `access_level` | TEXT | Already exists |
| `sender` | `sender` | TEXT | NEW |
| `sender_domain` | `sender_domain` | TEXT | NEW. Derived from `sender`. |
| `thread_id` | `thread_id` | TEXT | NEW |
| `recipients` | `recipients` | TEXT[] | NEW |
| `recipient_domains` | `recipient_domains` | TEXT[] | NEW |
| `cc_addresses` | `cc_addresses` | TEXT[] | NEW |
| `subject` | `subject` | TEXT | NEW |
| `has_attachments` | `has_attachments` | BOOLEAN | NEW. GFS stores as 1/0; Supabase native BOOLEAN. |
| `attachment_count` | `attachment_count` | INTEGER | NEW |
| `is_reply` | `is_reply` | BOOLEAN | NEW. GFS stores as 1/0; Supabase native BOOLEAN. |
| `parent_email_id` | `parent_email_id` | UUID | NEW. Attachment -> parent email FK. |

### 1.3 Indexes

```sql
-- Common filter patterns
CREATE INDEX idx_vrag_files_sender ON vrag_prototype.files(sender)
    WHERE deleted_at IS NULL AND sender IS NOT NULL;

CREATE INDEX idx_vrag_files_date_epoch ON vrag_prototype.files(date_epoch)
    WHERE deleted_at IS NULL AND date_epoch IS NOT NULL;

CREATE INDEX idx_vrag_files_mime_type ON vrag_prototype.files(mime_type)
    WHERE deleted_at IS NULL AND mime_type IS NOT NULL;

CREATE INDEX idx_vrag_files_file_extension ON vrag_prototype.files(file_extension)
    WHERE deleted_at IS NULL AND file_extension IS NOT NULL;

CREATE INDEX idx_vrag_files_subject ON vrag_prototype.files USING gin (subject gin_trgm_ops)
    WHERE deleted_at IS NULL AND subject IS NOT NULL;

CREATE INDEX idx_vrag_files_parent_email ON vrag_prototype.files(parent_email_id)
    WHERE deleted_at IS NULL AND parent_email_id IS NOT NULL;
```

**Note:** The `gin_trgm_ops` index on `subject` enables efficient `ILIKE` substring search. Requires `pg_trgm` extension (already enabled in most Supabase instances). If not available, skip this index — `ILIKE` will still work, just with a sequential scan on filtered results.

### 1.4 Type Mapping Decisions

| GFS Concept | Supabase Column Type | Translation Notes |
|---|---|---|
| `numeric_value` 1/0 for booleans | `BOOLEAN` | Parser maps `has_attachments = 1` -> `has_attachments = true` |
| `string_list_value` (recipients, etc.) | `TEXT[]` | Parser maps `recipients = "bob@co.com"` -> `'bob@co.com' = ANY(recipients)` |
| `date_epoch` (float timestamp) | `DOUBLE PRECISION` | Direct numeric comparison, no conversion needed |

---

## 2. AIP-160 Parser (`python-services/agent_api/vrag/aip160_parser.py`)

### 2.1 Design Goals

- Parse AIP-160 filter strings like `sender = "alice@co.com" AND date_epoch >= 1704067200`
- Return structured clauses that `apply_filters()` can translate to Supabase query builder calls
- Keep it simple: regex tokenizer + iterative parse. No external parsing library.
- Good error messages: tell the user what went wrong and where.

### 2.2 Data Structures

```python
from dataclasses import dataclass
from typing import Literal

Operator = Literal["=", "!=", ">", "<", ">=", "<="]
LogicalOp = Literal["AND", "OR"]


@dataclass
class Comparison:
    """A single comparison: key op value."""
    key: str
    op: Operator
    value: str | float | int  # str for quoted strings, number for bare numerics


@dataclass
class FilterExpression:
    """A parsed filter: list of comparisons joined by logical operators.

    For N comparisons, there are N-1 logical operators.
    comparisons[0] logic_ops[0] comparisons[1] logic_ops[1] comparisons[2] ...

    Empty comparisons list = no filter.
    """
    comparisons: list[Comparison]
    logic_ops: list[LogicalOp]  # len = len(comparisons) - 1
```

### 2.3 Tokenizer

Regex-based. Tokens:

| Token | Regex | Examples |
|---|---|---|
| KEY | `[a-z_][a-z0-9_]*` | `sender`, `date_epoch`, `file_extension` |
| OP | `>=\|<=\|!=\|>\|<\|=` | `=`, `>=`, `!=` |
| STRING | `"[^"]*"` | `"alice@co.com"`, `".pdf"` |
| NUMBER | `-?[0-9]+(\.[0-9]+)?` | `1704067200`, `0`, `-1` |
| LOGIC | `AND\|OR` (case-insensitive) | `AND`, `or` |
| WHITESPACE | `\s+` | (skipped) |

```python
import re

_TOKEN_PATTERN = re.compile(
    r"""
    (?P<STRING>"[^"]*")          |  # Quoted string
    (?P<OP>>=|<=|!=|>|<|=)       |  # Comparison operator
    (?P<LOGIC>\bAND\b|\bOR\b)    |  # Logical operator (case-insensitive)
    (?P<NUMBER>-?\d+(?:\.\d+)?)  |  # Numeric literal
    (?P<KEY>[a-z_][a-z0-9_]*)    |  # Key identifier
    (?P<WS>\s+)                     # Whitespace (skipped)
    """,
    re.VERBOSE | re.IGNORECASE,
)
```

### 2.4 Parse Algorithm

Iterative: expect `KEY OP VALUE` triples, optionally joined by `AND`/`OR`.

```
parse(tokens):
    comparisons = []
    logic_ops = []

    loop:
        expect KEY token -> key
        expect OP token -> op
        expect STRING or NUMBER token -> value
        append Comparison(key, op, value) to comparisons

        if next token is LOGIC:
            consume it -> logic_op
            append logic_op to logic_ops
            continue loop
        else:
            break (end of expression or error)

    if tokens remain: raise ParseError with position info

    return FilterExpression(comparisons, logic_ops)
```

### 2.5 Error Handling

```python
class AIP160ParseError(ValueError):
    """Raised when an AIP-160 filter string cannot be parsed.

    Attributes:
        position: character offset in the original string where the error occurred
        detail: human-readable explanation
    """
    def __init__(self, detail: str, position: int | None = None):
        self.detail = detail
        self.position = position
        msg = f"Filter parse error: {detail}"
        if position is not None:
            msg += f" (at position {position})"
        super().__init__(msg)
```

### 2.6 Public API

```python
def parse_aip160(filter_string: str) -> FilterExpression:
    """Parse an AIP-160 filter expression string.

    Args:
        filter_string: e.g. 'sender = "alice@co.com" AND date_epoch >= 1704067200'

    Returns:
        FilterExpression with parsed comparisons and logic operators.

    Raises:
        AIP160ParseError: If the filter string is syntactically invalid.
    """
```

### 2.7 Examples

| Input | Parsed |
|---|---|
| `sender = "alice@co.com"` | `[Comparison("sender", "=", "alice@co.com")]`, `[]` |
| `date_epoch >= 1704067200` | `[Comparison("date_epoch", ">=", 1704067200)]`, `[]` |
| `sender = "alice@co.com" AND date_epoch >= 1704067200` | `[Comparison("sender", "=", "alice@co.com"), Comparison("date_epoch", ">=", 1704067200)]`, `["AND"]` |
| `sender = "alice" OR sender = "bob"` | `[Comparison("sender", "=", "alice"), Comparison("sender", "=", "bob")]`, `["OR"]` |
| `file_extension = ".pdf"` | `[Comparison("file_extension", "=", ".pdf")]`, `[]` |
| `has_attachments = 1` | `[Comparison("has_attachments", "=", 1)]`, `[]` |

---

## 3. Filter-to-Supabase Query Builder (`apply_filters()`)

### 3.1 Location

New function in `python-services/agent_api/vrag/aip160_parser.py` (same module as the parser — keeps filter logic together).

### 3.2 Key-to-Column Registry

```python
from dataclasses import dataclass
from typing import Literal

ColumnType = Literal["text", "numeric", "boolean", "text_array", "uuid"]


@dataclass
class FilterKeyDef:
    """Definition of a valid filter key."""
    column: str | dict[str, str]      # Supabase column name, or per-entity-type mapping
    column_type: ColumnType           # For type coercion and operator validation
    entity_types: frozenset[str]      # Which entity_types this key is valid for


# Registry of all valid filter keys
FILTER_KEYS: dict[str, FilterKeyDef] = {
    # Universal
    "entity_type":       FilterKeyDef("entity_type",       "text",       frozenset({"file", "email", "email_attachment"})),
    "access_level":      FilterKeyDef("access_level",      "text",       frozenset({"file", "email", "email_attachment"})),
    "filename":          FilterKeyDef("filename",           "text",       frozenset({"file", "email_attachment"})),
    "date_epoch":        FilterKeyDef("date_epoch",         "numeric",    frozenset({"file", "email", "email_attachment"})),
    "size_bytes":        FilterKeyDef("size_bytes",         "numeric",    frozenset({"file", "email_attachment"})),

    # File-specific
    "file_id":           FilterKeyDef("id",                 "uuid",       frozenset({"file"})),
    "file_extension":    FilterKeyDef("file_extension",     "text",       frozenset({"file", "email_attachment"})),
    "mime_type":         FilterKeyDef("mime_type",          "text",       frozenset({"file", "email_attachment"})),

    # Email-specific (email_id resolves to different columns per entity type)
    "email_id":          FilterKeyDef({"email": "id", "email_attachment": "parent_email_id"}, "uuid", frozenset({"email", "email_attachment"})),
    "sender":            FilterKeyDef("sender",             "text",       frozenset({"email", "email_attachment"})),
    "sender_domain":     FilterKeyDef("sender_domain",      "text",       frozenset({"email", "email_attachment"})),
    "thread_id":         FilterKeyDef("thread_id",          "text",       frozenset({"email", "email_attachment"})),
    "recipients":        FilterKeyDef("recipients",         "text_array", frozenset({"email", "email_attachment"})),
    "recipient_domains": FilterKeyDef("recipient_domains",  "text_array", frozenset({"email", "email_attachment"})),
    "cc_addresses":      FilterKeyDef("cc_addresses",       "text_array", frozenset({"email", "email_attachment"})),
    "subject":           FilterKeyDef("subject",            "text",       frozenset({"email", "email_attachment"})),
    "has_attachments":   FilterKeyDef("has_attachments",    "boolean",    frozenset({"email", "email_attachment"})),
    "attachment_count":  FilterKeyDef("attachment_count",    "numeric",    frozenset({"email", "email_attachment"})),
    "is_reply":          FilterKeyDef("is_reply",           "boolean",    frozenset({"email", "email_attachment"})),

    # Attachment-specific
    "attachment_id":     FilterKeyDef("id",                 "uuid",       frozenset({"email_attachment"})),
    "parent_email_id":   FilterKeyDef("parent_email_id",    "uuid",       frozenset({"email_attachment"})),
}
```

### 3.3 Operator-to-Supabase Method Mapping

| AIP-160 Op | Column Type | Supabase Method | Notes |
|---|---|---|---|
| `=` | `text` | `.eq(col, val)` | Exact match |
| `=` | `numeric` | `.eq(col, val)` | Exact match |
| `=` | `boolean` | `.eq(col, bool(val))` | Coerce `1`->`true`, `0`->`false` |
| `=` | `text_array` | `.contains(col, [val])` | `val = ANY(col)` semantics |
| `=` | `uuid` | `.eq(col, val)` | Exact match |
| `!=` | `text` | `.neq(col, val)` | |
| `!=` | `boolean` | `.neq(col, bool(val))` | |
| `!=` | `text_array` | `.not_.contains(col, [val])` | Negated containment |
| `>` | `numeric` | `.gt(col, val)` | |
| `>=` | `numeric` | `.gte(col, val)` | |
| `<` | `numeric` | `.lt(col, val)` | |
| `<=` | `numeric` | `.lte(col, val)` | |

**Invalid combinations** (raise `AIP160FilterError`):
- Range operators (`>`, `<`, `>=`, `<=`) on `text`, `boolean`, or `text_array` columns
- Range operators on `uuid` columns

### 3.4 Boolean Coercion

GFS has no boolean type — booleans are stored as `numeric_value` 1/0. Users write `has_attachments = 1`. The filter layer must coerce:

```python
def _coerce_boolean(value: str | float | int) -> bool:
    """Coerce a filter value to boolean for boolean columns.

    Accepts: 1, 1.0, "1", "true" -> True
             0, 0.0, "0", "false" -> False
    Raises AIP160FilterError for other values.
    """
```

### 3.5 Array Containment

For `TEXT[]` columns (`recipients`, `recipient_domains`, `cc_addresses`), the AIP-160 expression `recipients = "bob@co.com"` means "bob@co.com is in the recipients array". Translation:

```python
# Supabase PostgREST: .contains(col, [val]) -> col @> ARRAY[val]
q = q.contains("recipients", ["bob@co.com"])
```

For `!=` on arrays: `.not_.contains(col, [val])` -> `NOT (col @> ARRAY[val])`.

### 3.6 AND/OR Logic

AIP-160 supports `AND` and `OR` but not parentheses (v1). Evaluation is left-to-right with no precedence (i.e., `A AND B OR C` = `(A AND B) OR C`).

**Supabase query builder approach:**

- **All AND**: Chain `.eq()` / `.gt()` / etc. calls sequentially on the query builder. Each call adds an implicit AND.
- **All OR**: Use `.or_()` with a comma-separated PostgREST filter string.
- **Mixed AND/OR**: Group consecutive AND-connected clauses, then combine OR groups with `.or_()`.

Implementation strategy — build a PostgREST filter string for the `or_()` method:

```python
def apply_filters(
    query,  # Supabase query builder
    expression: FilterExpression,
    entity_type: str | None = None,
) -> query:
    """Apply parsed AIP-160 filter expression to a Supabase query builder.

    Args:
        query: A Supabase query builder (from .from_("files").select(...))
        expression: Parsed FilterExpression from parse_aip160()
        entity_type: If set, validate that all filter keys are valid for this entity_type.
                     If None, skip entity_type validation (search across all types).

    Returns:
        Modified query builder with filter clauses applied.

    Raises:
        AIP160FilterError: If a filter key is invalid or an operator/type combination
                           is not supported.
    """
```

**AND-only fast path:** When all logic ops are AND, simply chain Supabase query builder methods:

```python
for comp in expression.comparisons:
    query = _apply_comparison(query, comp)
return query
```

**Mixed AND/OR path:** Build PostgREST filter string segments:

```python
# Group by OR boundaries: split comparisons into AND-groups separated by OR
# Each AND-group becomes a PostgREST "and(clause1,clause2,...)" segment
# OR-connected groups are combined with "or(group1,group2,...)"

# PostgREST filter syntax:
#   eq.value       -> column = value
#   neq.value      -> column != value
#   gt.value       -> column > value
#   gte.value      -> column >= value
#   lt.value       -> column < value
#   lte.value      -> column <= value
#   cs.{val}       -> column @> ARRAY[val]  (contains)
```

Example: `sender = "alice" OR sender = "bob"` ->

```python
query = query.or_("sender.eq.alice,sender.eq.bob")
```

Example: `sender = "alice" AND date_epoch >= 100 OR sender = "bob"` ->

```python
# Group 1 (AND): sender = "alice" AND date_epoch >= 100
# Group 2: sender = "bob"
query = query.or_(
    "and(sender.eq.alice,date_epoch.gte.100),sender.eq.bob"
)
```

### 3.7 Column Resolution

Some filter keys map to different columns depending on the entity type. For example, `email_id` maps to `id` for emails but `parent_email_id` for attachments. When `FilterKeyDef.column` is a `dict`, resolve it using the current `entity_type`:

```python
def _resolve_column(key_def: FilterKeyDef, entity_type: str | None) -> str:
    """Resolve the actual column name for a filter key.

    Args:
        key_def: The filter key definition.
        entity_type: The entity type context (may be None for cross-type searches).

    Returns:
        The resolved column name string.

    Raises:
        AIP160FilterError: If column is a dict and entity_type is None or not in the mapping.
    """
    if isinstance(key_def.column, str):
        return key_def.column

    # column is a per-entity-type dict — entity_type is required to resolve
    if entity_type is None:
        raise AIP160FilterError(
            f"Filter key '{key_def.column}' requires entity_type to resolve column. "
            f"Specify entity_type as one of: {', '.join(sorted(key_def.column.keys()))}"
        )
    if entity_type not in key_def.column:
        raise AIP160FilterError(
            f"Filter key has no column mapping for entity_type '{entity_type}'. "
            f"Valid entity types: {', '.join(sorted(key_def.column.keys()))}"
        )
    return key_def.column[entity_type]
```

This is called inside `_apply_comparison()` (and the PostgREST string builder for OR paths) to get the actual column name before building the query clause.

### 3.8 Entity-Type Validation

When `entity_type` is specified in the search request, validate that all filter keys are applicable:

```python
if entity_type:
    for comp in expression.comparisons:
        key_def = FILTER_KEYS.get(comp.key)
        if key_def and entity_type not in key_def.entity_types:
            raise AIP160FilterError(
                f"Filter key '{comp.key}' is not valid for entity_type '{entity_type}'. "
                f"Valid entity types: {', '.join(sorted(key_def.entity_types))}"
            )
```

When `entity_type` is None (search across all types), skip this validation — the filter will naturally return no results for entity types where the column is NULL (matching GFS behavior).

### 3.9 Error Type

```python
class AIP160FilterError(ValueError):
    """Raised when a parsed filter cannot be applied.

    Distinct from AIP160ParseError (syntax error) — this is a semantic error
    (valid syntax but invalid key, operator, or type combination).
    """
```

---

## 4. Search Service Integration

### 4.1 Changes to `search_service.py`

Replace the current `parse_filter()` function and its usage with the new AIP-160 parser:

```python
# Before (current code):
from agent_api.vrag.search_service import parse_filter
# ...
if filter:
    for col, value in parse_filter(filter):
        if col == "filename":
            q = q.ilike("filename", f"%{value}%")
        elif col == "rag_file_id":
            q = q.eq("rag_file_id", value)

# After:
from agent_api.vrag.aip160_parser import parse_aip160, apply_filters, AIP160ParseError, AIP160FilterError
# ...
if filter:
    try:
        expression = parse_aip160(filter)
        q = apply_filters(q, expression, entity_type=entity_type)
    except (AIP160ParseError, AIP160FilterError) as e:
        return {"chunks": [], "rag_file_ids_used": [], "error": str(e)}
```

### 4.2 Backward Compatibility

The old `filename:substring` and `rag_file_id:id` syntaxes are NOT preserved. The new AIP-160 syntax replaces them:

| Old syntax | New AIP-160 equivalent |
|---|---|
| `filename:report` | `filename = "report"` (exact) or use the query text for semantic search |
| `rag_file_id:123` | Not exposed as a filter key (rag_file_id is internal). Use `file_id = "uuid"` instead. |

This is acceptable because the VRAG prototype is admin-only and has no production users relying on the old syntax.

### 4.3 Error Responses

Filter errors return a successful HTTP response with `error` in the body (not a 400). This matches the existing pattern:

```json
{
    "success": true,
    "chunks": [],
    "rag_file_ids_used": [],
    "error": "Filter parse error: Expected operator after key 'sender' (at position 7)"
}
```

---

## 5. Upload Metadata Population

### 5.1 Upload Endpoint Changes

Extend the `POST /vrag/upload` endpoint to accept optional metadata fields as form data. The file upload already uses `multipart/form-data`, so additional fields are simply more form fields.

**New optional Form parameters on the upload route:**

```python
@router.post("/upload", response_model=VragUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    entity_type: str = Form(default="file"),
    access_level: str = Form(default="internal"),
    # --- New optional metadata fields ---
    mime_type: str | None = Form(default=None),
    date_epoch: float | None = Form(default=None),
    sender: str | None = Form(default=None),
    subject: str | None = Form(default=None),
    thread_id: str | None = Form(default=None),
    recipients: str | None = Form(default=None),        # Comma-separated email addresses
    cc_addresses: str | None = Form(default=None),       # Comma-separated email addresses
    has_attachments: bool | None = Form(default=None),
    attachment_count: int | None = Form(default=None),
    is_reply: bool | None = Form(default=None),
    parent_email_id: str | None = Form(default=None),    # UUID string
):
```

**Derived fields** (computed at upload, not passed by caller):
- `file_extension` — derived from `filename` using `pathlib.PurePosixPath(filename).suffix`
- `sender_domain` — derived from `sender` using `sender.rsplit("@", 1)[1]`
- `recipient_domains` — derived from `recipients` by extracting domains
- `size_bytes` — already known from `len(content)`, now denormalized to `files` table too

### 5.2 Metadata Storage

In the upload handler, after creating/finding the file record, update it with metadata:

```python
# Build metadata dict (only include non-None values)
metadata_update: dict = {}
if mime_type:
    metadata_update["mime_type"] = mime_type
if file_extension:
    metadata_update["file_extension"] = file_extension
if date_epoch is not None:
    metadata_update["date_epoch"] = date_epoch
if sender:
    metadata_update["sender"] = sender
    domain = sender.rsplit("@", 1)[1] if "@" in sender else None
    if domain:
        metadata_update["sender_domain"] = domain
if subject:
    metadata_update["subject"] = subject
# ... etc for all fields

# Parse comma-separated arrays
if recipients:
    addr_list = [a.strip() for a in recipients.split(",") if a.strip()]
    metadata_update["recipients"] = addr_list
    metadata_update["recipient_domains"] = list({
        a.rsplit("@", 1)[1] for a in addr_list if "@" in a
    })

# Always set size_bytes from the file content
metadata_update["size_bytes"] = len(content)

# Always derive file_extension from filename
ext = PurePosixPath(filename).suffix
if ext:
    metadata_update["file_extension"] = ext

# Update file record with metadata
if metadata_update:
    supabase.schema("vrag_prototype").from_("files").update(
        metadata_update
    ).eq("id", file_id).execute()
```

### 5.3 Sync Worker — No Changes

The sync worker downloads from storage and uploads to Vertex RAG. It does not need to know about metadata columns — those are set at upload time on the `files` table and are only read at search time by the pre-filter query.

---

## 6. UI Updates

### 6.1 Search Panel — Filter Help

Update `vrag-ui/components/rag-search-panel.tsx`:

**a) Update the filter input placeholder:**

```tsx
// Before:
placeholder='e.g. "semantic" or "filename:semantic" or "rag_file_id:123"'

// After:
placeholder='e.g. sender = "alice@co.com" AND date_epoch >= 1704067200'
```

**b) Add a collapsible filter help section** below the filter input:

```tsx
<details className="mt-1">
    <summary className="text-xs text-zinc-400 dark:text-zinc-500 cursor-pointer
                         hover:text-zinc-600 dark:hover:text-zinc-300">
        Filter syntax help
    </summary>
    <div className="mt-2 p-3 rounded-md bg-zinc-50 dark:bg-zinc-800
                    text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
        <p><strong>Syntax:</strong> <code>key op value</code> joined by
           <code>AND</code> / <code>OR</code></p>
        <p><strong>Operators:</strong> <code>=</code> <code>!=</code>
           <code>&gt;</code> <code>&lt;</code> <code>&gt;=</code>
           <code>&lt;=</code></p>
        <p><strong>File keys:</strong> <code>filename</code>,
           <code>file_extension</code>, <code>mime_type</code>,
           <code>size_bytes</code>, <code>date_epoch</code></p>
        <p><strong>Email keys:</strong> <code>sender</code>,
           <code>sender_domain</code>, <code>subject</code>,
           <code>recipients</code>, <code>thread_id</code>,
           <code>has_attachments</code>, <code>attachment_count</code>,
           <code>is_reply</code></p>
        <p><strong>Examples:</strong></p>
        <ul className="list-disc pl-4 space-y-0.5">
            <li><code>file_extension = ".pdf"</code></li>
            <li><code>sender = "alice@co.com" AND date_epoch &gt;= 1704067200</code></li>
            <li><code>has_attachments = 1 AND sender_domain = "company.com"</code></li>
            <li><code>sender = "alice" OR sender = "bob"</code></li>
        </ul>
    </div>
</details>
```

### 6.2 File Upload Form — Metadata Fields

Update `vrag-ui/components/rag-file-manager.tsx` to show additional metadata inputs that are context-sensitive based on the selected `entity_type`.

**When entity_type = "email":** Show `sender`, `subject`, `date_epoch`, `thread_id`, `recipients`, `cc_addresses`, `has_attachments`, `attachment_count`, `is_reply`.

**When entity_type = "email_attachment":** Show all email fields plus `parent_email_id`.

**When entity_type = "file":** Show `mime_type`, `date_epoch` only (file_extension and size_bytes are auto-derived).

These fields are optional — the form works fine without them. They are collapsed by default in an "Additional metadata" expandable section to keep the UI clean.

```tsx
{/* Additional metadata (collapsed by default) */}
<details className="mt-2">
    <summary className="text-xs text-zinc-400 cursor-pointer">
        Additional metadata
    </summary>
    <div className="mt-2 grid grid-cols-2 gap-3">
        {/* Common fields */}
        <Input label="MIME Type" name="mime_type" placeholder="application/pdf" />
        <Input label="Date (epoch)" name="date_epoch" type="number" placeholder="1704067200" />

        {/* Email-specific fields (shown when entity_type is email or email_attachment) */}
        {(entityType === "email" || entityType === "email_attachment") && (
            <>
                <Input label="Sender" name="sender" placeholder="alice@company.com" />
                <Input label="Subject" name="subject" placeholder="Q4 Budget Review" />
                <Input label="Recipients" name="recipients" placeholder="bob@co.com, carol@co.com" />
                <Input label="CC" name="cc_addresses" placeholder="dave@co.com" />
                <Input label="Thread ID" name="thread_id" />
                {/* ... more fields */}
            </>
        )}

        {/* Attachment-specific */}
        {entityType === "email_attachment" && (
            <Input label="Parent Email ID" name="parent_email_id" placeholder="UUID" />
        )}
    </div>
</details>
```

The form appends these to the existing `FormData` before calling `uploadVragFile()`.

### 6.3 Actions File — No Changes Needed

The `uploadVragFile()` server action already passes `FormData` through to the Python API. New form fields will be included automatically.

---

## 7. File Structure Summary

```
supabase/migrations/
  <timestamp>_vrag_filter_columns.sql        # New migration

python-services/agent_api/vrag/
  aip160_parser.py                            # NEW: parser + apply_filters + registry
  search_service.py                           # MODIFIED: use parse_aip160 + apply_filters
  models.py                                   # MODIFIED: update VragSearchRequest.filter description
  routes.py                                   # MODIFIED: add metadata Form params to upload

python-services/tests/unit/vrag/
  test_aip160_parser.py                       # NEW: unit tests for parser
  test_apply_filters.py                       # NEW: unit tests for filter application

vrag-ui/components/
  rag-search-panel.tsx                        # MODIFIED: filter help, updated placeholder
  rag-file-manager.tsx                        # MODIFIED: metadata input fields
```

---

## 8. Implementation Slices

| Slice | What | Files | Dependency |
|---|---|---|---|
| 1 | DB migration — add columns + indexes | `supabase/migrations/<ts>_vrag_filter_columns.sql` | None |
| 2 | AIP-160 parser + unit tests | `aip160_parser.py`, `test_aip160_parser.py` | None |
| 3 | `apply_filters()` + unit tests | `aip160_parser.py` (extend), `test_apply_filters.py` | Slice 2 |
| 4 | Search service integration | `search_service.py`, `models.py` | Slices 1, 3 |
| 5 | Upload metadata population | `routes.py` | Slice 1 |
| 6 | UI: search filter help | `rag-search-panel.tsx` | Slice 4 |
| 7 | UI: upload metadata fields | `rag-file-manager.tsx` | Slice 5 |

Slices 1 and 2 are independent and can be done in parallel. Slice 3 depends on 2. Slices 4-5 depend on 1 and their respective backend slices. UI slices 6-7 are last.

---

## 9. Testing Strategy

### 9.1 Unit Tests (Slices 2-3)

**`test_aip160_parser.py`:**
- Single comparison: `sender = "alice@co.com"`
- Numeric comparison: `date_epoch >= 1704067200`
- Multiple AND: `sender = "alice" AND date_epoch >= 100`
- Multiple OR: `sender = "alice" OR sender = "bob"`
- Mixed AND/OR: `sender = "alice" AND date_epoch >= 100 OR sender = "bob"`
- Quoted strings with special chars: `file_extension = ".pdf"`
- Error: missing operator: `sender "alice"`
- Error: missing value: `sender =`
- Error: unknown token: `sender == "alice"`
- Error: empty string: ``
- Error: trailing junk: `sender = "alice" GARBAGE`

**`test_apply_filters.py`:**
- Boolean coercion: `has_attachments = 1` -> `True`
- Array containment: `recipients = "bob@co.com"` -> `.contains()`
- Entity-type validation: `sender` with `entity_type="file"` -> error
- Invalid range on text: `sender > "alice"` -> error
- Dict column resolution: `email_id = "X"` with `entity_type="email"` -> `.eq("id", "X")`
- Dict column resolution: `email_id = "X"` with `entity_type="email_attachment"` -> `.eq("parent_email_id", "X")`
- Dict column without entity_type: `email_id = "X"` with `entity_type=None` -> error
- All operator/type combinations

### 9.2 Integration Test (Slice 4)

No DB integration test needed for v1 — the search service integration is thin (parse + apply). The parser and apply_filters have thorough unit tests. The Supabase query builder calls are standard PostgREST operations.

### 9.3 Manual Testing (Slices 5-7)

Upload files with metadata via the UI, then search with filters and verify results are narrowed correctly. This is a prototype — manual validation is sufficient.
