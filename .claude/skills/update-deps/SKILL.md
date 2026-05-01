---
name: update-deps
description: Update dependencies across the entire monorepo. Triggered by "update deps", "upgrade dependencies", "refresh deps", "dependency update", or "let's update deps".
---

# Update Dependencies

Update all dependencies across the monorepo. Every package manager, every sub-package, every lockfile.

## Before Starting

1. **Discover the current shape.** Scan the repo for all `package.json`, `pyproject.toml`, lockfiles, GitHub Actions workflows (`.github/workflows/*.{yml,yaml}`), and any other dependency manifests. The repo is a monorepo — there are sub-packages, tools, apps, and test suites scattered across it. Find all of them. Don't just check the obvious apps — check `tools/`, `tests/`, and `experiments/` too. Every `pyproject.toml` and `package.json` is a separate upgrade target.

2. **Check dependabot PRs early.** Run `gh pr list --label dependencies` during discovery. Dependabot PRs reveal pinned versions and version range constraints that `bun update`/`uv lock --upgrade` can't fix. Incorporate them into the plan rather than discovering them halfway through.

3. **Flag pinned versions — and understand *why*.** `bun update` only bumps within version ranges. Exact pins without `^` or `~` (e.g., `"react": "19.2.4"`, `claude-agent-sdk==0.1.56`) need manual edits, so they'd otherwise be silently skipped.

   Don't just list the pins — figure out *why* each one is pinned. Some pins are intentional (lockstep ecosystems like `react`/`react-dom`, or Storybook packages, where sibling versions must match exactly) and need coordinated bumps. Others are incidental (dependabot's default write behavior) and bump like anything else. The reason determines the bump strategy, so call it out in the plan.

   **Read the Known Constraints section (bottom of this file) first.** It records durable root reasons from prior runs — validated breakages, upstream pin chains, lockstep pairs. If a package listed there still applies today, reuse the reason instead of re-deriving it. If a constraint has been lifted (e.g., upstream shipped a release that removes the bound), delete the entry. If you discover a new one, add it. Treat that section like a live file — the skill gets more useful every run.

4. **Build a plan.** Group what you found into logical stages (e.g., by app, by package manager, by risk level). Patches and in-range bumps first, majors later.

5. **Present the plan to the user.** Lead with two tables — never a prose summary. Wait for approval before executing.

   **Table 1 — Will bump.** One row per (package, component) pair. Columns:

   | Package | Component | Current → Latest | Kind | Direct? | Notes |
   |---|---|---|---|---|---|

   - `Component` = the manifest path that owns it (e.g. `nextjs-app/`, `python-services/`, `tools/fathom/`, `/package.json` for the root). Never aggregate ("python") — name the file.
   - `Kind` = `patch` / `minor` / `major` / `date` / `dev rev` (for things like `@typescript/native-preview` daily previews).
   - `Direct?` = `yes` if declared in that component's `package.json`/`pyproject.toml`, `transitive` if only present via a parent. This decides whether the bump path is a manifest edit or a lockfile resolve.
   - `Notes` = pin style (`==`, no-caret), in-range constraint, lockstep siblings, or "manual edit required."

   **Table 2 — Will NOT bump.** Same shape minus `Kind`/`Direct?`, plus a `Reason` column. Every skipped item gets a row. **The reason must be the root cause, not a description of the pin.** "Capped at <6 in pyproject.toml" is a *description of the pin*; "v6 broke encoding detection — cap added in commit X (issue Y) by prior deps update" is the *root reason*. For each skipped item, dig until you have one of these:

   - **Upstream constraint** — cite the constraining package, version, and the constraint string. Don't guess from the dep tree; prove it. For Python, `uv lock --upgrade-package 'X>=N'` will print the resolver's exact rejection chain. For JS, `bun why X` plus `bun update X --latest --dry-run` (or attempting the bump in a worktree). Quote the constraint verbatim.
   - **Validated breakage** — cite the commit that added the cap and (if available) the session/issue context. Use `session code-history <file>:<line>` to surface the *intent* behind the cap, not just `git blame`. Quote the commit message line that explains the breakage.
   - **Lockstep / pinned-and-current** — name the sibling that must move with it (e.g. `react` ↔ `react-dom`).
   - **Major-bump-deferred** — only acceptable if you've explicitly checked release notes and found behavior changes; otherwise, do the resolver/release-notes check now rather than punting with "major, defer."

   No silent skips. No descriptions-masquerading-as-reasons.

   After the tables, list the stages in execution order. Keep prose minimal — the tables are the artifact.

## How to Work

- **Small steps.** One logical change at a time. Commit and push after each. Don't batch unrelated updates.
- **In-range first, then majors.** Patches are safe to batch per area. Major bumps get their own commit — research breaking changes before upgrading.
- **Verify after every change — for real.** Every bump, including patches. Run the area's typecheck, lint, and test suite. "It installs" is not verification; neither is "it's just a patch." Package authors ship regressions in patch versions too. If you find pre-existing test failures or typecheck errors along the way, fix them — leave the codebase cleaner than you found it.
- **For Python, run integration tests too, not just unit.** The bumps most likely to regress (SDKs, database drivers, HTTP clients) only show their behavior at the integration boundary. Unit tests don't exercise them. If integration tests are slow, that's the cost — budget for it.
- **Call out what you couldn't verify.** Things like GitHub Actions bumps or changes to throwaway experiments can't be locally tested. Say so explicitly in the commit body or PR description — "verified on next CI run" is honest; silence reads as "I tested this" and isn't true.
- **Run from a worktree pushing to main** (the `worktree-to-main` skill). Dep sweeps span many files, run for hours, and lockfile churn collides badly with whatever other agents are doing on main. The main worktree must stay on main per `feedback_main_wt_stay_on_main.md` — set up `git worktree add -b deps-<date> /tmp/wt-deps-<date> origin/main`, work there, push `HEAD:main`, clean up the worktree at the end.
- **Track in Linear** via `plan` — parent issue for the overall effort, sub-issues per stage.

### Python-specific

- **`uv lock --upgrade` updates the lockfile but doesn't install.** Always follow with `uv sync`. Otherwise `uv pip list --outdated` still shows old versions and you think nothing changed.
- **Understand upstream constraints before reporting skips.** `uv pip list --outdated` shows ALL installed packages including transitive deps. Many are blocked by upstream constraints. Use `uv tree --package X --invert` to see why a package can't upgrade — say "blocked by pyiceberg requiring cachetools<7" not just "skipped."
- **Each Python tool is independent.** Tools with their own `pyproject.toml` + `uv.lock` (e.g., `tools/fathom/`, `tools/gmail/`) have separate dependency trees. Upgrade each one individually.
- **Raise `>=` floors in `pyproject.toml` after a successful lockfile bump.** `uv lock --upgrade` only writes the new version into `uv.lock` — the manifest's `>=X.Y.Z` floor stays at the old number. Dependabot reads the manifest, sees the stale floor, and opens a PR per package to raise it (10 redundant PRs after the 2026-04-30 run — see commits `65111550e`, `8b9159e8d`, `053752573`). After verifying a bump works, sync the floor to the locked version so dependabot stops re-opening the PR. Do this **only for applications** (`python-services/`, `tools/*` — anything not published to a registry). For library packages consumed by external code, raising the floor tightens downstream constraints; leave those alone and note the package is a library in the commit body.

  There's no single uv flag for this — `uv lock` won't touch `pyproject.toml`, and `uv add <pkg> --bounds lower` is a no-op when the existing `>=` already satisfies the resolved version (uv sees the constraint is met and skips the rewrite). What works is feeding the locked version back as an explicit specifier. Loop over the direct deps that just bumped:

  ```bash
  # for each package <pkg> that uv lock --upgrade moved:
  LOCKED=$(awk -v p="$pkg" '$0 == "name = \""p"\"" {getline; sub(/.*"/,""); sub(/"$/,""); print; exit}' uv.lock)
  uv add "$pkg>=$LOCKED"
  ```

  This rewrites the existing entry in `pyproject.toml` to `<pkg>>=<locked-version>` without re-resolving. Run after `uv sync` + tests pass — never raise a floor for a version you haven't validated.

### JS-specific

- **Clean stale generated files.** Next.js `.next/types/` can have stale references to deleted routes. Clean before typechecking: `rm -rf .next/types .next/dev/types`.
- **Check version overrides.** Some packages have `"overrides"` in package.json that can go stale after updates. Align them with the actual dependency versions.

### GitHub Actions

- **Audit `.github/workflows/*.{yml,yaml}` too.** Extract every `uses: <repo>@<ref>` and check for new majors with `gh release view --repo <repo> --json tagName -q '.tagName'`. There's no `bun outdated` equivalent — you have to walk the list.
- **Floating major refs (`@v6`) auto-track minor/patch — only majors need action.** A bump from `@v5` → `@v6` is the only meaningful diff most runs will surface.
- **Flag exact-pinned actions.** `uses: org/action@1.2.3` (no `v` prefix or full SHA) won't auto-track — call them out the same way you'd call out a `==` python pin. Either keep the pin (note why) or convert to floating major.
- **Can't be locally verified.** Workflow changes only run in CI. Say so explicitly in the commit body — "verified on next CI run."

### Dependabot PRs

- **Close dependabot PRs when superseded.** After applying changes manually on main, close the corresponding dependabot PRs with a comment explaining what was done. Otherwise they clutter the PR list.

## What "Done" Looks Like

- Every dependency manifest audited — nothing silently skipped.
- `bun outdated` clean across all JS areas.
- `uv pip list --outdated` clean for Python areas (or remaining items explained with specific upstream constraints).
- No uncommitted lockfile drift.
- Dependabot PRs closed or addressed.
- Pre-existing issues found along the way are fixed (broken tests, stale configs, redundant overrides).
- Linear issue closed.
- **Known Constraints section (below) reconciled** — stale entries removed if upstream lifted them, new entries added for anything newly discovered. Each entry still cites concrete evidence (commit, resolver output, or sibling version), not "we think" reasoning.

---

## Known Constraints (live)

Durable knowledge about *why* specific packages don't bump. Updated at the end of every run. Read before building Table 2 ("Will NOT bump") — if an entry here still matches the current resolver/commit state, reuse its reason verbatim instead of re-deriving. When an entry no longer applies (upstream shipped a compatible release, cap got lifted, package got removed), delete it — stale entries here poison future runs.

Each entry states: the package, the component it lives in, the constraint, the **root reason** (not a pin description), and evidence (commit SHA, resolver error, or upstream dep string). Keep entries tight — this is a lookup, not a changelog.

### `python-services/`

**`supabase` is the common choke point — but NOT the unblock we hoped for.** Three of the five transitive caps below (`cachetools`, `rich`, `websockets`) all trace back to `supabase` via its own pinned sub-deps (`storage3`→`pyiceberg`, and `realtime`). 2026-04-30 update: bumped supabase 2.28.3 → 2.29.0 — `realtime==2.29.0` still pins `websockets<16`, and `pyiceberg` in the new chain still requires `cachetools<7` and `rich<15`. So the choke point survived a minor bump. PyPI has `3.0.0a1` pre-release. Re-check after each supabase stable.

- **`chardet` — capped `<6` (python-services/pyproject.toml:20).** *Validated breakage.* chardet v6+ broke our encoding detection. Cap added 2026-04-07 in `3f77e2dd` (ENG-4584) by prior deps-update session: *"Pinned chardet<6 (v7 breaks encoding detection)"*. Latest is `7.4.3` (2026-04-30). Keep capped until someone re-validates ≥6 against real inputs. **Not a supabase dependency.**
- **`cachetools` — stuck at 6.x (transitive). Latest `7.0.6`.** `pyiceberg>=0.10.0` requires `cachetools<7` (chain: `supabase` → `storage3` → `pyiceberg`). Verified sole path via `uv tree --package pyiceberg --invert`. Confirmed 2026-04-30: supabase 2.29.0 still pulls the same pyiceberg constraint. Unblock: pyiceberg release that moves the cap, or supabase stable that pins newer pyiceberg.
- **`rich` — stuck at 14.x (transitive). Latest `15.0.0`.** `pyiceberg>=0.10.0` requires `rich>=10.11.0,<15.0.0` (supabase chain). `tach@0.34.1` (dev) also bounds `rich<15` via `rich>=13.5.2,<15.0.0` — both caps must lift for rich to move.
- **`websockets` — stuck at 15.x (transitive). Latest `16.0`.** `realtime==2.29.0` requires `websockets>=11,<16`; `supabase==2.29.0` pins `realtime==2.29.0`. Verified 2026-04-30 via dry-run resolver: bumping supabase 2.28.3 → 2.29.0 did NOT lift this cap (the resolver still rejects `websockets>=16`). Newer realtime versions exist with `websockets>=16` but supabase doesn't pin them yet. Pure supabase-stable-bump unblock.
- **`protobuf` — stuck at 6.x (transitive). Latest `7.34.1`.** `google-cloud-aiplatform>=1.136.0` requires `protobuf>4.21.5,<7.0.0`. **Not supabase** — blocked on Google's release cadence. Re-check upstream periodically.
- **`pdfminer-six` — stuck at `20251230` (transitive). Latest `20260107`.** `pdfplumber==0.11.9` exact-pins `pdfminer-six==20251230`. PyPI's latest pdfplumber is still 0.11.9 (confirmed 2026-04-30 — `uv lock --upgrade-package pdfplumber` returned `No lockfile changes detected`). Unblock requires a new pdfplumber release.

### `nextjs-app/`

- **`react` / `react-dom` — exact pin (no caret), both at 19.2.5.** Lockstep siblings; versions must match exactly. Bump as a coordinated pair only.
- **`eslint-plugin-storybook` — exact pin (no caret), currently 10.3.6.** Lockstep with `storybook` and `@storybook/*` (currently 10.3.6). Bump only when all Storybook packages move together — `bun update @storybook/*` won't touch the exact-pinned `eslint-plugin-storybook`, edit by hand.

### `.github/workflows/`

- **`astral-sh/setup-uv` — must pin to immutable tag (e.g. `@v8.1.0`), no major-only.** v8 (2026-04-29) dropped major and minor floating tags for supply-chain security: `@v8` and `@v8.0` no longer resolve. Pin to a specific version like `@v8.1.0` (or full SHA). All other actions in our workflows still float on major (`@v6`, `@v4`).

*(No entries yet for `landing-app/`, `tests/*`, or Python tools. Add as they emerge.)*
