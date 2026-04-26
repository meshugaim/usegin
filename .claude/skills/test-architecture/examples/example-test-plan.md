# test-plan.md — Example: CSV Upload + Row Count

This is a worked example for an imagined feature: **the user uploads a CSV; the system parses it and returns the row count.** Used as the canonical reference implementation of `test-plan.schema.json`.

The feature has four layers worth pinning: pure parser (`unit`), upload + persisted row-count (`code-integration`), end-to-end user flow (`e2e`), and an external CSV-validator service contract (`external`). It also has one mirrored field — `csv_uploads.row_count` derived from the parser — so we enumerate write-sites under `failure_mode_class: contract`.

---

```yaml
spec: ENG-9999
generated_at: 2026-04-26T11:00:00Z
generated_by: test-architecture@v1.0.0

tests:
  - id: T1
    layer: unit
    assertion_shape: |
      "parseCsv(buffer) returns { rows: N } where N matches the count of
       newline-terminated, non-empty lines in the input buffer."
    rationale: |
      "Pure parser logic — no I/O, no DB, no external service. Behaviour
       dimension: the AC is about a deterministic transformation. Speed
       dimension: every push runs this. (01-test-inventory.md line 67-115.)"
    ac_ids: [AC1]
    outermost: false
    failure_mode_class: happy

  - id: T2
    layer: unit
    assertion_shape: |
      "parseCsv(buffer) throws ParseError with line number when a row has
       fewer columns than the header."
    rationale: |
      "Specific error path; the AC requires the user sees 'Could not parse
       row N'. Behaviour dimension: error-class shape is fixed by the parser,
       not by the UI."
    ac_ids: [AC2]
    outermost: false
    failure_mode_class: error

  - id: T3
    layer: code-integration
    assertion_shape: |
      "After uploadCsv() resolves, csv_uploads.row_count equals the parser's
       row count for the same buffer."
    rationale: |
      "Mirror invariant: row_count is derived from parseCsv. Per ENG-5023
       pattern, every write-site of the derived field needs a contract row.
       Behaviour dimension: pins the producer-consumer relationship."
    ac_ids: [AC1, AC3]
    external_dependencies:
      - service: Supabase
        kind: mocked
        contract_check: |
          "Mock asserts that uploadCsv() calls supabase.from('csv_uploads').insert
           with {row_count: parsedCount}. Does NOT assert RLS or trigger semantics
           — those go to T6 (sql-rls)."
    outermost: false
    failure_mode_class: contract
    mock_can_lie_note: |
      "Mock returns 200 regardless of payload. If production's insert silently
       drops row_count (column rename, type coercion), this test still passes.
       Pair with T5 (e2e) which reads the persisted row from a real DB, and
       T6 (sql-rls) which pins the column shape."

  - id: T4
    layer: code-integration
    assertion_shape: |
      "When uploadCsv() is called twice in parallel for the same file_id,
       csv_uploads.row_count converges to one of the two parsed values, not
       a partial sum or interleaved write."
    rationale: |
      "AC3 mentions 'concurrent uploads from the same client should not corrupt
       row_count' — race class per ENG-2821 chaos cluster. The happy-path T3
       cannot catch interleaved writes; we need a sibling race row."
    ac_ids: [AC3]
    external_dependencies:
      - service: Supabase
        kind: mocked
        contract_check: |
          "Mock simulates two concurrent insert() calls; assert last-writer-wins."
    outermost: false
    failure_mode_class: race
    mock_can_lie_note: |
      "Mock can serialize calls in the order it received them; production
       Postgres might serialize differently. Pair with periodic e2e load test
       (out of scope for this slice — opens follow-up issue if mutation-pass
       opt-in is taken at tdd-impl-plan)."

  - id: T5
    layer: e2e
    assertion_shape: |
      "User uploads a 100-row CSV via the upload form; the success page
       displays 'Imported 100 rows' and the user's recent-uploads list shows
       the file with a row_count of 100."
    rationale: |
      "Outermost acceptance test — traverses the full user-observable surface:
       browser form -> Next.js action -> Python parser -> Supabase write ->
       browser read-back. Confidence dimension: this is the test we'd want green
       at end of slice (Mandate #11)."
    ac_ids: [AC1, AC2, AC3, AC4]
    external_dependencies:
      - service: Supabase
        kind: real
        contract_check: |
          "Real testcontainer Supabase. Verifies RLS allows owner to see own
           upload, denies external user."
      - service: CsvValidator
        kind: fake-with-self-test
        contract_check: |
          "Fake validator returns success for happy-path fixtures. Self-test:
           tests/fakes/csv-validator-self-test.ts asserts the fake's response
           shape matches production's OpenAPI schema (per ENG-4934 T1)."
    outermost: true
    failure_mode_class: happy

  - id: T6
    layer: sql-rls
    assertion_shape: |
      "csv_uploads.row_count column exists, is INTEGER NOT NULL, and is
       indexed by (workspace_id, created_at desc) for the recent-uploads
       query."
    rationale: |
      "Schema contract — pgTAP can pin this directly without exercising
       application code. Speed dimension: <100ms per file; runs every push.
       Pairs with T3's mock-can-lie risk: if a migration drops the column,
       T6 fails before T3's mock has a chance to lie."
    ac_ids: [AC3]
    outermost: false
    failure_mode_class: contract

  - id: T7
    layer: external
    assertion_shape: |
      "Submitting a real CSV to the production CsvValidator API returns 200
       with {valid: true, row_count: N} matching parseCsv(buffer).rows for N."
    rationale: |
      "Real third-party API contract — runs nightly per external layer policy.
       Behaviour dimension: catches CsvValidator API drift between the fake
       used in T5 and production. Without this row, T5 ships green forever
       even when CsvValidator changes its response shape."
    ac_ids: [AC4]
    external_dependencies:
      - service: CsvValidator
        kind: real
        contract_check: |
          "Real production API; uses CSV_VALIDATOR_API_KEY env var; cleans up
           uploaded fixtures via /v1/uploads/<id> DELETE."
    outermost: false
    failure_mode_class: contract
```

---

## Required-slot audit

| Slot | Status |
|------|--------|
| 1. Outermost test exists | T5 has `outermost: true`. |
| 2. AC coverage | AC1 (T1, T3, T5), AC2 (T2, T5), AC3 (T3, T4, T5, T6), AC4 (T5, T7). All four ACs covered ≥1 test. |
| 3. Write-site enumeration | Mirror field `csv_uploads.row_count`: write-sites are `uploadCsv()` (T3) — only one write-site for this slice (single-action feature). |
| 4. Async-coordination flagging | AC3 mentions "concurrent uploads" → T4 with `failure_mode_class: race`. |
| 5. Mock-can-lie audit | T3 (mocked Supabase) → mock-can-lie note present and specific. T4 (mocked Supabase) → note present. T5 uses `fake-with-self-test`, no mock-can-lie note required (the self-test is the contract guard). T7 uses real API, no note required. |

## Mutation-pass recommendation

Per SKILL.md "Mutation-pass cross-link", T3, T4, T6, T7 are tagged `failure_mode_class: contract` or `race` and recommend `mutation_pass.required: true` to `tdd-impl-plan`. Sample mutations the impl-plan should consider for the mutation-pass scope (per ENG-4934 model):

- Drop `row_count` from the insert payload (T3 should fail).
- Replace `INTEGER NOT NULL` with nullable in migration (T6 should fail).
- Make the parser off-by-one on the last row (T1, T3, T5, T7 should fail).
- Make CsvValidator return `row_count` as a string (T7 should fail).

If any mutation passes all tests, that's a coverage gap; file a follow-up.

## What this plan does NOT do

- Does not write any test code (that's `tdd-execute`).
- Does not order tests for execution (that's `tdd-impl-plan`).
- Does not pick mock library (Bun's built-in vs `vi.mock` — out of scope).
- Does not commit to a `mutation_pass.required` value — only recommends.
