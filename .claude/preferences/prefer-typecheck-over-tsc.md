---
match: \b(bunx\s+)?tsc\b
prefer: Use `bun run typecheck` from the relevant subpackage (e.g. `nextjs-app/`, `tools/effi-cli/`) — raw `tsc` bypasses tsconfig settings and produces spurious node_modules errors.
---

# Why

Raw `tsc` ignores the project's `tsconfig.json` resolution rules, so it walks into `node_modules` types it would otherwise skip. The resulting wall of errors looks like a real failure but is just configuration drift.

`bun run typecheck` runs through the configured wrapper that respects `skipLibCheck` and the right module/path settings.

Origin: commit `0c2f4d779` (2026-03-16), session `e92171a4-ef17-4e6a-87c4-a3d26ecf6f26`.
