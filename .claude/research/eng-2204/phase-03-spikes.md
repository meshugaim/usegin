# Phase 3: Pre-Implementation Spikes — ENG-2204

## Spike A: Verify `content.uri` in JSONL Import

### Verdict: WORKS — Use `content.uri`

### Evidence

**1. Proto definition confirms `uri` is a first-class alternative to `raw_bytes`.**

The `Document.Content` proto has a `oneof content` containing two mutually exclusive fields:

```
Document.Content fields:
  raw_bytes (type=bytes, number=2)
  uri (type=string, number=3)
  mime_type (type=string, number=1)
  oneof: content
    - raw_bytes
    - uri
```

Verified by introspecting the SDK proto descriptor:
```python
import google.cloud.discoveryengine_v1 as discoveryengine
content = discoveryengine.Document.Content()
pb = type(content).pb(content)
desc = pb.DESCRIPTOR
# Shows: oneof "content" containing raw_bytes and uri
```

`content.uri` and `content.raw_bytes` are a `oneof` — they cannot both be set on the same Document. This means `uri` is explicitly designed as an alternative to `raw_bytes`, not an undocumented hack.

**2. SDK accepts `content.uri` without error.**

```python
doc = discoveryengine.Document(
    id='test-doc',
    content=discoveryengine.Document.Content(
        uri='gs://test-bucket/test-file.txt',
        mime_type='text/plain',
    ),
)
# doc.content.uri == 'gs://test-bucket/test-file.txt' ✓
# Serializes to: {"id": "test-doc", "content": {"mime_type": "text/plain", "uri": "gs://..."}}
```

**3. Google documentation explicitly shows `content.uri` in JSONL for import.**

From [Prepare data for ingesting](https://docs.cloud.google.com/generative-ai-app-builder/docs/prepare-data):

> "Use the `uri` field in each row to point to the Cloud Storage location of the document."

Example from docs:
```json
{
  "id": "doc-0",
  "content": {
    "mimeType": "application/pdf",
    "uri": "gs://bucket/document.pdf"
  }
}
```

This is the canonical JSONL format for unstructured document import.

**4. Existing experiment results show VAIS stores `content_uri` after GCS import.**

From `phase2b_results.json`, the error message for large.txt shows VAIS internally references the file as:
```
Document("content_uri": "gs://vais-reliability-test-files-51daa72e/phase2b/large.txt", "mime_type": "text/plain")
```

From `phase3_results.json`, document_metadata on chunks from GCS-imported files shows:
```
uri: "gs://vais-reliability-test-files-51daa72e/phase2b/large.txt"
title: "large"
```

This proves VAIS stores and tracks the GCS URI as the document's content source after a `data_schema="content"` import. The `data_schema="document"` JSONL import with `content.uri` formalizes what VAIS already does internally.

**5. The JSONL format for `data_schema="document"` maps directly to the Document proto.**

The current code uses `rawBytes` in JSONL (camelCase JSON mapping of `raw_bytes`):
```json
{"id": "...", "content": {"mimeType": "...", "rawBytes": "base64..."}, "structData": {...}}
```

Since `uri` and `rawBytes` are alternatives in the same `oneof`, the `uri` version is:
```json
{"id": "...", "content": {"mimeType": "...", "uri": "gs://..."}, "structData": {...}}
```

### Conclusion

`content.uri` is a documented, proto-level alternative to `content.rawBytes`. It is supported in JSONL import with `data_schema="document"`. The spec's design (upload raw file to GCS, reference via `content.uri` in JSONL) is correct. Proceed with slices 1-4 as written.

### Remaining Risk (Low)

The one gap is that no experiment in this codebase has specifically tested `content.uri` in a `data_schema="document"` JSONL import end-to-end. The experiments used either:
- `data_schema="content"` with GcsSource (phase2b — VAIS derives doc ID from URI hash)
- `data_schema="document"` with `content.rawBytes` in JSONL (current production code)

The combination of `data_schema="document"` + `content.uri` in JSONL is supported by the proto definition + Google documentation but untested in our codebase. The spike script (per the spec) should confirm this before full implementation. If it fails for any reason, the fallback (keep `rawBytes` in JSONL, just unify to single path) is trivial.

---

## Spike B: Determine Heading Format in Chunk Content

### Verdict: FORMAT IDENTIFIED — Markdown `#` syntax with double-space separator

### Evidence

**1. XLSX chunks show heading prepending pattern clearly.**

From `phase3_results.json`, the XLSX document (`phase2-fmt-test-xlsx`) has 4 chunks. All show the document-level heading prepended:

| Chunk | Content preview |
|---|---|
| c1 | `# VAIS Reliability Test  _START_OF_TABLE_...` |
| c2 | `# VAIS Reliability Test  resolved \| ITEM-019...` |
| c3 | `# VAIS Reliability Test  _START_OF_TABLE_...` |
| c4 | `# VAIS Reliability Test \| ITEM-043...` |

**Key observation:** Chunks c2 and c4 are continuation chunks (they start mid-table). The heading `# VAIS Reliability Test` is **prepended by VAIS** because the `includeAncestorHeadings` setting is enabled on the DataStore. The heading uses markdown `# ` (H1) syntax.

The separator between the heading and body content appears as `  ` (double space) in the 100-char JSON previews. Since JSON previews replace `\n` with spaces, the actual separator is likely `\n\n` (double newline).

**2. PPTX chunk shows multi-level headings in markdown format.**

The PPTX document (`phase2-fmt-test-pptx`) single chunk:
```
# VAIS Reliability Experiment  ## Testing PPTX upload support  # Section 1  The architecture of dist...
```

This shows:
- H1: `# VAIS Reliability Experiment`
- H2: `## Testing PPTX upload support`
- H1: `# Section 1`

Each heading level uses markdown `#` notation. The double-space separator in the preview (representing `\n\n`) separates heading levels from each other and from body text.

**3. Text file chunks show the same markdown heading pattern.**

From `phase3_results.json`, all text file first chunks show:
- `# large — Test Document for VAIS Reliability Experiment   ## Section 1 — large Analysis Part 1  The...`
- `# medium — Test Document for VAIS Reliability Experiment   ## Section 1 — medium Analysis Part 1  Th...`
- `# xlarge — Test Document for VAIS Reliability Experiment   ## Section 1 — xlarge Analysis Part 1  Ob...`
- `# small — Test Document for VAIS Reliability Experiment   ## Section 1 — small Analysis Part 1  API...`

The pattern is consistent: `# H1  ## H2  body text` where double spaces represent newline separators.

**4. Experiment Phase 7 confirms headings appear in chunk content but doesn't capture raw format.**

From `vertex_ai_search_experiment.py` Phase 7 (lines 1469-1585):
- Test document has `# Company Overview` > `## Engineering Department` > `### Infrastructure Team`
- The experiment checks `if heading in content` (substring match) — all 3/3 headings found
- But it only prints 200-char preview, never the full raw delimiter format
- Experiment summary (line 88): "heading hierarchy IS preserved in chunk content"

**5. Layout-based chunking uses markdown-style formatting universally.**

The pattern is consistent across all file types tested (text, PPTX, XLSX, DOCX):
- H1 = `# heading text`
- H2 = `## heading text`
- H3 = `### heading text`
- Heading separator = `\n\n` (double newline, appears as double space in JSON previews)
- Body content follows after the last heading's separator

### Inferred Chunk Content Format

For a chunk from a section under `# H1 > ## H2 > ### H3`:

```
# H1 Title

## H2 Title

### H3 Title

Body content of the chunk starts here...
```

Each heading is prepended as a markdown `#`-prefixed line, separated by double newlines (`\n\n`). The heading chain always starts from the highest ancestor and descends to the section containing the chunk.

### Parser Design

A regex-based parser can extract headings from the start of chunk content:

```python
import re

_HEADING_RE = re.compile(r'^(#{1,6})\s+(.+?)$', re.MULTILINE)

def _extract_heading_chain(content: str) -> list[str] | None:
    """Extract ancestor heading chain from the start of VAIS chunk content.

    VAIS prepends markdown headings (# H1, ## H2, ### H3) to chunk content
    when includeAncestorHeadings is enabled. Headings always appear at the
    start of the content, before the body text.
    """
    headings = []
    for line in content.split('\n'):
        stripped = line.strip()
        if not stripped:
            continue
        match = _HEADING_RE.match(stripped)
        if match:
            headings.append(match.group(2).strip())
        else:
            # First non-heading, non-empty line = body text starts
            break
    return headings if headings else None
```

**Limitation:** The content previews in the experiment results are truncated to 100 chars with newlines replaced by spaces. The exact newline count between headings (single `\n` vs double `\n\n`) is inferred but not confirmed from raw output. However, the markdown `#` pattern is unambiguous in all sampled chunks.

### Remaining Risk (Low)

The heading format is inferred from 100-char JSON previews where newlines are collapsed to spaces. The spike script should print full raw `chunk.content` (not truncated) to confirm:
1. The exact separator between headings (`\n\n` or `\n`)
2. The exact separator between the last heading and body text
3. Whether body content ever starts with `#` (which could confuse the parser)

The markdown `#` heading pattern itself is confirmed across 4 file types and dozens of chunks. The risk is only in the separator details, not the fundamental format.

---

## Summary

| Spike | Verdict | Confidence | Key Evidence |
|---|---|---|---|
| **A: content.uri** | **WORKS** — use it | High | Proto oneof confirms uri is alternative to raw_bytes; Google docs show JSONL with content.uri; SDK accepts it |
| **B: Heading format** | **IDENTIFIED** — markdown `#` syntax | High | 4 file types show consistent `# H1  ## H2  ### H3  body` pattern; all 18+ sampled chunks match |

Both spikes support proceeding with the spec as written. The spike scripts should still be run as a final gate, but the evidence strongly supports the design.
