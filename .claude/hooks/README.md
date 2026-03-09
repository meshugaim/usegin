# Claude Code Hooks

Hooks intercept tool calls before or after execution. Configured in `.claude/settings.json`.

## Architecture: Router Pattern

Each tool matcher has **one router file** that runs all checks in a single bun process.

```
settings.json matcher    →    router file         →    checks (functions)
─────────────────────────────────────────────────────────────────────────
Bash                     →    pre-bash.ts          →    block-commit-all
                                                        block-supabase-remote
                                                        auto-pull-before-push
                                                        prefer-wrapper-cli

Write|Edit               →    pre-write.ts         →    block-manual-migration-create
                                                        test-file-lint
```

### Why routers?

Each hook entry in settings.json spawns a bun process. Four separate Bash hooks = four processes per Bash call. One router = one process, same checks.

### Adding a new check

1. Pick the router for the tool you're targeting (`pre-bash.ts` or `pre-write.ts`)
2. Write a function matching the signature:
   - Sync: `(command: string) => CheckResult` (Bash) or `(input: ToolInput) => CheckResult` (Write/Edit)
   - Async: `(command: string) => Promise<CheckResult>` (Bash only — for checks that shell out)
3. Add it to the `syncChecks` or `asyncChecks` array in the router
4. Return `{ decision: "allow" }` or `{ decision: "deny", message: "..." }`

```typescript
// Example: block rm -rf /
function checkBlockRmRf(command: string): CheckResult {
  if (/\brm\s+-rf\s+\/(?:\s|$)/.test(command)) {
    return { decision: "deny", message: "⛔ BLOCKED: rm -rf /" };
  }
  return { decision: "allow" };
}
```

### CheckResult contract

```typescript
interface CheckResult {
  decision: "allow" | "deny";
  message?: string;  // stderr for deny, informational for allow
}
```

- **deny** → exit 2, block the tool call, message shown to agent
- **allow** → continue to next check (or exit 0 if last)
- First deny wins — remaining checks don't run

## Other hooks (not routed)

| File | Trigger | Purpose |
|------|---------|---------|
| `expose-session-id.sh` | SessionStart | Set SESSION_ID env var |
| `inject-workflow-reminders.ts` | SessionStart, Stop | Add workflow context |
| `spawn-ci-watcher-after-push.ts` | PostToolUse:Bash | Watch CI after git push |
| `prefer-opus-subagent.ts` | PreToolUse:Task | Suggest opus for subagents |
| `statusline.ts` | statusLine | Render status bar |

These are single-purpose and don't benefit from routing.

## Test file lint checks (pre-write.ts)

The test-file-lint check blocks three anti-patterns when writing `*.test.ts` files:

| Smell | Detection | Why it's bad |
|-------|-----------|-------------|
| `mock.module()` for application code | `mock.module("@/app/...\|@/lib/...\|@/hooks/...\|@/components/...")` | Permanent, process-wide. Use `spyOn` instead — it's reversible via `mock.restore()`. |
| `mock.module()` for setup.ts modules | Module path matches one already in `nextjs-app/tests/setup.ts` | Collides with the centralized mock. Use `globalThis.__mock*` overrides for per-test control. |
| `mock.module()` inside test blocks | `mock.module(` at ≥4 spaces indent after a `test(`/`it(`/`describe(` | Process-wide call that looks scoped but isn't. Every test in the process sees it. |

The setup.ts module list is read at runtime (not hardcoded) — adding a new `mock.module` to setup.ts automatically protects it.
