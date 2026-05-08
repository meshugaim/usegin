---
title: OCW as standalone container; GIM and Infra as legible units inside test-mvp
status: planning
created: 2026-05-08
speaker: oria
---

## The vector (oria, 2026-05-08)

> "I want OCW in a container, in a way I can clone it to my PC and run zettle
> and do what I do here. I want OCW as a dev dependency that Codebase uses,
> and I want GIN as a dev dependency that OCW uses."
>
> "We have GIM, which is the agent with the skills and everything. We have
> the infra, which is the aliases and everything. Each should be standalone
> but inside this monorepo... Monorepo OCW is a different repo. Everything
> else: monorepo."

## End state

1. Open a Codespace on `AskEffi/oria-crazy-world` (no test-mvp checkout
   needed). The container starts, pulls in the dev goodies from test-mvp,
   and inside that Codespace `c`, `_persona zisser`, the dx/session/zettel
   aliases, and persona-aware Claude all work the same as they do in
   test-mvp's container today.
2. Test-mvp's monorepo internally exposes two clearly-scoped units:
   - **GIM** — the agent surface: `.claude/agents/`, `.claude/skills/`,
     `.claude/hooks/`, `.claude/rules/`, persona-loading logic.
   - **Infra** — the operator surface: `c` / `cx` / `_persona` recipes,
     `claude-canonical`, `tools/dx/`, `tools/session/`, `tools/bin/` shims,
     PATH/devcontainer wiring.
   Each unit has a top-level pointer doc (`GIM.md`, `INFRA.md`) so a
   reader (human or agent) can name and find it. Files don't need to be
   moved on day one if the boundary is documentable in place — but
   anything ambiguous gets a home.
3. The dependency direction is now bidirectional and symmetric:
   - test-mvp pulls OCW (`bootstrap-world`, exists today — keep).
   - OCW pulls test-mvp (`bootstrap-gin` or equivalent — new).

## Topology summary

| | Repo | Pulls | Pulled by |
|---|---|---|---|
| `test-mvp` | `AskEffi/test-mvp` (monorepo, contains GIM + Infra + product code) | OCW (existing) | OCW (new) |
| `oria-crazy-world` | `AskEffi/oria-crazy-world` | test-mvp (new) | test-mvp (existing) |

## Slices (proposed order)

### Slice 0 — name + map the units (test-mvp side, no file moves)

Write `GIM.md` and `INFRA.md` at test-mvp root. Each file lists the
files/dirs that compose the unit, the seam to the rest of the monorepo,
and the public surface (what an external repo like OCW pulls from it).

This is the dictionary the rest of the work uses. Tiny, fast, unblocks
slice 1.

### Slice 1 — OCW gets its own `.devcontainer/`

OCW needs:
- `.devcontainer/devcontainer.json` (image, features, mounts, postCreate).
- `.devcontainer/post-create.sh` that clones `AskEffi/test-mvp` into a
  sibling path (e.g. `../test-mvp/`) and runs a `gin-bootstrap` script
  inside test-mvp that PATH-adds Infra's bins and registers the GIM
  `.claude/` config so Claude Code in the OCW Codespace finds it.
- A `.gitpod.yml` parallel for Ona/Gitpod compatibility (mirror of
  test-mvp's pattern).
- A small `README` at OCW root explaining "open in Codespace, wait for
  bootstrap, then `c`".

Mechanism call (Zisser, taste): **clone-as-sibling**, not submodule.
Mirrors the existing `bootstrap-world` shape. Lower friction, no
submodule init dance, easy to update (`git pull` in the sibling).

### Slice 2 — `gin-bootstrap` inside test-mvp

A `just gin-bootstrap` recipe (or shell script) that, when run from
*inside* a cloned test-mvp checkout, exposes Infra and GIM to the
*calling* container — wires `c`, `cx`, `_persona`, `dx`, `session`,
zettel aliases into the calling shell's PATH; symlinks `.claude/` so the
calling repo's Claude Code instance picks up GIM's agents/skills/hooks.

Has to be idempotent. Has to work whether the calling repo is OCW, a
fresh empty repo, or some future sibling.

### Slice 3 — verify in OCW Codespace

Open OCW in a Codespace. Run `c`. Run `_persona zisser`. Run a zettel
add. Run `dx his rate --as=claude`. All work. If they don't, fix
slice 2 and re-test.

### Slice 4 — backfill GIM.md / INFRA.md from what slice 2 actually exposed

The map from slice 0 was best-guess. Slice 2 forces the real boundary
(what does `gin-bootstrap` actually wire?). Reconcile slice 0 docs with
slice 2 reality so future readers (and future contributors who want
to use GIM/Infra elsewhere) have an accurate map.

## Open decisions

- **Sibling layout in OCW container.** `../test-mvp/` (peer dir) vs
  `./.gin/` (hidden subdir of OCW)? Sibling is cleaner for `git
  pull`-able updates and matches what we'd want if a third repo joins
  the family. Defaulting to sibling unless a constraint surfaces.
- **Production code in OCW Codespace.** When OCW clones test-mvp, the
  Codespace inherits `nextjs-app/` + `python-services/` + Supabase
  setup. We probably don't want to spin those up by default in OCW
  Codespaces — too heavy. The OCW post-create runs `gin-bootstrap`
  (Infra+GIM only), not test-mvp's full `post-create.sh`. Verify this
  separation works.

## Charter for the dispatched dev agent

Lives in `zisser/dispatched/2026-05-08-ocw-container-and-gim-infra.md`
when dispatched. Slice 0 first — single commit, no file moves, just two
markdown maps. Then pause for oria's "go" before slice 1.
