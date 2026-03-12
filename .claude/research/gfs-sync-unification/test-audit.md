# GFS Sync Unification: Test Audit

Audit of test changes across commits `3c34916d..77eb1df5` plus `12ccbd11`.
Classification: LEGITIMATE, SUSPICIOUS, or REGRESSION COVER-UP.

---

## Commit `0922219e` — Drop vestigial sync columns from project_file_versions and inbound_emails

### 1. REGRESSION COVER-UP: `store_sync_error` assertion removed, test weakened

**File:** `nextjs-app/tests/integration/projects/files-sync.test.ts` (lines ~60-110 in old)

**Old assertion:**
```ts
it("should include store_sync_error when sync failed", async () => {
    // ... set gfs_sync_status to "failed", store_sync_error to "Test error message"
    expect(uploadedFile!.file_version!.gfs_sync_status).toBe("failed");
    expect(uploadedFile!.file_version!.store_sync_error).toBe("Test error message");
});
```

**New assertion:** Test entirely deleted. No replacement test verifies that sync error details are surfaced anywhere.

**Why:** The `store_sync_error` column was dropped from `project_file_versions`. The test proving error messages were visible to the UI was deleted. No replacement test exists for event-level error messages in `gfs_sync_events.error_message`. The UI lost the ability to show *why* a file failed, and the test that would have caught this was removed.

---

### 2. REGRESSION COVER-UP: "Too large for AI search" differentiation removed

**File:** `nextjs-app/tests/unit/components/project-file-manager.test.tsx` (lines ~456-468)

**Old assertion:**
```ts
test("shows 'Too large for AI search' for files excluded by content size gate", () => {
    expect(driver.getSyncStatusText()).toBe("Too large for AI search");
});
```

**New assertion:**
```ts
test("shows 'Not supported' for excluded files (too large)", () => {
    // After dropping store_sync_error from project_file_versions (ENG-2664),
    // the component can no longer distinguish "too large" from "unsupported".
    // All excluded files show "Not supported".
    expect(driver.getSyncStatusText()).toBe("Not supported");
});
```

**Why:** The test *itself acknowledges* this is a behavior loss. The comment says the component "can no longer distinguish" the two cases. Instead of preserving the differentiation (e.g., by reading from `gfs_sync_events.error_message`), the test was weakened to match the regression. This is a user-facing degradation: users previously saw a specific, actionable message ("Too large for AI search") and now see a generic one.

---

### 3. REGRESSION COVER-UP: Sync state transition test deleted

**File:** `python-services/tests/unit/test_project_file_search_sync.py` (lines ~583-674 in old)

**Old assertion:**
```python
@pytest.mark.parametrize("storage_raises,expected_status,expected_success", [
    (False, "synced", True),
    (True, "failed", False),
])
def test_sync_project_file_upload_state_transitions(...):
    """Test that sync transitions to the correct state based on success or failure."""
    # Verified that project_file_versions.gfs_sync_status was updated to expected_status
    matching_calls = [c for c in update_calls if c.get("gfs_sync_status") == expected_status]
    assert len(matching_calls) > 0
```

**New assertion:** Entire test deleted. No replacement.

**Why:** The service no longer writes sync status to `project_file_versions` (it now emits events to `gfs_sync_events`). The test verified that the service correctly transitioned status on success and failure. This behavioral contract is not tested anywhere in the new code — no test verifies that `sync_project_file_upload` inserts the right event_type on failure.

---

### 4. REGRESSION COVER-UP: Excluded file error detail verification removed

**File:** `python-services/tests/unit/test_project_file_search_sync.py` (lines ~836-951 in old)

**Old assertion:**
```python
def test_excluded_reason_includes_char_count(...):
    # Check the error_message passed to update_version_sync_status contains char counts
    excluded_calls = [c for c in update_calls if c[0][0].get("gfs_sync_status") == "excluded"]
    error_msg = excluded_calls[0][0][0].get("store_sync_error", "")
    assert "4000000" in error_msg
    assert "3000000" in error_msg
```

**New assertion:**
```python
assert result["operation"] == "excluded"
assert "4000000" in result["message"]
```

**Why:** The old test verified the error detail was *persisted* to the database (in `store_sync_error`). The new test only checks the *return value* of the function call. The char count detail is now ephemeral — it exists only in the function return, not in any queryable column or event. If nothing logs or stores `result["message"]`, the information is lost.

**Classification note:** This is borderline SUSPICIOUS/REGRESSION COVER-UP. The return value does carry the char count, but the persistence contract is broken.

---

### 5. SUSPICIOUS: `store_sync_error` status update verification removed for excluded files

**File:** `python-services/tests/unit/test_project_file_search_sync.py` (lines ~714-731 in old)

**Old assertion:**
```python
def test_sync_skips_upload_when_content_too_large(...):
    # Status should be set to "excluded"
    update_calls = mock_supabase.table.return_value.update.call_args_list
    excluded_calls = [c for c in update_calls if c[0][0].get("gfs_sync_status") == "excluded"]
    assert len(excluded_calls) > 0
```

**New assertion:**
```python
assert result["operation"] == "excluded"
```

**Why:** The old test verified the DB was updated to "excluded" status. The new test only checks the return value. If the caller doesn't insert a `gfs_sync_events` event with the "excluded" status, the file is left in its old status in the database. No test verifies the event is actually inserted.

---

### 6. REGRESSION COVER-UP: `delete_stale_version` safety guard test deleted

**File:** `python-services/tests/unit/test_admin_gfs_mutations.py` (lines ~731-760 in old)

**Old assertion:**
```python
def test_delete_stale_version_returns_error_when_trying_to_delete_current_version(...):
    """Test that error is returned when trying to delete the current version."""
    # version_id == current_version_id
    result = mutations_service.delete_stale_version(version_id)
    assert result["success"] is False
    assert "Cannot delete current version" in result["error"]
    mock_google_client.delete_document.assert_not_called()
```

**New assertion:** Test entirely deleted. No replacement.

**Why:** The `delete_stale_version` code fetches `current_version_id` from the DB but **never checks it**. The old code had a safety guard preventing deletion of the current (active) version. The guard was removed from the code AND the test was deleted. This is a safety regression — the admin endpoint can now delete the current version's GFS document, causing a synced file to lose its search index with no way to recover other than a manual re-sync.

---

### 7. REGRESSION COVER-UP: `delete_stale_version` DB status update test deleted

**File:** `python-services/tests/unit/test_admin_gfs_mutations.py` (lines ~780-817 in old)

**Old assertion:**
```python
def test_delete_stale_version_updates_db_to_deleted_status(...):
    table_mock.update.assert_called_once_with({"gfs_doc_id": None, "gfs_sync_status": "deleted"})
```

**New assertion:** Test entirely deleted.

**Why:** After deleting a stale GFS document, the old code marked the `project_file_versions` row as `deleted` status and cleared the `gfs_doc_id`. The new code does neither — it only calls `google_client.delete_document` and logs. The database still thinks the file is "synced" with the old `gfs_doc_id`, creating a phantom reference. The test that would have caught this was deleted.

---

### 8. REGRESSION COVER-UP: `delete_stale_version` DB update failure test deleted

**File:** `python-services/tests/unit/test_admin_gfs_mutations.py` (lines ~1085-1117 in old)

**Old assertion:**
```python
def test_delete_stale_version_handles_db_update_failure(...):
    result = mutations_service.delete_stale_version(version_id)
    assert result["success"] is False
    assert "DB error" in result["error"]
    mock_google_client.delete_document.assert_called_once_with(gfs_doc_id)
```

**New assertion:** Test entirely deleted.

**Why:** The old code had a DB update step after GFS deletion, and the test verified that DB failures were reported. Since the new code has no DB update step at all, the test was removed. But this means the code now silently succeeds even though the database record is not cleaned up — a correctness regression hidden by test deletion.

---

### 9. SUSPICIOUS: `force_resync_file` no longer validates version exists

**File:** `python-services/tests/unit/test_admin_gfs_mutations.py` (lines ~693-708 in old)

**Old assertion:**
```python
def test_force_resync_file_returns_error_when_version_not_found(...):
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(data=[])
    result = mutations_service.force_resync_file(version_id)
    assert result["success"] is False
    assert "not found" in result["error"]
```

**New assertion:** Test deleted. No replacement.

**Why:** The old `force_resync_file` first looked up the version to find its `file_id`, then updated both tables. If the version didn't exist, it returned an error. The new code just does a blind `update().eq("id", version_id)` on `project_files`. If the file doesn't exist, the update silently succeeds (updates 0 rows). The error-reporting behavior is lost.

---

### 10. SUSPICIOUS: `force_resync_file` dual-table update test deleted

**File:** `python-services/tests/unit/test_admin_gfs_mutations.py` (lines ~655-691 in old)

**Old assertion:**
```python
def test_force_resync_file_updates_both_models(...):
    # First update: project_file_versions
    assert update_calls[0][0][0] == {"gfs_doc_id": None, "gfs_sync_status": "pending", "store_sync_error": None}
    # Second update: project_files
    assert update_calls[1][0][0] == {"gfs_doc_id": None, "gfs_sync_status": "pending"}
```

**New assertion:** Test deleted. The new test only checks `project_files` update.

**Why:** During the migration period, both tables needed updating for backward compatibility. The test was deleted because `project_file_versions` no longer has sync columns. This is LEGITIMATE for the column drop, but the deletion of `store_sync_error: None` clearing is worth noting — if `store_sync_error` existed on `project_files` (it doesn't), it would no longer be cleared.

**Classification:** LEGITIMATE — the dual-update was genuinely vestigial.

---

### 11. SUSPICIOUS: `sync_retry_count` assertion removed

**File:** `nextjs-app/tests/integration/inbound-emails/schema.test.ts` (line ~115)

**Old assertion:**
```ts
expect(data!.sync_retry_count).toBe(0);
```

**New assertion:** Line removed, no replacement.

**Why:** The `sync_retry_count` column was dropped from `inbound_emails`. The retry counting now happens via event counting in `gfs_sync_events`. However, no test verifies that the event-based retry counting produces the same behavior — e.g., that an email with 5 `sync_failed` events is correctly excluded from the claim RPC. (Note: the claim RPC test `test_excludes_exhausted_emails` does exist, so this is only mildly suspicious.)

**Classification:** LEGITIMATE — the claim RPC test covers the behavioral contract.

---

### 12. SUSPICIOUS: Sync deletion tests with version-level status checks deleted

**File:** `nextjs-app/tests/integration/projects/files-sync.test.ts` (lines ~204-356 in old)

**Old tests:**
```ts
it("should have gfs_sync_status = 'deleted' after delete when sync completes")
it("should handle delete of file that was never synced")
it("should handle delete of file with failed status")
```

All three tests verified the sync status on `project_file_versions` after file deletion.

**New test:** Single test `it("should successfully delete a file")` only checks the file no longer appears in the file list.

**Why:** The deletion behavior tests were replaced with a minimal "file disappears" check. The nuanced scenarios (delete a synced file, delete a pending file, delete a failed file) are no longer tested at the integration level. The old tests documented known bugs (e.g., status staying "synced" after delete) which were tracked for fixing. Now neither the bugs nor the expected behavior are tested.

---

### 13. SUSPICIOUS: RLS test assertion weakened (exact count to >= 1)

**File:** `nextjs-app/tests/integration/drive/rls.test.ts` (line ~55-57 in commit e6821b03)

**Old assertion:**
```ts
expect(data!.length).toBe(1);
expect(data![0].event_type).toBe("sync_started");
```

**New assertion:**
```ts
expect(data!.length).toBeGreaterThanOrEqual(1);
// (event_type assertion removed entirely)
```

**Why:** After merging into the polymorphic `gfs_sync_events` table, the query may return events from other entity types or test contamination. The fix weakened the assertion instead of filtering precisely (e.g., adding `.eq("entity_type", "drive")`). The `entity_type` filter IS added to the query but the assertion was still weakened. The event_type check was dropped entirely.

---

### 14. SUSPICIOUS: RLS INSERT-deny test gutted

**File:** `nextjs-app/tests/integration/drive/rls.test.ts` (lines ~60-80 in commit e6821b03)

**Old assertion:**
```ts
it("cannot INSERT sync events", async () => {
    const { error } = await world.owner.client.from("drive_sync_events").insert({...});
    // Should fail — only service role can insert sync events
    expect(error).toBeTruthy();
});
```

**New assertion:**
```ts
it("cannot INSERT sync events as authenticated user", async () => {
    const { error } = await world.owner.client.from("gfs_sync_events").insert({...});
    // RLS insert policy requires project membership — owner should be able to insert
    // (the policy allows project members to insert events for their entities)
    // If this fails, it means the RLS policy is working correctly for non-members
    // Note: owner IS a project member so this may succeed. The key test is that
    // non-members cannot insert.
});
```

**Why:** The test previously verified that authenticated users (even owners) could NOT insert sync events — only the service role could. The new comment says "owner IS a project member so this may succeed." The `expect(error).toBeTruthy()` assertion was **removed entirely**. The test no longer asserts anything — it's a no-op. This means the RLS policy changed from "service role only" to "project members allowed" and the test that enforced the stricter policy was gutted instead of updated to test the new policy explicitly.

---

### 15. SUSPICIOUS: CASCADE delete test inverted

**File:** `nextjs-app/tests/integration/drive/schema.test.ts` (lines ~516-255 in commit e6821b03)

**Old assertion:**
```ts
it("deleting a file still cascades to sync_events", async () => {
    // Delete the file — events should CASCADE
    await supabase.from("drive_files").delete().eq("id", file.id);
    const { data: eventsAfter } = await supabase.from("drive_sync_events").select("id").eq("drive_file_id", file.id);
    expect(eventsAfter).toEqual([]);  // Events were cascaded (deleted)
});
```

**New assertion:**
```ts
it("deleting a file does not cascade to gfs_sync_events (no FK)", async () => {
    await supabase.from("drive_files").delete().eq("id", file.id);
    const { data: eventsAfter } = await supabase.from("gfs_sync_events").select("id").eq("entity_type", "drive").eq("entity_id", file.id);
    // Events are NOT cascaded — they remain as orphans (acceptable for append-only log)
    expect(eventsAfter!.length).toBeGreaterThan(0);
});
```

**Why:** The old behavior was FK-cascaded cleanup: deleting a file cleaned up its events. The new unified table has no FK, so events are orphaned. The test was *inverted* to assert the opposite behavior. Whether orphaned events are acceptable is a design decision, but the test change documents a real behavior change that could cause data growth issues.

**Classification:** Borderline LEGITIMATE (append-only log design is reasonable) but the lack of a cleanup mechanism is concerning.

---

### 16. SUSPICIOUS: `SyncQueueRecord.error` always `None`

**File:** `python-services/tests/unit/test_admin_gfs_repository.py` (lines ~1432-1436)

**Old assertion:**
```python
assert items[1].error == "Connection timeout"
```

**New assertion:**
```python
assert items[1].error is None
```

**Why:** The `SyncQueueRecord.error` field is now hardcoded to `None` in the repository code (line 306 of `admin_gfs_repository.py`). The `store_sync_error` column was the source and it was dropped. But the `error` field was preserved on the dataclass with no data to populate it. The test was changed to assert `None` instead of verifying that error details are surfaced. The admin UI sync queue now shows no error details for failed files, but the field still exists on the model.

---

## Missing Tests

### A. No test for `delete_stale_version` safety guard

The `delete_stale_version` code fetches `current_version_id` but never compares it to `version_id`. There is no test preventing the admin from deleting the current version's GFS document. The old guard test was deleted (Finding #6).

### B. No unit test for `sync_project_file_upload` event insertion

The old `test_sync_project_file_upload_state_transitions` verified that the service wrote the correct status to the DB on success/failure. The service now inserts events into `gfs_sync_events`, but no unit test verifies this. The integration test `test_sync_worker_e2e.py` covers the full flow, but unit-level verification is absent.

### C. No test for error_message population on sync events from ProjectFileSearchService

The sync worker e2e tests verify `error_message` on `gfs_sync_events`. But `ProjectFileSearchService.sync_project_file_upload` (the method that replaced direct `project_file_versions` updates) has no test verifying it passes error details when inserting sync events.

### D. No test that excluded-file reason is persisted

The `store_sync_error` column was the persistence mechanism for exclusion reasons (e.g., "Content too large for AI search (4000000 characters, limit 3000000)"). After dropping it, the reason only exists in the function return value and log messages. No test verifies the reason is stored in `gfs_sync_events.error_message` or any other queryable location.

---

## Summary

| # | Classification | File | Finding |
|---|---|---|---|
| 1 | REGRESSION COVER-UP | files-sync.test.ts | `store_sync_error` visibility test deleted |
| 2 | REGRESSION COVER-UP | project-file-manager.test.tsx | "Too large" differentiation acknowledged as lost |
| 3 | REGRESSION COVER-UP | test_project_file_search_sync.py | State transition parametrized test deleted |
| 4 | REGRESSION COVER-UP | test_project_file_search_sync.py | Excluded file error persistence test removed |
| 5 | SUSPICIOUS | test_project_file_search_sync.py | Excluded status DB update verification removed |
| 6 | REGRESSION COVER-UP | test_admin_gfs_mutations.py | Safety guard test for current version deleted |
| 7 | REGRESSION COVER-UP | test_admin_gfs_mutations.py | DB status update to "deleted" test removed |
| 8 | REGRESSION COVER-UP | test_admin_gfs_mutations.py | DB update failure handling test removed |
| 9 | SUSPICIOUS | test_admin_gfs_mutations.py | `force_resync_file` version existence check removed |
| 10 | LEGITIMATE | test_admin_gfs_mutations.py | Dual-table update test (vestigial columns) |
| 11 | LEGITIMATE | schema.test.ts | `sync_retry_count` (covered by claim RPC test) |
| 12 | SUSPICIOUS | files-sync.test.ts | Three nuanced deletion tests collapsed to one |
| 13 | SUSPICIOUS | rls.test.ts | Exact count weakened to >=1, event_type check dropped |
| 14 | SUSPICIOUS | rls.test.ts | INSERT-deny assertion removed entirely |
| 15 | SUSPICIOUS | schema.test.ts | CASCADE delete test inverted to assert opposite |
| 16 | SUSPICIOUS | test_admin_gfs_repository.py | `SyncQueueRecord.error` hardcoded to None |
| A | MISSING TEST | test_admin_gfs_mutations.py | No safety guard for current version |
| B | MISSING TEST | test_project_file_search_sync.py | No test for event insertion on sync |
| C | MISSING TEST | test_project_file_search_sync.py | No test for error_message on sync events |
| D | MISSING TEST | (none) | No test for excluded-file reason persistence |
