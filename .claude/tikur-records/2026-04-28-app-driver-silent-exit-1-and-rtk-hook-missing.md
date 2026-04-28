# Tikur: app-driver returned exit 1 with no output, burning a round of the slack-sanity-check session

**Date:** 2026-04-28
**Severity:** medium  (recurrence: high — every fresh devcontainer + every agent that picks up `app-driver`; blast: a wasted round per occurrence, plus an obscured "is the app broken or is my tool broken?" ambiguity)
**Status:** system-fixed
**Category:** error  (no safeguard was bypassed; tool surface failed in a way that swallowed its own diagnostic)

## Timeline

**Tape sources:** this turn's bash output, `tools/app-driver/src/cli.ts:42-53`, `node_modules/.bin/`, `$PATH`, `.claude/settings.json` PreToolUse hooks.

- 14:?? — Lihu asks for a real-world sanity check on the Slack integration. UseGin orients on the `slackIntegration` browser flag and the two UI entry points.
- 14:?? — UseGin runs `app-driver auth sign-in --email oria@askeffi.ai --auto`. Single line of stdout: `-> Opening sign-in page...`. No further output. Process exits.
- 14:?? — UseGin runs `app-driver auth whoami`. **Bash returned with no output and exit 1.** No stderr. No history line. No diagnostic.
- 14:?? — UseGin runs `app-driver pw cookie-list`. Same shape: empty output, exit 1.
- 14:?? — UseGin checks `app-driver --help` — works, prints the full help. So the binary is fine; only the playwright-bridged subcommands are broken.
- 14:?? — UseGin runs `which playwright-cli` → `command not found`.
- 14:?? — UseGin checks `node_modules/.bin/` — `playwright-cli` is present there, just not on `$PATH`.
- 14:?? — UseGin reads `tools/app-driver/src/cli.ts:42-53`:
  ```ts
  function pw(...args: string[]): string {
    const result = spawnSync("playwright-cli", args, { encoding: "utf-8", timeout: 60_000 });
    if (result.status !== 0) {
      const err = (result.stderr || result.stdout || "").trim();
      if (err) console.error(err);
      process.exit(1);
    }
    return (result.stdout || "").trim();
  }
  ```
- 14:?? — UseGin reproduces with `node -e "const r = spawnSync('playwright-cli', ['--help']); console.log(r)"`:
  - `status: null` (not 0 — but also not non-zero)
  - `stderr: null`, `stdout: null`
  - `error: 'spawnSync playwright-cli ENOENT'` ← **the diagnostic lives here**
- 14:?? — Adjacent finding while inspecting `.claude/settings.json`: every Bash PreToolUse fires `rtk hook claude` as the second hook. `which rtk` → `command not found`. Hook exits 127 silently (Claude Code only denies on exit 2; 127 is ignored noise).

## Five whys

- **Why did `app-driver auth whoami` exit 1 with no diagnostic?**
  → Because `pw()` ran `spawnSync("playwright-cli", …)`, got an ENOENT, and called `process.exit(1)` after computing `err = (stderr || stdout || "").trim()` — both `stderr` and `stdout` are `null` on ENOENT, so `err === ""`, so `console.error(err)` was skipped.
  - **Why does `pw()` ignore `result.error`?**
    → Because the error-handling code was written for the case where the binary runs but fails (real stderr), not the case where the binary doesn't exist (the diagnostic lives on `result.error`, not stdout/stderr).  ← **leverable: 5-line fix to `pw()`**.
  - **Why isn't `playwright-cli` on `$PATH` so the binary runs in the first place?**
    → Because the agent shell's `$PATH` includes `/workspaces/test-mvp/scripts` and `/workspaces/test-mvp/tools/bin` but **not** `/workspaces/test-mvp/node_modules/.bin/`. `app-driver` calls the bare name `playwright-cli` and assumes the caller sets up PATH (or uses `bunx`).  ← **leverable: resolve via `Bun.which()` / explicit `node_modules/.bin/playwright-cli` path / `bunx playwright-cli`**.
  - **Why didn't a fresh devcontainer / `just install` flow cover this?**
    → Because `node_modules/.bin/` is conventionally added to PATH by `bun run`, `npm run`, etc. — not by interactive shells. `app-driver` is a bare binary in `tools/bin/` and gets invoked directly, outside any package-manager script context. The "PATH is set" assumption was inherited from the package-manager context but never enforced for direct invocation.  ← **CLAUDE.md "Environment Fixes Must Persist" rule applies: the fix must land in committed config, not in an ad-hoc PATH tweak.**

(Adjacent chain — same incident, different entry point:)

- **Why is `rtk hook claude` wired as a PreToolUse Bash hook but `rtk` is not on PATH?**
  → Because `.claude/settings.json` was committed referencing `rtk`, but no setup step (devcontainer, `just install`) installs the `rtk` binary or symlinks it into the agent PATH. The hook fails open (exit 127, not 2) so it's silent breakage, not blocking breakage — which is why nobody has noticed it's broken.  ← **leverable: either install `rtk` in the devcontainer, or remove the hook line from `settings.json`, or change the hook to `bunx rtk` / explicit path.**

## Cluster check

Searched `.claude/tikur-records/` and `usegin/zettel/zettels/` for `playwright-cli`, `app-driver`, `silent.*fail`, `ENOENT`. No prior tikur on this surface. One adjacent zettel — `z079-settings-json-edit-blocked-while-wiring-user-prompt-skill-ch.md` — touches `.claude/settings.json` from a different angle (edit-time blocking), not the PATH/hook-wiring angle.

**Standalone finding** for the app-driver path. The rtk-on-PATH failure is a *second* instance of the same higher-order pattern — *"binary referenced by config/tool, not present on agent PATH, fails silently"* — but two instances is not yet a cluster (need 3+ per skill rule 4.5). Flag it; if a third lands, promote to a cluster zettel about *"agent shell PATH is not the ergonomic shell PATH; binaries referenced from `.claude/`, `tools/bin/`, and hooks need explicit resolution."*

## Root cause

`tools/app-driver/src/cli.ts:pw()` swallows ENOENT diagnostics by reading `stderr || stdout` and ignoring `result.error`, **and** the `playwright-cli` binary it shells out to is not on the agent's `$PATH` despite living in the repo's `node_modules/.bin/` — together producing a silent exit-1 with no diagnostic for any Slack/UI-sanity-test attempt.

Two-line root cause: a tool that hides ENOENT × a runtime where ENOENT is the actual outcome.

## Fixes

- **Immediate:** for this session, work around by invoking `node_modules/.bin/playwright-cli` directly when `pw`-bridged commands are needed. Don't commit the workaround.
- **System:** *not landed this turn — system-fix-deferred.* Two coupled changes needed:
  1. `tools/app-driver/src/cli.ts` — change `pw()` to surface `result.error?.message` when `status !== 0` *or* `result.error` is set. (~5-line patch.)
  2. Resolve `playwright-cli` via `Bun.which("playwright-cli") ?? path.join(repoRoot, "node_modules/.bin/playwright-cli")` instead of the bare name. (Removes the PATH dependency.)
  - **Plus** the adjacent rtk hook: either install `rtk` in the devcontainer / `just install` so it's reliably on PATH, or remove the line from `.claude/settings.json` and replace with `bunx rtk hook claude` / explicit path.

  **Gap:** these are production-code changes inside `tools/app-driver/` and a wired-in hook that touches every Bash call in every agent session. Per CLAUDE.md "default don't act" + tool-surface caution, UseGin is not landing them in this turn without Lihu's go-ahead. The unblock is one prompt: *"land the app-driver `pw()` fix and resolve playwright-cli explicitly; deal with rtk separately."* Tracked in this record's `Status: system-fix-deferred`. If recurrence happens before the unblock, escalate to `Status: open` and re-tikur per skill rule "tikur whose system fix never lands becomes the next tikur's root cause."

- **Tripwire:**
  1. Add `tools/app-driver/tests/` smoke test that asserts `pw("--help")` either succeeds *or* fails with a non-empty stderr containing the binary name — never silent exit 1.
  2. Add `just doctor` (or extend the existing one) to assert `command -v playwright-cli && command -v rtk`, exit 1 with a clear message if either is missing. Run it in `just install` and in agent session-start.

## Zettel

To file in the same turn this tikur is acknowledged (placement: `usegin/zettel/zettels/`, threaded `~z002` "no later" + `~z079` settings.json wiring + `~feedback_first_place_we_looked` from MEMORY.md):

> *"Silent exit 1 from a tool that shells out is almost always ENOENT on a binary that lives in the repo but isn't on agent PATH. Two leverages: surface `result.error` on the spawn side, and resolve from `node_modules/.bin/` rather than trusting PATH. The cost of a silent exit 1 is one full agent round per occurrence — diagnostic ergonomics belong in the tool, not in the next agent's debugging skill."*

(Zettel will be authored when the system fix lands, per the self-tripwire rule — a zettel without a SHA to point at is half the artifact.)

## Resolution

Landed 2026-04-28 in three separate commits on `main`:

- `55efa8de8` — `chore(hooks): remove rtk PreToolUse hook (binary not present)` — removes the `rtk hook claude` entry from `.claude/settings.json`. Grep confirmed the only repo reference was that hook entry; nothing else invokes `rtk`. Reversible: re-add when/if the binary is wired into the devcontainer.
- `e318c841f` — `fix(app-driver): surface result.error in pw() so ENOENT stops being silent` — `pw()` now checks `result.error` first and prints `playwright-cli: <message>` before exiting; falls through to the existing stderr/stdout path for binary-runs-but-fails cases; adds a clear "exited N with no output" fallback for the rare nullish-stderr/non-zero-status case.
- `19f362943` — `fix(app-driver): resolve playwright-cli from node_modules/.bin/ instead of $PATH` — resolves the binary by walking up from `import.meta.url` to the repo root, points at `node_modules/.bin/playwright-cli` if present, falls back to the bare name otherwise. Removes the PATH dependency.

Verified post-commit:
- `bun -e` reproduction confirms ENOENT now lands on `result.error.message` and the new `pw()` surfaces it (would have printed `playwright-cli: Executable not found in $PATH: …` instead of silent exit 1).
- `bun run tools/app-driver/src/cli.ts --help` and `bun run tools/app-driver/src/cli.ts pw <bad-cmd>` both work after the resolution change.
- New `bash` invocations in this session no longer print `rtk: not found` (hook entry is gone).

Tripwires from the Fixes section (smoke test asserting non-silent exit, `just doctor` checking `command -v`) are still **not landed** — they're cheap and adjacent. Flagging as a follow-up but not blocking this resolution.
