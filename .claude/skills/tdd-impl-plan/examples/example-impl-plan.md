# impl-plan.md — Example: CSV Upload + Row Count

Continuation of `.claude/skills/test-architecture/examples/example-test-plan.md` (test ids T1–T7). Used as the canonical reference implementation of `impl-plan.schema.json`.

The slice has 7 tests across 4 layers: 2× `unit`, 2× `code-integration`, 1× `e2e` (outermost), 1× `external`, 1× `code-integration` (contract-check for the `csv_uploads.row_count` mirror invariant). It's a high-risk slice (mirror invariant + external contract) so a `mutation_pass` epilogue is required.

---

```yaml
test_plan: ../../../skills/test-architecture/examples/example-test-plan.md
spec: ENG-9999
generated_at: 2026-04-26T12:00:00Z
generated_by: tdd-impl-plan@v1.0.0

# Format-before-Red — manufactured: lib/csv touched files are dirty under prettier.
pre_red:
  formatter_commits:
    - cmd: "bun run format nextjs-app/lib/csv"
      rationale: "lib/csv has 3 files dirty under prettier. Pre-Red commit keeps TDD diffs semantic."
    - cmd: "uv run ruff format python-services/agent_api/csv_validator"
      rationale: "csv_validator/__init__.py and client.py dirty under ruff. Pre-Red."

# Walking skeleton — manufactured: e2e outer test cannot resolve /upload route yet.
walking_skeleton:
  required: true
  steps:
    - description: "Stub Next.js route /upload with a 200 placeholder; declare csv_uploads table empty migration; export uploadCsv() service stub."
      target_test_id: T6   # the outer e2e

# Ordered execution
steps:
  - n: 1
    target_test_id: T6                  # the outermost e2e — "user uploads CSV, sees row count"
    layer: e2e
    role: outer-red
    tdd_or_verification: { tdd: true }
    predicted_seam_touchpoints:
      - { file: "tests/e2e/csv-upload.spec.ts", kind: "new" }
    blocker_dependencies: []
    notes: |
      Outer red. Stays red while inner cycles 2-7 land.
      Goes green at step 8 once uploadCsv() persists row_count and UI reads it.

  - n: 2
    target_test_id: T1                  # parser unit — happy path
    layer: unit
    role: inner-red
    tdd_or_verification: { tdd: true }
    predicted_seam_touchpoints:
      - { file: "nextjs-app/lib/csv/parse.test.ts", kind: "new" }
    blocker_dependencies: [1]
    notes: |
      First missing collaborator: parseCsv. Smallest red — assert returns
      { rows: N } for a 3-row buffer.

  - n: 3
    target_test_id: T1
    layer: unit
    role: inner-green
    tdd_or_verification: { tdd: true }
    transformation_hint: { tpp_rank: 2 }   # fake-it: hardcode return { rows: 3 }
    predicted_seam_touchpoints:
      - { file: "nextjs-app/lib/csv/parse.ts", kind: "new" }
    blocker_dependencies: [2]
    notes: |
      TPP rank 2 (fake-it). Hardcode { rows: 3 } and watch T1 pass. Triangulation
      happens at step 5 when T2 forces real parsing.

  - n: 4
    target_test_id: T2                  # parser unit — error path
    layer: unit
    role: inner-red
    tdd_or_verification: { tdd: true }
    predicted_seam_touchpoints:
      - { file: "nextjs-app/lib/csv/parse.test.ts", kind: "write" }
    blocker_dependencies: [3]
    notes: |
      Now force real implementation: T2 asserts ParseError on column-count
      mismatch. Hardcoded fake-it (step 3) cannot pass this — triangulation.

  - n: 5
    target_test_id: T2
    layer: unit
    role: inner-green
    tdd_or_verification: { tdd: true }
    transformation_hint: { tpp_rank: 5 }   # statement → statements: real loop + branch
    predicted_seam_touchpoints:
      - { file: "nextjs-app/lib/csv/parse.ts", kind: "write" }
    blocker_dependencies: [4]
    notes: |
      Real implementation: split lines, validate column count, throw with line
      number on mismatch. Both T1 and T2 now pass on the real impl.

  - n: 6
    target_test_id: T1                  # implicit — refactor with both tests green
    layer: unit
    role: inner-refactor
    tdd_or_verification: { tdd: true }
    blocker_dependencies: [5]
    notes: |
      Extract `splitRows()` helper. Tests stay green. If no refactor warranted,
      log explicit defer in events.jsonl with reason.

  - n: 7
    target_test_id: T3                  # code-integration: uploadCsv → row_count persisted
    layer: code-integration
    role: inner-red
    tdd_or_verification: { tdd: true }
    predicted_seam_touchpoints:
      - { file: "nextjs-app/tests/code-integration/csv-upload.test.ts", kind: "new" }
    blocker_dependencies: [6]
    notes: |
      Red the contract: after uploadCsv(buffer), csv_uploads.row_count matches
      parseCsv(buffer).rows. Pulls forward the mirror invariant.

  - n: 8
    target_test_id: T3
    layer: code-integration
    role: inner-green
    tdd_or_verification: { tdd: true }
    transformation_hint: { tpp_rank: 11 }   # extract the upload service
    predicted_seam_touchpoints:
      - { file: "nextjs-app/lib/csv/upload.ts", kind: "new" }
      - { file: "supabase/migrations/2026XXXX_csv_uploads.sql", kind: "new" }
    blocker_dependencies: [7]
    notes: |
      Real upload service writes to csv_uploads with row_count from parser.

  - n: 9
    target_test_id: T4                  # external CSV-validator contract
    layer: external
    role: inner-red
    tdd_or_verification: { tdd: true }
    predicted_seam_touchpoints:
      - { file: "tests/external/csv-validator.contract.test.ts", kind: "new" }
    blocker_dependencies: [8]
    notes: |
      Contract: CsvValidatorClient.validate(buffer) returns ValidationReport
      with the same row count. Mock-can-lie audit: this test runs against a
      real (or recorded) external service per ENG-4922 / ENG-4934 T1.

  - n: 10
    target_test_id: T4
    layer: external
    role: inner-green
    tdd_or_verification: { tdd: true }
    transformation_hint: { tpp_rank: 11 }
    predicted_seam_touchpoints:
      - { file: "nextjs-app/lib/csv/validator-client.ts", kind: "new" }
    blocker_dependencies: [9]
    notes: |
      Wire the client + happy-path response shape.

  - n: 11
    target_test_id: T5                  # code-integration: race — concurrent uploads
    layer: code-integration
    role: inner-red
    tdd_or_verification: { tdd: true }
    predicted_seam_touchpoints:
      - { file: "nextjs-app/tests/code-integration/csv-upload.test.ts", kind: "write" }
    blocker_dependencies: [10]
    notes: |
      failure_mode_class: race. Two concurrent uploads of same buffer must
      produce two distinct rows with correct row_count each (no last-writer
      wins on the mirror).

  - n: 12
    target_test_id: T5
    layer: code-integration
    role: inner-green
    tdd_or_verification: { tdd: true }
    transformation_hint: { tpp_rank: 6 }
    blocker_dependencies: [11]
    notes: |
      Compute row_count per-row at insert; do not read-modify-write a parent.

  - n: 13
    target_test_id: T7                  # contract-check: row_count write-site enumeration
    layer: code-integration
    role: contract-check
    tdd_or_verification: { tdd: true }
    blocker_dependencies: [12]
    notes: |
      Per ENG-5023: enumerate every write-site of csv_uploads.row_count
      (insert in upload service; admin-replay tool; backfill migration). One
      row in this step asserts each path keeps the mirror invariant.

  - n: 14
    target_test_id: T6                  # the outer e2e — flips green
    layer: e2e
    role: outer-green
    tdd_or_verification: { tdd: true }
    predicted_seam_touchpoints:
      - { file: "nextjs-app/app/upload/page.tsx", kind: "write" }
    blocker_dependencies: [13]
    notes: |
      Wire the UI to display row_count from the persisted upload. T6 should
      flip green with zero new business logic — only the read+display.

# Mutation pass — required because slice touches mirror invariant + external contract.
mutation_pass:
  required: true
  scope: |
    Confirm the test set catches representative bugs in the parser, the mirror
    invariant, and the external client.
  mutations:
    - id: M1
      target_file: "nextjs-app/lib/csv/parse.ts"
      target_function: "parseCsv"
      mutation: "Off-by-one: drop the last line silently."
      expected_to_be_caught_by: [T1, T3]
    - id: M2
      target_file: "nextjs-app/lib/csv/upload.ts"
      mutation: "Set row_count to a hardcoded constant 0."
      expected_to_be_caught_by: [T3, T7]
    - id: M3
      target_file: "nextjs-app/lib/csv/validator-client.ts"
      mutation: "Return cached row_count from a previous call instead of validating the buffer."
      expected_to_be_caught_by: [T4]
    - id: M4
      target_file: "nextjs-app/lib/csv/upload.ts"
      mutation: "Last-writer-wins: parent row's row_count overwrites on second concurrent insert."
      expected_to_be_caught_by: [T5]
```

---

## Notes on this example

- **Steps are odd-numbered red, even-numbered green** is a coincidence here — not a rule.
- **Step 6 is an explicit `inner-refactor`.** Mandate #6: refactor is mandatory-decision; if no refactor warranted, log a defer with reason in `events.jsonl` rather than silently skip.
- **`tdd: false` not used in this example.** The CSV slice has no pure-config or pure-CSS work. A real slice often has 1-2 such steps (e.g. adding a tsconfig path alias or a feature toggle row).
- **Step 14 has zero new business logic.** That's deliberate: outer-green confirms wiring, not invention. If outer-green needs new logic to flip, the inner cycles missed something.
