---
title: Slice 2 — `gin-bootstrap` recipe in test-mvp justfile
status: dispatched
created: 2026-05-08
parent_plan: zisser/plans/2026-05-08-ocw-container-and-gim-infra-units.md
predecessor: zisser/dispatched/2026-05-08-ocw-container-and-gim-infra-slice-0.md
caller: oria (via Zisser)
worker: wes
---

## Charter

You are Wes. Slice 2 of the OCW-container-and-Gim-Infra-units plan.

> Plan ordering note. The parent plan numbered slices as 0 (maps) →
> 1 (OCW devcontainer) → 2 (gin-bootstrap) → 3 (verify). We are
> doing 2 before 1 deliberately: slice 1's OCW post-create script
> calls `just gin-bootstrap` from inside the cloned test-mvp, so
> the recipe must exist first. Slice 1 (OCW devcontainer) will
> call this recipe.

### Read first

- `zisser/plans/2026-05-08-ocw-container-and-gim-infra-units.md` — the parent plan.
- `GIM.md` and `INFRA.md` at test-mvp root — Ron-reviewed maps. These are the dictionary; treat each map's "Public surface" section as the load-bearing checklist for what `gin-bootstrap` exposes.
- `zisser/dispatched/2026-05-08-ocw-container-and-gim-infra-slice-0.md` — full Outcome section + Ron's review (commit `28ba08326`). Ron's five structural concerns are reproduced below; honor them.
- `justfile` — pay close attention to `_persona`, `c`, `cx`, `bootstrap-world` recipes. You are writing a peer to `bootstrap-world` (symmetric direction).
- `.devcontainer/post-create.sh` — for the existing bootstrap pattern shape.

### Purpose

Add a `just gin-bootstrap` recipe to test-mvp's justfile that, when
run from inside a cloned test-mvp checkout sitting beside a *caller*
repo (e.g. OCW), wires Infra and GIM into the caller's environment
so that inside the caller's container `c`, `_persona <name>`, the
dx/session/zettel/effi/sentry/plan aliases, and persona-aware Claude
all work the same way they work in test-mvp's own container.

This recipe is the **inverse symmetric peer of `bootstrap-world`**.
Where `bootstrap-world` clones OCW *into* test-mvp at
`oria-crazy-world/`, `gin-bootstrap` exposes test-mvp's GIM+Infra
*to* a caller (OCW). Same mental shape, opposite direction.

### Key tasks

1. **Read GIM.md and INFRA.md `Public surface` sections** and
   convert each line into a concrete bootstrap action: PATH-add this
   dir, source this completion file, symlink this `.claude/`
   subtree, copy this justfile recipe, set this env var.

2. **Resolve Ron's five structural concerns explicitly** (each
   becomes a documented call in the recipe or a header comment):

   - **Persona roster = `.claude/agents/*.md` files, not OCW soul
     files.** When `gin-bootstrap` exposes the persona-spawn surface,
     enumerate personas from `.claude/agents/` and warn (`echo`,
     don't fail) if a referenced OCW soul file (`oria-crazy-world/
     ground/personas/<name>.md`) is missing. Don't silently let
     `_persona john` later try to read a non-existent agent file.

   - **Persona shortcut tier — pick and document.** Four personas
     (`zisser`/`yohai`/`mark`/`poll`) have their own dedicated
     justfile recipes + shell aliases; four (`wes`/`ron`/`sam`/
     `companion`) only have agent files and are spawned via `_persona`
     or the Task tool. **Lean: expose all eight via `_persona`, and
     also expose the four shortcut recipes/aliases.** Document the
     reasoning in a header comment in the recipe. If you find a
     reason this lean is wrong, document the alternative and pick.

   - **Memory symlink direction.** Per Ron: the *repo* dir
     `.claude/memory/` is the real store; `~/.claude/projects/
     -workspaces-test-mvp/memory` is the symlink *into* the repo.
     For an OCW caller, `gin-bootstrap` must create the symmetric
     symlink: `~/.claude/projects/<ocw-canonical-path>/memory` →
     test-mvp's `.claude/memory/`. **Do not blindly mirror the
     existing shape — verify direction with `ls -la` first, then
     reproduce the same direction.** OCW shares the team-store; do
     not create a separate per-OCW memory store.

   - **Per-checkout `.claude/*` state dirs need a per-dir policy.**
     Ron flagged: `memory/`, `builds/`, `handoffs/`, `research/`,
     `specs/`, `ci-failures/`, `tikur-records/`, `linear-audit/` mix
     runtime state with config. **Default policy: symlink (so OCW
     and test-mvp share state when they're on the same machine).
     Override per-dir with copy or skip when symlink would cause
     correctness issues** — name each override in a recipe-header
     table. This is the most likely place to under-think; don't
     skip the case-by-case call.

   - **Product-adjacent `tools/bin/` entries.** Per parent plan
     "open decisions" + Wes's slice-0 surprise + Ron's confirmation:
     `gin-bootstrap` exposes Infra+GIM only and skips product-side
     bins (`db-test`, `agent-dev-*`, `vrag`, `vais`, `landing-*`).
     Maintain an explicit allow-list (or block-list — pick whichever
     is more legible) inside the recipe, and document the policy in
     the header.

3. **Write `just gin-bootstrap`** as a single recipe (or a small
   set of helper recipes if the body would be unreadable as one). It
   must:

   - Take a `caller_path` argument (default: parent dir of
     `pwd` — i.e. `..`). Sanity-check that `caller_path` exists, is
     a git repo, is not test-mvp itself.
   - Be idempotent. Re-running must converge, never duplicate.
   - Be loud about what it did (one line per piece exposed) and
     loud about what it skipped and why.
   - Fail fast on any error that would leave a half-wired caller.
   - Have a `--dry-run` flag that prints the actions without
     executing them. Useful for slice 1's post-create.sh to display
     before running.

4. **Dry-run verification — the grounding step.** This is where you
   confirm the latent plan matches the real world (Type B
   hallucination check). Do all of:

   - Create a temporary sibling dir (e.g. `/tmp/fake-ocw-<short-sha>/`),
     `git init` it, mark it as a fake-OCW.
   - From inside test-mvp, run `just gin-bootstrap /tmp/fake-ocw-<sha>`.
   - From the fake-OCW dir, verify in this exact order: (a) the
     `c` command is on PATH and resolves to test-mvp's
     `claude-canonical`; (b) `dx`, `session`, `zettel`/`zettleit`,
     `plan`, `effi`, `sentry` are all on PATH; (c) `_persona zisser`
     reads test-mvp's `.claude/agents/zisser.md` (verify by
     dry-printing the system prompt that would be passed to claude,
     not by actually spawning a session); (d) the symlink for
     `~/.claude/projects/<fake-ocw-path>/memory` is in the right
     direction and resolves to test-mvp's `.claude/memory/`.
   - Tear down: `rm -rf /tmp/fake-ocw-<sha>` and remove the symlink
     created in `~/.claude/projects/`.

   If any check fails, fix the recipe and re-run the verification.
   Do not consider the slice complete until all four pass.

5. **Document the recipe**:

   - Recipe-header comment block matching the style of
     `bootstrap-world` and `_persona`. Include: purpose, inverse-
     symmetric pairing with `bootstrap-world`, the four-bullet
     policy decisions (persona roster source, shortcut tier,
     memory direction, state-dir policy, allow-list).
   - Update `INFRA.md` to add `gin-bootstrap` to the composition
     table (it's a new piece of Infra) and to the public-surface
     section (a caller invokes this recipe to gain Infra+GIM).
   - Update `GIM.md` if needed (e.g. if `gin-bootstrap` exposes a
     GIM piece in a way the map didn't anticipate).

6. **Commit and push.** One commit, message:
   `feat(infra): just gin-bootstrap — symmetric peer of bootstrap-world`
   Body: short — point at the parent plan + this dispatch file,
   list the four policy decisions in one line each. Push to `main`.

### End state

- `just gin-bootstrap [caller_path]` exists in test-mvp's justfile.
- Recipe is idempotent, loud, dry-run-able, and fails fast.
- Dry-run verification (step 4) passes all four checks against a
  fake-OCW sibling dir.
- INFRA.md (and GIM.md if needed) updated to include gin-bootstrap.
- Commit lands on `origin/main`.
- This dispatch file gets a `## Outcome` section appended with: the
  commit SHA, the recipe SHA-256 (so slice 1 can pin it), the four
  policy choices made, the verification output (paste the four
  check results), and any new surprises.

### Selbständigkeit clause

Work autonomously. Pick the lean on every micro-decision and
document it. Surface back to Zisser only if:

- A policy choice has a wrong-default cost large enough that the
  recipe might break OCW silently in a way the dry-run can't
  catch. (Genuine ambiguity-that-matters per principle 5.)
- Type A latent-direction problem: the gin-bootstrap framing in
  the parent plan is wrong, and slice 1 won't be able to call this
  recipe sensibly.
- The dry-run fails and you can't fix it within the recipe (e.g.
  missing capability in the GIM/Infra surface itself).

For everything else: lean, document, keep going.

### What you do NOT do

- No file moves out of `usegin/` or `.claude/`. The maps from slice
  0 describe the boundary; the recipe wires it; movement (if any)
  is a later slice or a separate plan.
- No edits to `nextjs-app/`, `python-services/`, or anything in
  product-side `tools/bin/`.
- No edits to `oria-crazy-world/`. Slice 1 (next, separate Wes)
  handles the OCW side.
- No actual Codespace test. That's slice 3 — needs oria to open a
  fresh Codespace on `AskEffi/oria-crazy-world` and run `c`. You
  validate via the local dry-run only.

## Outcome

Commit: see git log for `feat(infra): just gin-bootstrap` (this dispatch
file is committed alongside the recipe, so the SHA is the tip of `main`
after this push).

Recipe SHA-256 (gin-bootstrap body in justfile, for slice 1 to pin):
`e11677f433febeb110ca9bf750c3e57eaf1f81a18fd0f403a01c7a6c7ab2fc3e`
(computed over the recipe text from `# Wire test-mvp` header through
the recipe body, exclusive of the next recipe; recompute with
`awk '/^# Wire test-mvp/,/^# Backfill extracted_text/' justfile | sed '$d' | sha256sum`).

### Four policy choices (one line each)

1. **Persona roster** — enumerated from `.claude/agents/*.md` (eight:
   companion, mark, poll, ron, sam, wes, yohai, zisser); warn-not-fail
   when OCW soul missing (companion has no soul today — flagged as
   warning).
2. **Shortcut tier** — all eight via `_persona`, plus dedicated
   `zisser`/`yohai`/`mark`/`poll` recipes mirroring test-mvp's existing
   shape exactly.
3. **Memory direction** — symlink at `~/.claude/projects/<caller-canonical>/memory`
   → `<test-mvp>/.claude/memory/`; same target as test-mvp's
   auto-memory symlink, so memory store is team-shared (never
   per-caller).
4. **State-dir policy** — single dir-symlink `<caller>/.claude` →
   `<test-mvp>/.claude` covers everything (agents, skills, hooks,
   rules, commands, settings.json, memory, builds, handoffs, research,
   specs, ci-failures, tikur-records, linear-audit, skill-lab,
   workflow-presets, prompts, preferences). Per-dir override table is
   documented in the recipe header for future tightening.
5. **Allow-list (product-bin gate)** — explicit allow-list of 62 Infra
   bins as symlinks at `<caller>/.gin/bin/`; `.gin-bootstrap.env` PATH-
   prepends that shadow dir, NOT `tools/bin/` directly. Block-list
   (db-test, db-checks, sync-test, test-supabase, test-watcher,
   vrag-auth, vais-setup, nextjs-dev, api-dev, set-env, railway,
   railway-dev, scheduled-report-preview) is documented as comments
   inline.

### Verification (four-check dry-run against `/tmp/fake-ocw-<sha>/`)

All four checks **PASS**:

- (a) `c` command on PATH → `<fake>/.gin/bin/claude-canonical`,
  resolves to `/workspaces/test-mvp/tools/bin/claude-canonical`. ✓
- (b) `dx`, `session`, `zettleit`, `plan`, `effi`, `sentry` all on
  PATH via shadow dir. ✓
- (c) `_persona zisser` snippet builds a system prompt referencing
  `.claude/agents/zisser.md`, which resolves through the
  `<fake>/.claude → <test-mvp>/.claude` symlink to
  `/workspaces/test-mvp/.claude/agents/zisser.md`. ✓
- (d) `~/.claude/projects/-tmp-fake-ocw-<sha>/memory` is a symlink
  pointing to `/workspaces/test-mvp/.claude/memory`. ✓

Re-running `just gin-bootstrap <fake>` is idempotent — verified by
running twice; second run reports "already correct" for both symlinks
and re-emits the snippet/env file in place.

Teardown: `rm -rf /tmp/fake-ocw-<sha> ~/.claude/projects/-tmp-fake-ocw-<sha>`.

### Surprises slice 1 needs to know

1. **`{{...}}` escaping forced a helper script.** The persona-spawn
   snippet contains literal `{{name}}` / `{{args}}` tokens that `just`
   tries to interpolate at recipe parse time. Inline heredoc fails;
   solution is `scripts/write-gin-justfile-snippet.ts` (a small `bun`
   shim that emits the snippet text). Slice 1's post-create.sh doesn't
   need to know about this — `gin-bootstrap` handles it — but the
   helper file is part of the surface.

2. **Caller's `_persona` works WITH or WITHOUT `oria-crazy-world/`
   present.** The emitted snippet probes `[ -d "ground/personas" ]` to
   detect whether the caller IS OCW (cwd-style) vs a non-OCW sibling
   that happens to have OCW cloned alongside. OCW gets the `ground/...`
   path; non-OCW callers fall back to `oria-crazy-world/...` (won't
   work for them, but that's the existing test-mvp behavior — slice 1
   is for OCW specifically).

3. **`zisser/` working zone reaches OCW callers via `$GIN_TEST_MVP`.**
   When `_persona zisser` runs from inside OCW, `zisser/zisser.md` etc.
   are read from `${GIN_TEST_MVP}/zisser/` (the env var set by
   `.gin-bootstrap.env`). Slice 1 must ensure `.gin-bootstrap.env` is
   sourced *before* any `_persona zisser` invocation in the OCW
   container — i.e. source it in the postCreate, not lazily.

4. **`companion` agent has no OCW soul.** Recipe warns (echo, doesn't
   fail). If the companion persona becomes load-bearing in OCW, an
   OCW-side soul file at `ground/personas/companion.md` is needed.
   Today's seven personas with both halves: mark, poll, ron, sam, wes,
   yohai, zisser.

5. **`settings.local.json` lives inside the symlinked tree.** Because
   we dir-symlink the entire `.claude/`, the caller's
   `.claude/settings.local.json` is whatever test-mvp's is. If a future
   caller needs to override settings locally, the state-dir policy must
   shift from "single dir-symlink" to "per-dir mix" with
   `settings.local.json` copied or shadowed. Documented in the recipe
   header policy table; not a slice-1 problem unless OCW needs
   different settings.local.json from test-mvp.

6. **No actual `claude` invocation in verification.** Per charter
   step 4(c) — verified the prompt-shape via inspecting the emitted
   snippet, not by spawning Claude. Slice 3 (Codespace) is where the
   live `c` and `_persona zisser` commands actually run.

7. **`tools/bin/ralph-loop` and `ralph-complete` were in my draft
   allow-list but don't exist on disk.** Trimmed before commit. If they
   land later, add them to the ALLOW array in the recipe.

No Type A latent-direction problem. Slice 1 can proceed: OCW's
`.devcontainer/post-create.sh` clones test-mvp as a sibling, runs
`(cd ../test-mvp && just gin-bootstrap "$(pwd)/..")` from within OCW
or `(cd <test-mvp> && just gin-bootstrap <ocw-path>)` from anywhere,
then sources `<ocw>/.gin-bootstrap.env` and the OCW justfile imports
`.gin/justfile.gin`.
