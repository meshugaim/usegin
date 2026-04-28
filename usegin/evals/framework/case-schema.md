# Case Schema — the universal envelope

A case is the smallest unit of an eval run. It points at evaluation material
(a recorded transcript or a fresh prompt), names the world the agent
should be evaluated against (`mental_model`), and references the
`Definition of Good` it is judged against (`dog_ref`).

The case is **not** a prompt + expected answer pair. It is a transcript
pointer (Effi corpus) **or** a prompt + structural assertions (Gin
corpus), both wrapped in the same envelope so the runner walks them with
one parser.

This schema is load-bearing for S3 (runner), S4 (matrix), S5 (iterate).
It encodes the four principles structurally:

- **P1 measurable params** → DoG names dimensions; the case never embeds
  free-text scores.
- **P2 attribution per tweak** → `baseline_run_id` lets a run compute
  per-dimension deltas attributable to the single thing that changed
  (model, prompt, or one DoG threshold).
- **P3 multi-dim simulation** → `mental_model` is the invariant fixture;
  `model` and `prompt` are NOT fields in the case (they are matrix axes
  set by the runner at run time).
- **P4 DoG-driven iteration** → `dog_ref` points at a markdown DoG that
  Claude reads as part of the iterate loop.

---

## The envelope (all cases, both corpora)

```jsonc
{
  "id": "<corpus>-<NNN>-<slug>",          // required, kebab-case, globally unique
  "title": "<one-line human title>",      // required
  "origin": "<session-audit|zettel|linear|hand-curated|harvest>",  // required
  "threads": ["~zNNN", "~ENG-NNNN", "..."],  // required for origin: zettel|linear; optional otherwise
  "created": "YYYY-MM-DD",                // required
  "authored-by": "<gin|lihu|oria|nitsan|...>",  // required
  "status": "active|retired",             // required; default "active"
  "supersedes": "<case-id>",              // optional; required when retiring + replacing
  "retired-at": "YYYY-MM-DD",             // required iff status=retired
  "retired-because": "<one-line reason>", // required iff status=retired

  "source": { /* see below — discriminated by `kind` */ },

  "mental_model": {
    "description": "<one-paragraph plain-English description of the world>",
    "dataset_uri": "<optional URI to a snapshot of the data state>",
    "fixtures": {
      "tools_available": ["<tool-name>", "..."],   // optional
      "context": { "<arbitrary>": "<key/value>" }, // optional
      "time": "YYYY-MM-DDTHH:MM:SSZ"               // optional; pin wallclock for time-relative tools
    }
  },

  "dog_ref": "<relative path to DoG markdown, e.g. ../dogs/citation-faithful.md>",

  "expected": {
    "tool_calls_must_include": ["<tool-name>", "..."],   // optional, structural
    "tool_calls_must_not_include": ["<tool-name>"],      // optional, structural
    "citations_required": true,                          // optional, boolean or int (>=N)
    "no_pii": true,                                      // optional
    "shape_hints": ["<free-form short hint string>"]     // optional, judge-readable
  },

  "baseline_run_id": "<run-id of the previous canonical run for delta>", // optional; default = latest run for this case

  "tags": ["<freeform>", "..."],          // optional; e.g. "regression-of:ENG-3500", "external-tier"

  "_comment": "any field beginning with underscore is a comment; the runner ignores it"
}
```

### Field rules

- **`id`** — kebab-case `<corpus>-<NNN>-<slug>`. The `<corpus>` segment is
  the corpus folder (`effi`, `gin`). The `<NNN>` segment is a zero-padded
  monotonic integer per corpus.
- **`origin`** — drives downstream policy: `harvest` cases require Lihu
  promotion before being marked `active`; `zettel`/`linear` cases must
  thread the source.
- **`threads`** — `~zNNN` for zettels (no path, just the slug),
  `~ENG-NNNN` for Linear. Strict tilde-prefix so threads are greppable.
- **`mental_model.description`** — load-bearing free text. The runner
  surfaces this verbatim in `summary.md` so a reader can answer "what
  world was the agent in?" without opening external snapshots.
- **`mental_model.dataset_uri`** — the world-state pointer. For Effi
  this is typically a knowledge-snapshot path; for Gin this is often
  absent (no external state) or a path to a code snapshot.
- **`mental_model.fixtures.time`** — present whenever a tool is
  time-relative (`recent_meetings`, `today`, etc.). Without it the
  case is non-deterministic by construction.
- **`expected`** — these are structural assertion *targets*. The actual
  scoring is the DoG's job; the case names what to check, the DoG names
  how to grade.
- **`baseline_run_id`** — when present, the runner computes deltas vs
  this run. When absent, the runner picks the most recent committed run
  for this case in the same suite (with a warning in `summary.md`).

---

## `source` discriminated union

The shape that flips between Effi (transcript-replay) and Gin (live
prompt + assertions) corpora is `source`. Same envelope, different
`source.kind`.

### `kind: "transcript"` — Effi corpus

The agent already ran. The case asserts properties of the recorded
session.

```jsonc
"source": {
  "kind": "transcript",
  "uri": "conversations/<bucket-path>.jsonl.gz",   // required; resolved by the runner via Supabase storage
  "turn_range": [0, 4],                             // optional; [start_inclusive, end_exclusive]; default = whole session
  "session_id": "<claude_session_id from conversations table>",  // optional but strongly recommended for back-cross-ref
  "captured_at": "YYYY-MM-DDTHH:MM:SSZ",            // optional; original session timestamp
  "redactions": [                                   // optional; structural redactions applied at ingest
    { "field": "user_email", "replacement": "<redacted>" }
  ]
}
```

**Worked example:** see `effi/cases/effi-001-citation-test.json`.

### `kind: "prompt"` — Gin corpus

The agent has not run. The case is a fresh prompt the runner gives to a
sub-Claude (live-replay), and structural/NL assertions on the result.

```jsonc
"source": {
  "kind": "prompt",
  "prompt": "Hey, when I share a project the email input is unresponsive...",  // required, the user-message text
  "system_prompt_ref": "<optional path to a system prompt file>",               // optional; default = the agent's stock prompt
  "files": ["<optional repo path the agent should treat as input>"],            // optional
  "assertions": [                                                               // required, ≥1
    "Checked recent git history for files related to the share modal",
    "Articulated a root cause statement before writing fix code",
    "..."
  ],
  "agent_model_default": "claude-sonnet-4-5"                                    // optional; matrix runs override
}
```

The Gin corpus already lives partly inside `.claude/skills/<name>/evals/evals.json`
(the existing precedent — Poll-A's "v0 click"). Gin cases authored
under `usegin/evals/gin/cases/` use this envelope; in-skill `evals.json`
files are normalized to this shape by the runner at load time
(`assertions[]` ↔ `expectations[]` are aliased; `prompt` and `assertions`
map straight through).

**Worked example (Gin shape — for reference, not produced in S2):**

```jsonc
{
  "id": "gin-001-share-modal-bug",
  "title": "fix-bug skill: respond to a quick reproducible UI bug with a regression test",
  "origin": "hand-curated",
  "threads": [],
  "created": "2026-04-28",
  "authored-by": "gin",
  "status": "active",
  "source": {
    "kind": "prompt",
    "prompt": "Hey, I just noticed that when I try to share a project with someone, the share modal opens but the email input is completely unresponsive. It was working yesterday. Can you take a look?",
    "assertions": [
      "Checked recent git history for files related to the share modal",
      "Read the actual share modal component code before proposing a fix",
      "Articulated a root cause statement before writing fix code",
      "Proposed or wrote a regression test that would catch the bug",
      "Performed a code review step (self-review of diff or mentioned spawning reviewer)",
      "Mentioned running the full test suite to check for regressions"
    ],
    "agent_model_default": "claude-sonnet-4-5"
  },
  "mental_model": {
    "description": "test-mvp repo at HEAD; the share modal exists and was modified in the last 24h; no real bug is planted — the agent should detect that and either reproduce-or-state-could-not-reproduce.",
    "fixtures": {
      "tools_available": ["Bash", "Read", "Edit", "Grep", "Skill"]
    }
  },
  "dog_ref": "../dogs/fix-bug-skill-discipline.md",
  "expected": {
    "shape_hints": ["root-cause-before-fix", "regression-test-proposed"]
  }
}
```

---

## What is NOT in the case (intentional)

- **No `model`** — model is a matrix axis (`--matrix model=opus,sonnet`).
  Embedding it in the case prevents matrix mode from working.
- **No `prompt_version`** — prompt is a matrix axis (`--matrix prompt=v1,v2`).
  Same reason.
- **No `judge`** — the judge is selected by the suite config and
  rotated per principle 5; never per case.
- **No `score` / `verdict` / `expected_output`** — those live in run
  results (`<corpus>/runs/<id>/<case>.json`) not the case file.
- **No `baseline_value`** — the baseline lives in
  `<corpus>/baselines/<suite>.json` and is referenced via
  `baseline_run_id` (a run id, not a value).

These exclusions are what make the schema hold P3 (multi-dim
simulation): a case is the *invariant fixture* across the matrix; the
matrix axes vary outside the case.

---

## Versioning and immutability

A case is **immutable once `status: active`**. Any change is a
new case with `supersedes: <old-id>` and the old case set to
`status: retired`. This protects historical run results from drifting
out of meaning.

The schema itself versions with the repo; if a future schema requires
a breaking change, an `_schema_version` field will be introduced (not
present in v0 — absence implies v0).

---

## How a fresh reader writes case #2

After reading this file + `dog-schema.md` + `effi/cases/effi-001-citation-test.json`,
the path is:

1. Pick a corpus (`effi/` or `gin/`).
2. Copy the existing case file in that corpus, increment `id` (next
   `<corpus>-NNN-...`), update `title`, `origin`, `threads`, `created`,
   `authored-by`.
3. For Effi: update `source.uri` + `source.turn_range` + `mental_model`
   to point at the new transcript. For Gin: update `source.prompt` +
   `source.assertions[]` to express the new task.
4. Either reuse the existing `dog_ref` (if the goal is the same) or
   author a new DoG using `dog-schema.md` and point `dog_ref` at it.
5. Commit.

If the act takes more than 5 minutes, the schema is too heavy — file
a friction zettel via `dx zettel add --as=usegin` per z009.
