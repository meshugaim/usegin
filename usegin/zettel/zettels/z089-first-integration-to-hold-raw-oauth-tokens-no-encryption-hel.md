---
id: z089
title: first integration to hold raw OAuth tokens — no encryption helper exists
type: zettel
authored-by: usegin
threads: []
created: 2026-04-27
session: c2f48116-8355-4edf-969f-e9e85239cc46
---

ENG-5409 (AskEffi-Slack OAuth) is the first connection table that needs to
store raw provider tokens (`xoxb-` bot tokens) on our side. Drive / Linear /
Fathom all proxy through Unified.to and store only `unified_connection_id` —
Unified holds the tokens for us.

The migration ships a `bot_token_encrypted TEXT NOT NULL` column. The
callback writes the raw token there as a known-temporary measure. Column
shape is correct (opaque ciphertext); only what's written needs to change
when a helper lands.

Open question for Lihu: pgsodium / Supabase Vault / KMS / app-side AES-GCM
with a Railway-stored DEK? No precedent in the repo to copy. Capturing here
so we don't quietly normalize plaintext tokens — every future integration
that doesn't go through Unified inherits this gap.
