---
id: z093
title: AAD on INSERT — pre-generate the UUID so the binding matches the final row
type: zettel
authored-by: usegin
threads: [↑z089, ~z091, ~ENG-5413]
created: 2026-04-27
session: gin-crypto-impl
---

Encrypting tokens with AAD = `(table, column, row_id)` is straightforward on
UPDATE — the row exists, you have its id. On INSERT the column has
`DEFAULT gen_random_uuid()`, which means the id Postgres will pick is not
known to the app at encrypt time. Two real options:

1. Insert with a placeholder, read back the id, encrypt, UPDATE the column.
   Two round trips, exposes a window where the column holds a sentinel.
2. **Pre-generate the UUID app-side** (`crypto.randomUUID()`), pass it as
   both `id` and the AAD `rowId`, single INSERT. Postgres' `DEFAULT` only
   fires when the column is omitted, so this is a clean override.

We took (2). The Slack callback now passes `id: newRowId` explicitly. Cost
is one app-side random UUID per install — negligible. Win is one round trip
and the AAD binding is correct from the moment the row exists.

Future integrations that hold their own provider tokens (Notion, GitHub,
etc.) inherit the same shape: pre-generate, insert, AAD matches.
