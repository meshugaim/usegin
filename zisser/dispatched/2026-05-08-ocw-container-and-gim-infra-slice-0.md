---
title: Slice 0 — name and map GIM and Infra inside test-mvp
status: dispatched
created: 2026-05-08
parent_plan: zisser/plans/2026-05-08-ocw-container-and-gim-infra-units.md
caller: oria
worker: wes
---

## Charter

You are Wes. Slice 0 of the OCW-container-and-Gim-Infra-units plan
(`zisser/plans/2026-05-08-ocw-container-and-gim-infra-units.md` — read
this first, the whole thing, before touching anything).

### Purpose

Make two units inside the `test-mvp` monorepo legible by name and
boundary, so a fresh reader (human or agent) can answer:

- "Which files belong to **GIM** (the agent surface)?"
- "Which files belong to **Infra** (the operator/dev-tooling
  surface)?"
- "What's GIM's public surface — what would another repo (OCW) need
  to consume to spawn a persona-aware Claude session?"
- "What's Infra's public surface — what would another repo (OCW)
  need on its PATH and in its justfile to make `c`, `_persona`, the
  dx/session/zettel aliases, claude-canonical, etc. work?"

You are not moving files in this slice. You are writing two maps that
make the implicit boundary explicit. File moves come later, only if
slice 2's `gin-bootstrap` mechanics require them.

### Key tasks

1. **Read first** (don't skip):
   - `zisser/plans/2026-05-08-ocw-container-and-gim-infra-units.md`
     (the parent plan).
   - `CLAUDE.md` (the test-mvp root) — for monorepo conventions.
   - `oria-crazy-world/CLAUDE.md` — for what OCW is and isn't.
   - `usegin/Gin.md`, `usegin/CLAUDE.md` — to see what's already
     scoped under usegin/ vs scattered across the repo.
   - `justfile` — for the `c`, `cx`, `_persona`, `bootstrap-world`
     recipes.
   - `.devcontainer/post-create.sh` — for the existing bootstrap
     pattern.

2. **Survey what composes each unit.** Be exhaustive. Use Bash + Read
   + Explore as needed.

   Likely-GIM (agent surface) candidates — verify, don't assume:
   - `.claude/agents/`, `.claude/skills/`, `.claude/hooks/`,
     `.claude/rules/`, `.claude/settings.json`,
     `.claude/keybindings.json`, `.claude/output-styles/`
   - `usegin/` content that's persona / behavior-shaping (personas,
     wispr-flow-corrector, comptroller, evals, things-we-grow,
     values, etc.)
   - Persona-loading logic inside `justfile` (`_persona`)
   - The `oria-crazy-world/ground/personas/*.md` files **read** by
     `_persona` — note GIM consumes them but they're owned by OCW;
     this seam matters for the OCW-pulls-Gin direction.

   Likely-Infra (operator/dev-tooling surface) candidates:
   - Top-level justfile recipes that aren't product-build (`c`, `cx`,
     `_persona`, `bootstrap-world`, `agent-dev*`, etc.) — categorize
     each.
   - `tools/dx/`, `tools/session/`, `tools/sentry-cli/`,
     `tools/bin/`, `tools/playwright-cli/` — categorize each.
   - The `claude-canonical` / `codex-canonical` shims (find them —
     they're on PATH, where do they come from?).
   - `.devcontainer/` (devcontainer.json, post-create.sh, world.conf,
     features). Some of this is product-side (Supabase, Doppler);
     separate clearly.
   - Shell aliases / PATH wiring (zettleit, dx, effi, plan, session,
     sentry, etc. — find their source).

3. **Write `GIM.md` at test-mvp root.** Structure:
   - Opening paragraph: what GIM is in plain language ("the agent
     surface — Claude Code's persona, skills, hooks, rules, and the
     persona-spawn machinery that wakes a named agent").
   - **Composition table**: file or directory → role. One row per
     atomic piece.
   - **Public surface**: what an external repo (OCW) needs to mount
     or symlink to gain GIM. Concrete file/dir list, not prose.
   - **Seams**: where GIM reads from outside its own boundary
     (notably: persona files in `oria-crazy-world/ground/personas/`).
   - **Not GIM**: explicit list of things people might confuse for
     GIM but that belong to Infra or product (e.g. `tools/dx/` is
     Infra, not GIM; `nextjs-app/` is product).

4. **Write `INFRA.md` at test-mvp root.** Same structure:
   - Opening paragraph: what Infra is ("the operator surface — the
     `c` / `_persona` aliases, dx / session / zettel CLIs, dev
     tooling, devcontainer wiring, anything that puts a Claude
     session in a usable state").
   - **Composition table**: file or directory → role.
   - **Public surface**: what an external repo (OCW) needs on PATH
     and in its justfile to gain Infra. Be specific — bin paths,
     justfile recipes to copy or include, env vars to set.
   - **Seams**: where Infra reads from outside (notably:
     `.devcontainer/world.conf`'s `WORLD_REPO`, which becomes a
     symmetric `GIN_REPO` later).
   - **Not Infra**: things people might confuse — GIM's
     `.claude/agents/` is GIM, not Infra; product CI is product.

5. **Cross-link.** GIM.md links to INFRA.md and vice versa, and both
   link back to the parent plan for context.

6. **Tone.** Match `CLAUDE.md` and `usegin/Gin.md` — laconic,
   concrete, no permission theater. These docs are the dictionary
   for the rest of the slices; treat them as load-bearing.

7. **Commit and push.** One commit, message:
   `docs(gim,infra): name and map the two units inside the monorepo`
   Body: short — point at the parent plan path. Push to `main`.

### End state

- `GIM.md` and `INFRA.md` exist at test-mvp root.
- Together they answer the four questions in "Purpose" above.
- A reader who has never seen the monorepo can follow GIM.md and
  point at every file that belongs to GIM, and same for Infra.
- Commit lands on `origin/main`.
- This dispatch file gets a `## Outcome` section appended with: the
  commit SHA, a one-sentence summary of what was mapped, and any
  surprises that the mapping surfaced (e.g. files that don't
  cleanly belong to either unit — those become an open question
  for the parent plan, NOT a paralysis trigger).

### Selbständigkeit clause

Work autonomously. Do not bounce questions back to Zisser unless:
- A file's classification is genuinely ambiguous AND the wrong
  classification would cascade into slice 1 or 2 incorrectness.
- You discover a Type A latent-direction problem (the whole framing
  in the parent plan is wrong). In that case, stop and surface.

For everything else — pick the lean, document the choice in the
relevant table cell, keep going.

### What you do NOT do in this slice

- No file moves. No symlinks. No new directories. Just two markdown
  files at the root and the commit.
- No changes to OCW (that's slice 1).
- No changes to justfile. No new recipes. No `gin-bootstrap` (slice
  2).
- No editing of `nextjs-app/` or `python-services/`.

## Outcome

Commit: `d981cb3d9` — pushed to `origin/main`.

Mapped GIM (`.claude/` agents+skills+hooks+rules+settings,
`usegin/`, `zisser/`, plus the GIM-content side of the
`_persona`/`c`/`cx` recipes) and Infra (`tools/bin/` PATH surface,
`tools/dx`+`tools/session`+the rest of `tools/`, `claude-canonical`
and `codex-canonical` wrappers, the operator-shape side of justfile
recipes, `.devcontainer/` wiring, `scripts/`) into two pointer docs at
test-mvp root, with composition tables, public-surface lists, seams,
and explicit not-this lists. Cross-linked both ways and back to the
parent plan.

Surprises / open questions surfaced for the parent plan:

- **`_persona` recipe is intrinsically split** — the recipe shape
  (Infra) wraps a system-prompt body that names personas and points
  at GIM soul files (GIM). Documented as "Infra-by-shape,
  GIM-by-content" in both maps; slice 2 has to decide whether
  `gin-bootstrap` copies the recipe verbatim or re-emits it from a
  GIM-side template.
- **`.claude/hooks/` cross-boundary** — hook *files* are GIM, the bun
  runtime + PATH executing them is Infra, and `.claude/settings.json`
  wires them. Means GIM can't be exposed without Infra's PATH being
  live; OCW's `gin-bootstrap` ordering matters.
- **`.claude/memory/`** is symlinked auto-memory, team-shared across
  devcontainers. Listed under GIM (the symlink behavior) but the store
  is per-checkout state. OCW container will hit this seam too — needs
  its own symlink target or it'll inherit test-mvp's store.
- **Several `tools/bin/` entrypoints are product-adjacent** (`db-test`,
  `migrate`-driving recipes, `agent-dev-*`, `vrag`, `vais`, `landing-*`).
  Per the parent plan's "production code in OCW" open decision, OCW's
  `gin-bootstrap` should expose Infra+GIM only and skip these. Map
  flags them; slice 2 enforces the split.
- **`.claude/output-styles/`** referenced in the charter as a likely-GIM
  candidate — directory does not exist on disk. Documented as a
  "reserved slot" in GIM.md; not a blocker.
- **Test-runner CLIs in `tools/bin/`** (`db-test`, `db-checks`,
  `test-supabase`, `sync-test`) are operator entrypoints but drive
  product test suites. Classified Infra with a borderline note.

No Type A latent-direction problem. Slice 1 can proceed against these
maps; slice 4 reconciles them against what `gin-bootstrap` actually
exposes.
