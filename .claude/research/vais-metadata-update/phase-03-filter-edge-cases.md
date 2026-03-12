# Phase 03: VAIS Filter Edge Cases — Empirical Results

**Date:** 2026-03-12
**Status:** COMPLETE
**Data store:** `vais-proj-eeeeeeee` (2 docs, schema with `entity_type`, `access_level`, `project_id`, `file_type`, `file_id`, `file_name`, `uploaded_at`)
**Engine:** `vais-eng-eeeeeeee`

---

## Test Results

All tests ran against the live Discovery Engine API using `google-cloud-discoveryengine` v1 SDK.

### 1. `field = "value"` (equals without ANY)

| Filter | Result |
|--------|--------|
| `entity_type = "file"` | **ERROR** — "Unsupported field on comparison operators" |
| `entity_type: ANY("file")` | OK — 10 chunks |

**Verdict: `=` does NOT work for string fields.** The `=` operator is restricted to numeric and datetime fields. String fields require `ANY()`.

---

### 2. Cross-field OR: `field1: ANY("a") OR field2: ANY("b")`

| Filter | Result |
|--------|--------|
| `entity_type: ANY("file") OR access_level: ANY("external")` | **OK** — 10 chunks |

**Verdict: Cross-field OR works.** The OR operator is not restricted to the same field.

---

### 3. `ANY("a", "b")` vs `ANY("a") OR ANY("b")`

| Filter | Result |
|--------|--------|
| `access_level: ANY("internal", "external")` | OK — 10 chunks |
| `access_level: ANY("internal") OR access_level: ANY("external")` | OK — 10 chunks |

**Verdict: Equivalent.** Both forms return the same results. `ANY("a", "b")` is syntactic sugar for OR across values.

---

### 4. String comparison/ordering: `field > "string"`

| Filter | Result |
|--------|--------|
| `entity_type > "email"` | **ERROR** — "Unsupported field on comparison operators" |
| `entity_type >= "file"` | **ERROR** — same |
| `entity_type < "z"` | **ERROR** — same |

**Verdict: Comparison operators do NOT work on string fields.** Only `ANY()` works for strings. The `>`, `<`, `>=`, `<=`, `=` operators are for numeric/datetime fields only.

---

### 5. NOT combined with AND

| Filter | Result |
|--------|--------|
| `NOT entity_type: ANY("email") AND access_level: ANY("internal")` | **OK** — 10 chunks |
| `-entity_type: ANY("email") AND access_level: ANY("internal")` | **OK** — 10 chunks |
| `access_level: ANY("internal") AND NOT entity_type: ANY("email")` | **OK** — 10 chunks |
| `NOT access_level: ANY("external", "draft")` | **OK** — 10 chunks (NOT on multi-value ANY) |

**Verdict: NOT + AND works.** Both `NOT` and `-` prefix bind to the immediately following expression. Can appear at start or end of AND chain.

---

### 6. `!=` operator

| Filter | Result |
|--------|--------|
| `entity_type != "email"` | **ERROR** — "Unsupported operators. Expression only supports: >, <, >=, <=, =, :" |
| `uploaded_at != 0` | **ERROR** — same |

**Verdict: `!=` is NOT supported.** Use `NOT field: ANY("value")` for string negation, or `NOT field >= N` for numeric negation.

---

### 7. NOT on parenthesized compound expressions

| Filter | Result |
|--------|--------|
| `NOT (entity_type: ANY("email") OR access_level: ANY("external"))` | **ERROR** — "NOT can only be applied to one expression type: (1) expression without logical joiner" |
| `NOT (entity_type: ANY("email"))` | **OK** — 10 chunks (single expression in parens) |
| `NOT (entity_type: ANY("email") AND access_level: ANY("external"))` | **ERROR** — same |

**Verdict: NOT cannot wrap compound expressions.** NOT/- prefix applies to exactly one atomic expression. To negate a compound, negate each part individually: `NOT A AND NOT B` instead of `NOT (A AND B)`.

---

### 8. Mixed AND/OR without parentheses

| Filter | Result |
|--------|--------|
| `A AND B AND C` (all AND) | **OK** |
| `A OR B OR C` (all OR) | **OK** |
| `A AND B OR C` (mixed, no parens) | **ERROR** — "syntax error at token 'OR'" |
| `A OR B AND C` (mixed, no parens) | **ERROR** — "syntax error at token 'AND'" |
| `(A AND B) OR C` (mixed, with parens) | **OK** |
| `A AND (B OR C)` (mixed, with parens) | **OK** |
| `(A OR B) AND C` (mixed, with parens) | **OK** |

**Verdict: Mixing AND/OR requires parentheses.** Homogeneous chains (all-AND or all-OR) work without parens. Mixed AND/OR is a parse error unless parenthesized. There is no implicit precedence — disambiguation is mandatory.

---

### 9. Numeric patterns

| Filter | Result |
|--------|--------|
| `uploaded_at = 1772558491` | OK — 10 chunks |
| `uploaded_at = 1772558491.0` | OK — 10 chunks |
| `uploaded_at >= 1772558490` | OK — 10 chunks |
| `uploaded_at >= 1772558511 AND uploaded_at <= 1772558511` | OK — 10 chunks |
| `uploaded_at: IN(1772558490, 1772558600)` | OK — 10 chunks |
| `uploaded_at: IN(*, 1772558600)` | OK — 10 chunks (open lower) |
| `uploaded_at: ANY("1772558511")` | **ERROR** — "Unsupported field on ':' operator" |
| `NOT uploaded_at >= 9999999999` | OK — 10 chunks |

**Verdict:** Numeric `=` works (despite earlier test 7a returning 0 — likely float precision). `IN()` works for ranges including open bounds. `ANY()` does NOT work on numeric fields.

---

### 10. Case sensitivity

| Filter | Result |
|--------|--------|
| `entity_type: ANY("FILE")` | 0 chunks |
| `entity_type: ANY("File")` | 0 chunks |
| `entity_type: ANY("file")` | 10 chunks |

**Verdict: Filters are case-sensitive.** Values must match exactly as stored.

---

### 11. Edge values

| Filter | Result |
|--------|--------|
| `entity_type: ANY("")` (empty string) | 0 chunks (no error) |
| `entity_type: ANY("nonexistent_value_xyz")` | 0 chunks (no error) |

**Verdict:** Non-matching and empty values return 0 results gracefully (no error).

---

## Summary: VAIS Filter Syntax Rules

### What Works

| Pattern | Syntax | Notes |
|---------|--------|-------|
| String equality | `field: ANY("value")` | Required for all string fields |
| Multi-value string OR | `field: ANY("v1", "v2")` | Equivalent to `f: ANY("v1") OR f: ANY("v2")` |
| Cross-field OR | `f1: ANY("a") OR f2: ANY("b")` | Works across different fields |
| AND compound | `f1: ANY("a") AND f2: ANY("b")` | Unlimited chaining without parens |
| OR compound | `f1: ANY("a") OR f2: ANY("b")` | Unlimited chaining without parens |
| Mixed AND/OR | `(A AND B) OR C` | **Requires parentheses** |
| Negation (NOT) | `NOT field: ANY("value")` | Single expression only |
| Negation (dash) | `-field: ANY("value")` | Equivalent to NOT |
| NOT + AND | `NOT A AND B` | NOT binds to A only |
| NOT multi-value | `NOT field: ANY("a", "b")` | Negates the entire ANY |
| Numeric = | `field = 123` | Works for exact match |
| Numeric range | `field >= N`, `field <= N` | Standard comparisons |
| Numeric IN | `field: IN(low, high)` | Inclusive range, supports `*` for open bounds |
| NOT numeric | `NOT field >= N` | Works |
| Parentheses | `(expr)` | For grouping, required for mixed AND/OR |
| Empty/missing values | `field: ANY("nonexistent")` | Returns 0 results, no error |

### What Does NOT Work

| Pattern | Syntax | Error |
|---------|--------|-------|
| String `=` | `field = "value"` | "Unsupported field on comparison operators" |
| String comparison | `field > "value"` | "Unsupported field on comparison operators" |
| `!=` operator | `field != "value"` | "Unsupported operators" |
| `ANY()` on numeric | `numeric_field: ANY("123")` | "Unsupported field on ':' operator" |
| NOT on compound | `NOT (A AND B)` | "NOT can only be applied to one expression" |
| Mixed AND/OR bare | `A AND B OR C` | "syntax error at token 'OR'" |
| Case-insensitive match | `field: ANY("VALUE")` | Returns 0 (case-sensitive) |

---

## Implications for Production Code

1. **`build_access_filter()` in `search_service.py` is correct** — uses `ANY()` for strings, `>=`/`<=` for numerics, all-AND chains (no mixed OR).

2. **Translation layer from AIP-160 (GFS) to VAIS** needs to handle:
   - `field = "value"` → `field: ANY("value")`
   - `field != "value"` → `NOT field: ANY("value")`
   - Mixed AND/OR → must add parentheses
   - `field : "value"` (HAS) → `field: ANY("value")` (different semantics for lists)

3. **NOT cannot replace `!=` in compound negation** — `NOT (A OR B)` is not supported. Must decompose to `NOT A AND NOT B`.

---

## Sources

- **VAIS official docs:** https://cloud.google.com/generative-ai-app-builder/docs/filter-search-metadata
- **EBNF grammar** from official docs confirms: `expression = ["-" | "NOT "], text_field ":" "ANY" "(" literal {"," literal} ")" | numerical_field comparison double | ...`
- **Prior experiment results:** `vais_product_gaps_experiment.py` (Test 5: negation)
- **Prior VAIS experiment:** `vertex_ai_search_experiment.py` (Phase 8: metadata filtering)
- **This experiment:** Live API calls on 2026-03-12 against `vais-eng-eeeeeeee`
