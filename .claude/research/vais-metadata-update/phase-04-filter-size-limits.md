# Phase 04: VAIS ANY() Filter Size Limits

**Date:** 2026-03-12
**Experiment:** `python-services/experiments/vais_filter_size_experiment.py`
**Run ID:** abb1cc58

## Question

How many values can a single VAIS `ANY()` filter clause contain before the API rejects it?

## Answer

**There is no ANY()-specific limit.** The only constraint is the gRPC request payload size limit of **10,485,760 bytes (10 MiB)**. The filter expression is part of the `SearchRequest` protobuf message, and if the entire serialized request exceeds 10 MiB, the API returns:

```
InvalidArgument: Request payload size exceeds the limit: 10485760 bytes.
```

### Practical limits for UUID-length values (36 chars)

With standard UUID values in `file_id: ANY("uuid1", "uuid2", ...)`:

| Values | Filter length | Status |
|--------|--------------|--------|
| 10 | 412 chars | OK |
| 100 | 4,012 chars | OK |
| 1,000 | 40,012 chars | OK |
| 10,000 | 400,012 chars | OK |
| 50,000 | 2,000,012 chars | OK |
| 100,000 | 4,000,012 chars | OK |
| 200,000 | 8,000,012 chars | OK |
| 262,139 | 10,485,572 chars | OK (ceiling via binary search) |
| 262,140 | 10,485,612 chars | REJECTED |

**Ceiling: ~262,139 UUID values** in a single ANY() clause (with 36-char UUIDs).

### Filter string length limits

The same 10 MiB payload limit applies. Tested with 10 values of increasing per-value length:

| Filter length | Status |
|--------------|--------|
| 99,952 chars | OK |
| 999,952 chars | OK |
| 9,999,952 chars | OK |
| 10,485,172 chars | OK (ceiling via binary search) |
| 10,485,782 chars | REJECTED |

**Ceiling: ~10,485,172 chars** total filter string length (with the rest of the request taking ~588 bytes).

### Latency at scale

No meaningful latency degradation as filter size grows (empty store, so no actual matching):

| Values | Latency |
|--------|---------|
| 10 | ~1.5s |
| 10,000 | ~2s |
| 100,000 | ~11s |
| 200,000 | ~15s |
| 262,139 | ~18s |

Note: latency at high counts is dominated by serialization/transfer, not filter parsing. With actual documents, search latency would be additional.

## Implications for Effi

- A single Effi project will never have 262K files. Even 10K would be extreme.
- **No need to paginate or batch ANY() filters for file_id access scoping.** A single filter clause can hold all file IDs for any realistic project.
- The 10 MiB limit is a standard gRPC message size limit, not a VAIS-specific restriction.
- If a future use case required >260K values, the mitigation would be to split across multiple search requests.

## Method

1. Created a minimal DataStore + Engine with `file_id` as an indexable string field (no documents uploaded)
2. Sent `SearchRequest` with `file_id: ANY("uuid1", ..., "uuidN")` for increasing N
3. 0 results = accepted (filter parsed OK). Error = rejected.
4. Binary searched between last-accepted and first-rejected to find exact ceiling.
5. Repeated for filter string length (10 values with very long per-value strings).
6. Cleaned up DataStore + Engine.
