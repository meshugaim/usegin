# Phase 07: Upload Flow End-to-End Test

**Date**: 2026-02-26
**Project**: Demo Project (`bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`)

## Summary

| Step | Test | Result |
|------|------|--------|
| 1 | Server restart + health check | PASS |
| 2 | Get project ID from Supabase | PASS |
| 3 | Small file upload (<1MB, inline path) | PASS |
| 4 | Large file upload (>1MB, GCS path) | PASS (upload accepted) |
| 5 | Wait for sync worker | -- |
| 6 | Document status check | PARTIAL -- see details |
| 7 | Sync worker logs | PASS (logs clear) |
| 8 | Search | FAIL |
| 9 | Delete | PASS |

**Overall: 6/9 PASS, 1 PARTIAL, 1 N/A, 1 FAIL. Two bugs found.**

---

## Step Results

### Step 1: Server Restart -- PASS

```
just vais-kill  -> "VAIS ports cleared"
just vais-api   -> started in background
curl http://localhost:58200/health -> {"status":"healthy","service":"vais-prototype"}
```

Server started with sync worker enabled (`VAIS_SYNC_ENABLED=true`).

### Step 2: Get Project ID -- PASS

```json
[
  {"id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","name":"Demo Project"},
  {"id":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","name":"Public Assigned Project"},
  {"id":"ffffffff-ffff-ffff-ffff-ffffffffffff","name":"Public Unassigned Project"}
]
```

Note: Required using `sb_secret_*` key format from python-services/.env (supabase status changed output format).

### Step 3: Small File Upload (Inline) -- PASS

- File: `vais-small-test.txt` (310 bytes)
- Response: `{"success":true,"document_id":"6b75a2d8-9b09-4060-b7a2-498a002ec03d","message":"Document queued for VAIS sync (version 1)"}`
- Sync worker picked it up within ~5 seconds
- Final status: `synced` (inline upload path, 2728ms)

### Step 4: Large File Upload (GCS) -- PASS (upload accepted)

- File: `vais-large-test.txt` (2,420,068 bytes = 2.4MB)
- Response: `{"success":true,"document_id":"3d838506-c612-4463-bdbc-82c419a24d7a","message":"Document queued for VAIS sync (version 1)"}`
- Upload to Supabase Storage succeeded
- GCS upload succeeded

### Step 6: Document Status -- PARTIAL

After sync worker processing:

| Document | Size | Sync Status | Notes |
|----------|------|-------------|-------|
| vais-small-test.txt | 310 B | `synced` | Inline path worked perfectly |
| vais-large-test.txt | 2.4 MB | `retry_exhausted` | **BUG 1**: GCS blob has no file extension |
| How-Anthropic-teams-use-Claude-Code_v2.pdf | 6.2 MB | `retry_exhausted` | Pre-existing; GCS bucket doesn't exist |

**BUG 1: GCS blob path missing file extension**

Root cause in `document_service.py:_upload_via_gcs()` line 222:
```python
blob_path = f"{datastore_id}/{document_id}"
```

This produces a GCS URI like:
```
gs://vais-prototype-uploads/vais-proj-bbbbbbbb/vais-3d838506-c612-4463-bdbc-82c419a24d7a
```

VAIS's GCS import (`data_schema="content"`) infers file type from the extension. With no extension, it sees `""` and rejects it:
```
File extension type is , and it is not supported.
Currently supported extensions are pdf, html, docx, pptx, xlsx and txt.
```

**Fix**: Append the file extension to the blob path:
```python
ext = get_file_type(metadata.get("file_name", ""))
blob_path = f"{datastore_id}/{document_id}.{ext}"
```

Note: This will change the SHA256(gcs_uri) document ID. Since GCS blobs are cleaned up after import, no migration needed -- just fix going forward.

### Step 7: Sync Worker Logs -- PASS

Logs confirm:
- Worker initialized and running (`VAIS-Worker-5769215e87aa-*`)
- Small file: sync_succeeded in 2728ms
- Large file: 5 retry attempts, all failed with same extension error, each ~7-9s
- Deletion cycle processed correctly

### Step 8: Search -- FAIL

```json
{
  "success": false,
  "query": "machine learning neural networks",
  "chunks": [],
  "total_results": 0,
  "error": "'MapComposite' object has no attribute 'fields'"
}
```

**BUG 2: SDK type mismatch in search result parsing**

Root cause in `search_service.py:_parse_chunk_results()` line 176:
```python
if dm and dm.struct_data and dm.struct_data.fields:
```

`dm.struct_data` is a `proto-plus` `MapComposite` object, not a raw `google.protobuf.struct_pb2.Struct`. The `MapComposite` wrapper doesn't expose a `.fields` attribute directly -- it's dict-like.

**Fix**: Access it as a dict:
```python
if dm and dm.struct_data:
    for key, value in dm.struct_data.items():
        metadata[key] = str(value)
```

Or convert to struct first:
```python
struct = Struct()
struct.update(dm.struct_data)
```

### Step 9: Delete -- PASS

- Request: `DELETE /api/vais/projects/{project_id}/documents/6b75a2d8-...`
- Response: `{"success":true,"message":"Document queued for deletion"}`
- Sync worker processed deletion in 2146ms
- Sync event: `deletion_succeeded` with `vais_doc_id=vais-6b75a2d8-...`
- Document removed from list (confirmed via GET /documents)
- Full lifecycle: upload -> sync -> delete -> confirmed deleted

---

## Bugs Found

### BUG 1: GCS blob path missing file extension (upload, severity: HIGH)

**File**: `python-services/agent_api/vais/document_service.py` line 222
**Impact**: All files >= 1MB fail to sync to VAIS
**Error**: `File extension type is , and it is not supported`
**Fix**: Append file extension to blob path

### BUG 2: MapComposite .fields access in search parsing (search, severity: MEDIUM)

**File**: `python-services/agent_api/vais/search_service.py` line 176
**Impact**: All search requests fail with `'MapComposite' object has no attribute 'fields'`
**Error**: `'MapComposite' object has no attribute 'fields'`
**Fix**: Use dict-like access (`dm.struct_data.items()`) instead of `.fields`

---

## Working Paths Summary

| Path | Status | Latency |
|------|--------|---------|
| Upload API (both sizes) | Working | <1s |
| Supabase Storage save | Working | -- |
| Inline sync (<1MB) | Working | ~2.7s |
| GCS sync (>=1MB) | Broken (BUG 1) | -- |
| Sync worker polling | Working | 10s interval |
| Sync worker claim (SKIP LOCKED) | Working | -- |
| Delete API | Working | <1s |
| Delete sync (VAIS removal) | Working | ~2.1s |
| Search | Broken (BUG 2) | -- |
| Store lazy creation | Working | -- |
