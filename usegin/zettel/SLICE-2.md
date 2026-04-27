# Zettel — Slice 2

Slice 2 of the dev-team Zettel sub-app. Lifts the markdown corpus into Supabase + pgvector so retrieval becomes graph + semantic — per `z028` (substrate is settled = Postgres + pgvector + recursive CTEs in our existing Supabase, no RLS, one shared brain) and per `z034`'s named deferral (slice 1 = markdown + git; the sync step is slice 2's job).

## Intent

Make the corpus *queryable as a graph and as a vector space*, not just as a directory of markdown files.

What slice 1 didn't enable:
- "What's semantically near this thought?" — slice 1's only retrieval is filename listing + `rg`.
- "What threads into z034?" (inbound) — slice 1 stores threads only on the *from* file's frontmatter, so inbound queries require a full corpus scan and are not surfaced through the CLI at all (named in slice-1 known limitations).
- Spreading-activation recall ("pull a wire, find the rope") from the deep-graph-professor whiteboard — that needs the edge table + recursive CTEs.

Slice 2 keeps markdown as the source of truth on disk (slice 1 invariant) and adds Supabase as a *derived index*. `dx zettel add` continues to write markdown first; sync makes the DB catch up.

## Scope

| Surface | Behavior | Mechanism |
|---|---|---|
| `dx zettel sync` | Walks `usegin/zettel/zettels/` via slice-1's `readAll()`, upserts each zettel into the `zettels` table, replaces its outgoing edges in `zettel_edges`, computes embeddings for new/changed bodies. Idempotent. `--dry-run` prints planned upserts/deletes. `--since <git-ref>` limits scan to files changed since a ref (fast path for incremental sync). | Reads slice-1 storage layer; writes Supabase with service-role key. |
| `dx zettel search "<query>"` | Hybrid retrieval: top-K vector similarity + full-text (tsvector) + recursive CTE expansion to depth 2. Returns `id title author activation` rows. `--json` for piping. `--depth N` to override. `--no-graph` for pure vector. | One SQL call into the `recall()` function shipped in the migration. |
| `dx zettel show <id> --inbound` | Existing `show` already prints outgoing threads (slice 1). New flag pulls inbound edges from `zettel_edges` (`select src from zettel_edges where dst = ? and kind in ('placement','cross','supersedes','contradicts')`). Renders grouped by edge kind. | Single SELECT on `zettel_edges`. |

`dx zettel add` / `link` are unchanged on the surface but gain an opportunistic post-write hook: after writing markdown, fire `dx zettel sync --only <id>` in the background. Failure to sync logs to stderr and exits 0 — the markdown write is canonical, sync is best-effort.

## Out of scope (= explicit non-goals)

- **Auto-pop hook** (Claude surfacing relevant zettels mid-session). Slice 3.
- **Distillation-against-neighbors UX** (Luhmann's load-bearing operation, ENG-5380). Slice 4.
- **Effi-side sync** (zettels surfacing in AskEffi corpus / answers). Slice 5.
- **Derived edges**: `similar_to`, `co_occurred_with`, `temporally_near`. The schema sketches them; slice 2 ships only the *explicit* edge kinds (`placement`, `cross`, `supersedes`, `contradicts`, `tagged`). Derived-edge backfill is its own follow-up — out of scope here so we don't conflate "make the substrate real" with "tune the inference rules".
- **Block-level zettels** (Roam transclusion). Page-level only, per whiteboard §3.7.
- **Apache AGE promotion.** Schema is AGE-friendly; we don't install AGE in slice 2.
- **Temporal validity windows** on edges (Graphiti-style). Cheap to add later.
- **RLS, per-user partitioning, draft state.** `z028` and `project_zettel_no_privacy` settle this; we don't introduce them.
- **Multi-machine writer reconciliation.** Markdown + git remains the conflict-resolution surface (it's the source of truth); the DB is one-writer-per-sync.

## The migration

Path: `supabase/migrations/<bunx-supabase-generated-timestamp>_zettel_initial.sql` (use `bunx supabase migration new zettel_initial` per `SUPABASE.md` — never hand-pick the timestamp).

Lifts `usegin/zettel/RD/deep-graph-professor/schema-sketches/v1-postgres.sql` faithfully, with these named deviations:

| From sketch | In slice 2 | Reason |
|---|---|---|
| `id uuid pk` | `id text pk` (the `z###` form, e.g. `z003`) | The corpus, slice-1 storage, and slice-1 frontmatter all key on `z###`. Using uuids would force a parallel id-mapping layer and break `dx zettel show z3`. The `z###` is already stable and human-meaningful. |
| `kind` enum (`lesson`/`idea`/`decision`/...) | `kind text` (free-form, no enum) for slice 2 | Existing zettels don't carry a kind field in frontmatter; classifying 39 of them by hand to seed an enum is out of scope. Default all sync'd rows to `'note'`; later slices can introduce an enum + backfill. |
| `author text` | `author text` — same | Maps directly from frontmatter `authored-by` (`human`/`usegin`/`consultant`). |
| `origin_kind`, `origin_ref` | `origin_kind` defaults `'manual'`, `origin_ref` jsonb stores `{ session, path, created }` from frontmatter | Consistent with slice 1 frontmatter shape. |
| `body_embedding vector(1536)` | `body_embedding vector(<dim from chosen model>)` — see Embedding strategy dilemma below | Dim follows the model decision. |
| `superseded_by uuid` | `superseded_by text references zettels(id)` | Keys flip from uuid to text for the same reason as `id`. |
| `zettel_edge` (singular) | `zettel_edges` (plural, our convention in `supabase/migrations/`) | House style. |
| `kind` enum on edges | `kind text` (one of `placement`, `cross`, `supersedes`, `contradicts`, `tagged`, `similar_to`, `co_occurred_with`, `temporally_near`) | Slice 1's edge model already uses `placement`/`cross` (not `links_to`/`thread_continues`). Match the words the existing storage layer parses, otherwise sync has to translate both ways. Derived-kind values reserved but unused in slice 2. |
| `recall()` function | Ship it; parametric over `query_embedding`, `max_hops`, `hop_decay`, `seed_k`, `result_limit` | Direct lift from the sketch. |
| Nightly `similar_to` job | NOT shipped in slice 2 | Out-of-scope above. The function will return graph-explicit edges only until derived edges are added. |
| RLS on either table | NOT enabled | `z028` + `project_zettel_no_privacy`. Document in the migration's header comment so a security review doesn't re-question it. |

Indices: lift all from the sketch — `kind`, `created_at desc`, `author`, gin on `origin_ref`, hnsw on `body_embedding` (cosine), gin on `to_tsvector('english', coalesce(title,'') || ' ' || body)`, btree on `(src, kind)` and `(dst, kind)` for edges.

The migration's header comment names: (a) the no-RLS decision and the zettels backing it (`z028`, `project_zettel_no_privacy`), (b) the AGE-friendly shape, (c) the deferred-derived-edges scope.

## Embedding strategy

**Where it's called from:** the `dx zettel sync` command computes embeddings client-side (Bun + provider SDK) and includes them in the upsert. Not a Postgres trigger, not a separate service.

Why:
- Sync is already the only writer to the DB. Putting embedding *next to* the only place we write keeps the contract simple — a row exists in `zettels` ⇒ its embedding is correct for its current body.
- Triggers are invisible from the CLI's perspective and turn an embedding-provider outage into a write-time failure. Client-side keeps the failure boundary in one tool we own.
- Sync is interactive (the agent or human ran it). Latency is tolerable; cost is bounded by changed-files-only.

Per-row cost control: skip embedding when the body's content hash matches the stored row's `origin_ref->>'body_sha'` — only changed bodies re-embed.

**Model choice — bring as a `z026` dilemma to Lihu:**

> **Decision needed:** which embedding model does `dx zettel sync` call?
> **Options:**
>   A. `text-embedding-3-small` (OpenAI, 1536 dim) — what the schema sketch defaults to and what most of our retrieval code already uses.
>   B. `voyage-3-lite` (Voyage AI, 512 dim, cheaper + currently SOTA-ish for retrieval at our scale).
>   C. `bge-small-en-v1.5` self-hosted (open-weights, 384 dim, free-on-the-machine-running-sync).
> **UseGin's lean:** A.
> **Why:** zero new vendor account; matches schema-sketch dim (1536) so the migration ships unchanged; OpenAI key is already in the dev box's env for other tools. The corpus is ~40 zettels — embedding cost is rounding error.
> **Price:** vendor lock-in (mild — pgvector is dim-bound, not provider-bound; switching means re-embedding all rows in a follow-up migration). Tying capture-time latency to OpenAI's API availability. ~$0.00002 per 1k tokens × ~40 zettels × ~300 tokens ≈ trivial.
> **Risk:** OpenAI deprecates / re-prices the model later → forced re-embed. Mitigated by the `body_sha` skip — re-embed is one `dx zettel sync --reembed` away.
> **For you to weigh:** vendor relationship (we're already in Anthropic + OpenAI — adding a third for marginal recall quality is the manager call); whether you want capture-time latency on a sync that runs interactively from the CLI; whether self-hosted matters as a principle even at this scale.

If A: schema's `vector(1536)` ships unchanged. If B or C: parameterize the dim in the migration before applying.

## Auth — how `dx zettel sync` authenticates against Supabase

Reuse the pattern already established in `tools/sync-test/src/lib/supabase.ts`:

```
SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env,
fall back to `bunx supabase status --output json`.
```

`bun set-env --supabase local` (per `SUPABASE.md`) populates these env vars on the dev box; service-role bypasses RLS, which is moot here (we don't enable RLS) but matches every other tool's expectation.

Slice 2 does not introduce a new auth pattern. No service account, no OAuth, no per-user token. The dev-team-only, no-privacy stance from `z028` is what makes this trivial — the whole 2nd brain is one team-wide schema, the CLI runs on dev boxes that already have the service-role key, and there's no end-user identity to model.

For staging/prod databases: the same env-var pattern works; humans run `bun set-env --supabase staging` (or `prod`) before invoking sync. Per project convention (claudeMd "DO NOT… Apply migrations to staging/production databases / Write to any remote database"), agents do not run `dx zettel sync` against staging or prod. That promotion is a human gesture.

## Success signals (slice 2)

- `dx zettel sync` against a fresh local Supabase produces N rows in `zettels` and the correct number of `zettel_edges` for the current corpus, idempotently (run twice → second run upserts zero changes).
- `dx zettel search "decision shape"` returns `z020` in the top 3 (canonical retrieval check — `z020` is the decision-shape zettel).
- `dx zettel show z028 --inbound` lists `z034` and any other zettels that thread `↑z028` or `~z028`. (Today, slice 1 cannot answer this.)
- The 40-ish existing zettels round-trip: `parseZettel` → sync → `select * from zettels` → reconstructed body matches disk byte-for-byte modulo trailing newline.
- The recall() function returns sane top-25 for a synthetic seed (manual eyeball check on first run; no formal eval in slice 2).

## Known limitations

- **Derived edges absent.** `similar_to`, `co_occurred_with`, `temporally_near` are reserved in the schema but never populated. Recall is therefore explicit-edges + vector-seeds only — narrower than the whiteboard's full vision. Adding them is its own slice.
- **No backfill of `kind`.** All sync'd rows land with `kind = 'note'` until the enum + classification pass exists. Queries like "show me all frustration zettels" don't work yet.
- **Sync is one-way.** Markdown → DB. Editing a row directly in Supabase is silently overwritten on next sync. The DB is a derived index, not a writer surface.
- **No multi-machine sync race detection.** If two dev boxes sync concurrently against the same DB, last-write-wins per row. Acceptable: markdown + git is still the source of truth.
- **`--inbound` walks one hop only.** Multi-hop ancestry visualization is out of scope; the recall() function is the multi-hop surface.
- **Capture-time latency on `dx zettel add`.** Background sync is best-effort; if the embedding API is slow, the agent doesn't notice (good for capture flow), but the new zettel is briefly invisible to `dx zettel search`. Workaround: re-run `dx zettel sync` explicitly.
- **No `dx zettel unsync` / hard-delete tooling.** Mark `retired = true` via a future `dx zettel retire` (out of scope here per `z039` — distillation as forward-only versioning, never delete).

## Trigger to start slice 3

- `dx zettel search` is in real use during sessions (= the team is reaching for it instead of `rg` over the markdown), AND
- The "I would have wanted Claude to surface this zettel proactively" moment has been named at least 3 times in `dx his` / chat / a zettel — the auto-pop hook is the response to that named pain, AND
- Either: derived-edge backfill (`similar_to`) has shipped as a follow-up to slice 2 *or* the team explicitly decides recall on explicit-edges-only is enough for the auto-pop trigger.

When all three hold: open a slice-3 plan covering the auto-pop hook (UserPromptSubmit / SessionStart / file-touch hooks → `dx zettel search` → inject top-N into Claude's context).

## Trigger to revisit slice 2's deferrals

- **Derived edges**: when search returns "thin" results because a clearly-related zettel isn't graph-reachable. That's the signal we need `similar_to`.
- **`kind` enum + backfill**: when a query like "all decisions in the last 30 days" is the natural question and we can't answer it.
- **AGE promotion**: when recursive CTEs exceed 50ms p95 on real retrievals (per whiteboard §1).
