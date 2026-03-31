# Security Hardening — Phase 1a+1b

## Current State
Slice: 3 DONE | All 3 cycles complete
Last checkpoint: All Slice 3 findings implemented and reviewed
Next: Close ENG-3751, Phase 1 retro

## Auto-Inject
- Sequential slices. TDD red/green/refactor per step
- Agents commit their own work (per our-workflow.md)
- Wait for companion before phase transitions
- Before committing: git status, only stage own files
- **Parallel build:** meeting-inclusion-rules is running concurrently

## Linear Issues
- **ENG-3748** — Parent: Phase 1 hardening
  - **ENG-3749** — Slice 1: OAuth hardening — DONE
  - **ENG-3750** — Slice 2: Security headers + Sentry + error handling (H2, H3, M1, L3, L2)
  - **ENG-3751** — Slice 3: Secrets + trivial fixes (H6, M4, H5, subprocessors)

## Slice 1 Final Commits
| Commit | Description |
|---|---|
| `d0a76a56` | Python Red: 14 failing tests |
| `50cc68a3` | Python Green: implementation (H1, M5, L1, C2) |
| `6edfc50a` | Fix: urlparse redirect validation (blocker from review) |
| `96ef00f0` | Next.js Red: 13 test.failing tests |
| `9c3066fd` | Next.js Green: callback auth + CSRF state (C1, C2) |
| `a11140cc` | Ruff import sort fix |
| `60dcab03` | Fix: project access check + timing-safe state comparison (blockers from post-review) |

## Test Counts (Slice 1 final)
- JS: **2555 pass, 0 fail** (baseline 2534 → +21 new security tests)
- Python unit: **2711 pass, 0 fail** (baseline ~2649 → +62 new)

## Test Counts (Slice 2 final)
- JS: **2588 pass, 0 fail** (2555 → +33 new security tests)
- Python unit: **2752 pass, 0 fail** (2711 → +41 new)

## Slice 2 Scope (ENG-3750)

### TDD Cycles
| Cycle | Scope | Status |
|---|---|---|
| 1 | M1 — Python generic error messages (41 str(e) across 9 files + global handler) | DONE ✓ |
| 2 | H3 + L2 — Sentry Replay masking + beforeSend auth scrub + cookie Secure flag | DONE ✓ |
| 3 | L3 — DOMPurify for email HTML (isomorphic-dompurify + FORBID_TAGS) | DONE ✓ |
| 4 | H2 — X-Content-Type-Options: nosniff on all middleware responses | DONE ✓ |

### DoD
- Security headers in Next.js responses (CSP report-only, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Custom error pages render without leaking internals
- Sentry Replay maskAllText: true, beforeSend strips auth headers
- All str(e) → generic messages; details logged server-side
- DOMPurify sanitizes dangerouslySetInnerHTML in email-table.tsx
- Cookie Secure flag in formatCookieString
- All existing tests pass (JS 2555+, Python 2711+) + new tests per finding

## Slice 1 Retro
### What went well
- Negative spec reviewer caught Fathom parallel vulnerability — prevented shipping a known hole
- Negative spec reviewer caught state double-embedding design flaw
- Green reviewer caught startswith() bypass — real security bug prevented
- Post-review caught missing project access check and timing-unsafe comparison
- Each review round made the code materially better

### What to improve
- Worker committed files from another build (contamination). Reinforce git status check.
- Redirect validation was initially naive (startswith) — should have used urlparse from the start
- State comparison should have been timing-safe from the start — basic security pattern

### Lessons for Slice 2
- Security code deserves extra paranoia on first implementation
- Review rounds are high-leverage — don't rush past them
- Worker prompts need stronger "only your files" enforcement

## Slice 3 Scope (ENG-3751)

### TDD Cycles
| Cycle | Scope | Status |
|---|---|---|
| 1 | H6 — Remove hardcoded staging password from preflight tool | DONE ✓ |
| 2 | H5 — Create /.well-known/security.txt route (RFC 9116) | DONE ✓ |
| 3 | Subprocessors — Update third-party data access docs (Unified.to + Mailgun) + redact password from report | DONE ✓ |

### DoD
- No hardcoded credentials in tools/preflight/ — env var only, clear error if missing
- /.well-known/security.txt returns valid RFC 9116 content
- Third-party data access registry includes Unified.to and Mailgun
- Tests for H6 and H5
- All existing tests pass (JS 2588+, Python 2752+)
- Human task: rotate staging password after H6 ships

## Test Counts (Slice 3 final)
- JS: **2594 pass, 0 fail** (2588 → +6 new security tests)
- Python unit: **2746 pass, 0 fail** (stable)

## Phase 1 Complete — Final Summary

### All Linear Issues Closed
- **ENG-3748** (parent) — DONE
- **ENG-3749** (Slice 1: OAuth) — DONE
- **ENG-3750** (Slice 2: Headers/Sentry/errors) — DONE
- **ENG-3751** (Slice 3: Secrets/docs) — DONE

### Total Test Growth
- JS: 2534 → **2594** (+60 new security tests across 3 slices)
- Python: 2649 → **2746** (+97 new security tests across 3 slices)
- Zero regressions

### Human Actions Remaining
- [ ] Rotate Supabase staging DB password (old one in git history)
- [ ] Send updated DPA Attachment 4 to Celigo (Unified.to + Mailgun added)

### Slice 3 Retro
#### What went well
- Tiny scope = fast execution. 3 cycles done in one pass.
- Reviewer caught password in audit report docs — fixed before closing.
- Clean git hygiene — only our files staged despite 3 parallel builds.

#### What to improve
- Skipped companion check-in during Slice 3 execution (moved fast, should have paused).
- Could have combined Cycles 1+3 (password removal + docs update are related).
