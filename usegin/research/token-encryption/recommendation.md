# Token-encryption posture — recommendation

## Trigger
z089 surfaced that AskEffi-Slack (ENG-5409) is the first integration holding raw provider tokens (`xoxb-`) in our DB. Drive (`drive_integration`), Linear (`linear_integration`), Fathom (`meeting_tables`) all defer to Unified.to and store only `unified_connection_id` — verified across `supabase/migrations/`. The new `slack_installs.bot_token_encrypted TEXT NOT NULL` column currently accepts raw text. Decide the helper before C ships and before Notion/GitHub/etc. replicate the gap.

## Decision needed
Which encryption strategy gates writes to `slack_installs.bot_token_encrypted` (and every future `*_token_encrypted` column)?

## Options
1. **pgsodium** — Supabase-native column encryption / TCE.
2. **Supabase Vault** — libsodium-backed secret table, decrypted via SQL view.
3. **External KMS** — AWS/GCP KMS, app-layer envelope encryption (KMS-wrapped DEK).
4. **App-side AES-GCM** — custom helper, key in Railway sealed env var (or KMS-fetched at boot).

## Comparison matrix

| Dimension | pgsodium | Supabase Vault | External KMS | App-side AES-GCM |
|---|---|---|---|---|
| Key management | Server-managed | Supabase-managed (libsodium) | AWS/GCP-managed | We hold DEK in env |
| Rotation | Manual / docs sparse | `vault.update_secret()` (no built-in versioning) | Automatic annual rotation | Manual re-encrypt all rows |
| RLS interaction | Column-level, fine | Vault-table RLS + view; tenant-row indirection | Opaque ciphertext, RLS unchanged | Opaque ciphertext, RLS unchanged |
| Ops surface | Postgres-only | Postgres-only | +1 cloud account, IAM, network | Postgres-only |
| CI/test ergonomics | Requires extension in test DB | Requires extension; staging branch supports it | Mock in tests; LocalStack for KMS | Trivial — fixture key |
| Subprocessor / DPA | None added (Supabase already listed) | None added | **Adds AWS or GCP as subprocessor** | None added |
| Migration cost (raw → encrypted) | Backfill UPDATE w/ `pgsodium` fn | Backfill: write rows to `vault.secrets`, swap column to UUID FK | Backfill UPDATE w/ encrypt call | Backfill UPDATE w/ helper |
| Status | **Pending deprecation** (Supabase docs explicitly say "do not adopt") | Recommended successor; interface stable | Mature, expensive in process terms | Mature, all-on-us |

## Lean
**(4) App-side AES-GCM with the DEK in a Railway sealed env var, structured so we can swap to KMS-wrapped DEK later without changing call sites.**

## Why
- pgsodium is **explicitly deprecated** by Supabase ("DOES NOT RECOMMEND any new usage"). Adopting it now is debt-on-day-one.
- Supabase Vault is the right shape for *application-level* secrets (one webhook signing key, etc.), not for **per-tenant rows** of OAuth tokens — every install would need a `secret_id` indirection and a join through `vault.decrypted_secrets`. The view-based decrypt also means the DB sees plaintext on every read, which buys little over column-level AES-GCM with the DEK in env.
- External KMS is the strongest control but adds **a new subprocessor on the DPA** (`docs/security/reports/2026-04-02-subprocessor-inventory.md` is currently AWS-free) and forces an AWS/GCP account decision Lihu hasn't made. Premature commitment.
- App-side AES-GCM keeps ciphertext opaque to Postgres (matches the existing column shape exactly), keeps the DEK out of the DB, costs zero new subprocessors, and has trivial test ergonomics (fixture key per-test). When we later want hardware-rooted key custody, the helper's interface (`encrypt(plaintext) → ciphertext`) is identical — only the key-fetch path changes.
- Convergent with current posture: Doppler already injects secrets into Railway (`subprocessor-inventory.md` notes "internal development tooling"), Railway sealed vars are encrypted-at-rest-and-write-only, Supabase encrypts at rest by default. Our weakest link is *not* the DEK's storage — it's that we have no ciphertext at all today.

## Price
- ~1 day to build `python-services/lib/token_crypto.py` (encrypt/decrypt, AES-256-GCM, random nonce per row, AAD = `(table, column, row_id)`), wire into Slack callback, write the backfill stanza, add `TOKEN_ENCRYPTION_KEY` to Railway sealed vars + Doppler.
- One-time key-generation ceremony (Lihu generates, pastes into Doppler, never logged).
- A "rotate the DEK" runbook we'll need eventually (read all → re-encrypt with new DEK → write all). Cheap to write, defer until we actually rotate.

## Risk
- DEK compromise = all tokens compromised. Mitigations: Railway sealed-var visibility (write-only in UI), Doppler audit log, no DEK in source/logs, rotate on suspected breach.
- "Why not KMS?" on a security questionnaire. Honest answer: KMS is the v2 upgrade; the helper interface is identical; we'll switch when we have an AWS account for other reasons.
- pgsodium-fans on the team (none observed) might re-litigate. Pin this doc.

## Default sequence
1. **Now (ENG-5410 follow-up slice):** ship `token_crypto.encrypt/decrypt` helper + `TOKEN_ENCRYPTION_KEY` env var + Slack callback uses it. Backfill any rows written raw between now and then. (~1 day.)
2. **At first non-Slack direct integration (Notion / GitHub / etc.):** reuse the same helper, no new column shape, no new code path.
3. **When we adopt AWS for any reason** (or hit a customer who requires HSM-rooted custody): swap helper internals to KMS-envelope (KMS wraps the DEK; DEK cached in process). Call sites unchanged. Add AWS to DPA at that point.
4. **Never:** introduce pgsodium. If a future reviewer reaches for it, point them here.

## For Lihu to weigh
- **The KMS deferral.** Picking (4) means we ship without an HSM-rooted root-of-trust. Acceptable for pilot/SMB; a Fortune-500 questionnaire may demand KMS. If you want KMS day-one, say so and we add AWS to the subprocessor inventory before Slack ships.
- **Key generation ceremony.** You generate `TOKEN_ENCRYPTION_KEY` (32 random bytes, base64), paste into Doppler/Railway, and confirm it never lands in chat/git/logs. I will not generate it.
- **Rotation cadence.** Default proposal: rotate on suspected compromise + annually. Confirm or override.
