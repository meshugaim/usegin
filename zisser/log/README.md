# log/

Running ledger of what Lihu said, when, and where it went. One file per
month: `<YYYY-MM>.md`. Append-only.

## Shape

Each entry is one block:

```markdown
## 2026-04-27 10:42 — <short topic>

Lihu (verbatim or near-verbatim): "..."

Routed to:
- <location>
- <location>

Notes: <if any — e.g., "spawned Gin with charter dispatched/foo.md">
```

## Why

- Cross-session continuity. Future Zisser-instances read the recent log to
  rebuild context.
- Audit trail. Lihu can scan for "what did I say about X last week".
- Pattern detection. Recurring pours surface as repeated entries — that's
  signal for what to systematize.

## Posture

- **Append-only.** Never delete an entry. If the routing was wrong, append a
  correction with a backlink.
- **Don't over-edit.** The raw form is the value. Polish later if at all.
