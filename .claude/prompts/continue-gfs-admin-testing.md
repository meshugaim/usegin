# Continue GFS Admin Dashboard Testing

## Context

The GFS Admin Dashboard at `/admin/gfs` has been built and partially tested. We've verified:
- ✅ Dashboard loads for admin users
- ✅ Stores tab shows stores with health status
- ✅ Reconciliation detects "Missing Stores" (DB records without Google stores)

## What Still Needs Testing

We need to test the remaining 3 mismatch scenarios:

### 1. Orphan Stores (Google → DB)
Stores that exist in Google but have no corresponding DB record.

**How to create:**
- Use the Gemini API to create a cached content store (requires 4096+ tokens of content)
- Don't add the store ID to `project_file_search_stores` table
- Run reconciliation - should appear under "Orphan Stores"
- Test the "Delete" button to remove from Google

### 2. Missing Docs (DB → Google)
Documents marked as `synced` in DB but don't exist in Google store.

**How to create:**
- Find/create a real store that exists in both DB and Google
- Insert a `project_file_versions` record with:
  - `store_sync_status = 'synced'`
  - `google_doc_id = 'fake-doc-xxxxx'` (non-existent)
- Run reconciliation - should appear under "Missing Docs"

### 3. Orphan Docs (Google → DB)
Documents in a Google store that aren't tracked in DB.

**How to create:**
- Find/create a real store
- Upload a document directly via Gemini API (not through the app)
- Run reconciliation - should appear under "Orphan Docs"
- Test the "Delete" button

## Key Files

| File | Purpose |
|------|---------|
| `python-services/agent_api/admin_gfs_service.py` | Admin service with reconciliation logic |
| `nextjs-app/app/admin/gfs/page.tsx` | Admin dashboard page |
| `nextjs-app/components/admin/gfs/reconciliation-panel.tsx` | Reconciliation results UI |
| `scripts/setup-gfs-test-data.py` | Test data creation script (extend this) |
| `docs/gfs-hardening.impl-status.md` | Implementation status doc |

## Environment Setup

The local environment should be configured for localhost testing:
- `nextjs-app/.env.local` - Supabase URL should be `http://127.0.0.1:54321`
- `python-services/.env` - Same localhost URLs
- Admin user: `owner@test.local` (ID: `11111111-1111-1111-1111-111111111111`)

## Google Cache Requirements

Creating real Google stores requires:
- At least 4096 tokens of content (Gemini cache minimum)
- Use `GEMINI_API_KEY_DEV` from environment
- Model: `gemini-2.0-flash-001`

Example to create a store with enough content:
```python
from google import genai

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY_DEV"))

# Generate large enough content (4096+ tokens)
large_content = "Test document content. " * 1000  # ~4000 words

store = client.caches.create(
    model="gemini-2.0-flash-001",
    config=genai.types.CreateCachedContentConfig(
        display_name="test-orphan-store",
        contents=[
            genai.types.Content(
                role="user",
                parts=[genai.types.Part(text=large_content)]
            )
        ],
        ttl="86400s",
    )
)
print(f"Created store: {store.name}")
```

## Success Criteria

1. All 4 mismatch types appear correctly in reconciliation results
2. Delete buttons work for orphan stores and orphan docs
3. "Investigate" links work for missing stores
4. Missing docs are flagged appropriately
5. Update `docs/gfs-hardening.impl-status.md` with test results
