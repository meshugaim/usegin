# Effi Sync — Design (purpose.md shape)

Sub-design of ENG-5379 / Slice 2+ of `dx zettel`. How dev-team
zettels get pushed into the **AskEffi App (really)** project canon
so Effi can answer cross-team questions ("what did the dev team
decide about X", "what's our current thinking on Y") grounded in our
own sharpened atomic notes — not just the email/Drive/Fathom firehose
the historian had to dig through (`RD/effi-historian/whiteboard.md`).

The pipe already exists: `effi files add <path>` against the linked
project (per `dogfooding-effi/SKILL.md`, `save-to-effi/SKILL.md`).
The design question is everything *around* that single CLI call —
what, when, how-deduped, what-shape, who-sees-it.

## Intent

Make the dev team's zettel corpus **first-class team knowledge inside
Effi**, so:

- A non-dev teammate (Guy, Chris, future hires) can `effi ask "what
  did the dev team decide about <X>"` and get back the *distilled*
  answer (the zettel) plus its surrounding cluster — not 18 raw email
  hits the historian had to synthesize by hand.
- The dev team's principles, decisions, and friction-zettels become
  retrievable inside the same tool the team already uses for project
  understanding — closing the loop the Apr 16 "first feature request"
  thread named (`raw-quotes/q2-second-brain-FULL.txt §HIT 2`):
  *"things we want 'the project to remember' but don't deserve a spec
  or a meeting."* Zettels are precisely those things, written down.
- The Zettelkasten R&D track (ENG-5379) itself becomes retrievable
  from Effi — closing the historian's gap #5 ("Linear is invisible
  to Effi today; ENG-5379 itself is not retrievable here").

This is **slice 2-or-later** for `dx zettel`. Slice 1 is markdown +
git only (`SLICE-1.md`). Sync into Effi is explicitly in the
"out of scope" list there. This doc designs ahead of need so the
slice 1 conventions don't paint slice 2 into a corner — specifically
the frontmatter shape needs to leave room for an `effi-id:` field
*before* we have 100 zettels needing migration.

## Success Signals

A good rollout of this design looks like:

- [ ] A non-dev teammate runs `effi ask "what's the dev team's
      thinking on <topic>"` and Effi cites zettels, not just emails.
      Citation surface is the zettel filename (`z028-...`) — already
      human-readable per the slug convention.
- [ ] When a zettel is distilled (per `z039` — version bump,
      forward-only), the canon copy in Effi reflects the latest
      version within one sync cycle. No stale "v1 in Effi, v3 in
      git" drift visible to the team.
- [ ] No zettel is silently overwritten in Effi by a re-sync
      (deletion-by-rename, deletion-by-id-collision). The git history
      is the source of truth; Effi's canon is a projection.
- [ ] Dev-team frustration zettels (Principle 4) are present in
      Effi without anyone hand-curating which ones are "fit to
      publish". The design accepts the visibility cost upfront
      (see Dilemma 1) rather than building a curation gate that
      starves capture.
- [ ] First sync of the existing ~43 zettels takes one command
      (`dx zettel sync --to=effi`) and is idempotent — running it
      twice produces zero diff in Effi.
- [ ] The sync surface is **lean enough that abandoning it is cheap**.
      If after a month the team isn't running `effi ask` against
      zettel content, we delete `dx zettel sync` and the
      `effi-id:` frontmatter field with one PR. No daemons to
      decommission, no schema migration to unwind.

---

## Dilemmas surfaced

Five decisions need a manager-side weigh-in before slice 2 codes
this. Each is in z026 dilemma shape. The leans are UseGin's; Lihu
overrides.

### Dilemma 1 — what gets synced

**Decision needed:** Which zettels get pushed into the Effi project
canon, given the canon is visible to the entire AskEffi team
(non-dev humans included)?

**Options:**
- **A. Everything.** All zettels in `usegin/zettel/zettels/` sync,
  including frustration zettels, half-baked ones, mouse-slip
  artifacts (z016).
- **B. Decision zettels only** (z020 shape — those with the
  `> **We decided: ...**` block). The "stable" ones; the corpus a
  non-dev would actually want to query.
- **C. Distillations only** (per `z039` — only zettels that have
  been version-bumped at least once, i.e. survived a re-pass).
- **D. Opt-in via a `effi-publish: true` frontmatter flag.** Default
  off; author flags it explicitly when written.

**UseGin's lean:** **B + opt-out.** Default-publish *decision*
zettels (z020 shape — auto-detectable by the `> **We decided:**`
block in the body), with an `effi-publish: false` opt-out for the
rare "this decision is dev-internal-only." Don't publish frustration
zettels, mouse-slip zettels, or open-to-empty stubs by default —
they're noise to a non-dev querier and they encourage self-censorship
at capture time (the worry the Apr 16 thread named).

**Why:**
- Decision zettels have already passed the "is this worth recording
  for posterity" filter at write time. They're the corpus a Guy or
  Chris would *actually* find useful in `effi ask`.
- The dev-internal-zero-privacy norm (`z028`) holds **inside** the
  dev team. Pushing to Effi is a different boundary — the AskEffi
  team workspace. The decision-only filter respects that boundary
  without building a heavy curation step.
- Distillations-only (option C) under-publishes — most zettels never
  get distilled but are still valuable as decisions. A v1 zettel is
  not less true than a v3 one; it's just less polished.
- Opt-in-only (option D) under-publishes for the same reason
  curation-gates always do — friction kills it (Principle 1).

**Price:** Decision-zettel auto-detection needs a parser
(grep `> **We decided:**` in the Human-side block). Cheap, but
non-zero. Some valuable non-decision zettels (e.g. `z040` —
"clusters emerge from threading") won't make it to Effi by default;
the author can override with `effi-publish: true`.

**Risk:** A frustration zettel about a teammate (Principle 4 —
fighting vs asking) gets `effi-publish: true`'d by accident and
becomes visible to that teammate via `effi ask`. Mitigation: the
`effi-publish` field defaults *false* for non-decision zettels, so
the failure mode requires an active flag.

**For you to weigh:**
- Are you OK with decision zettels (z028, z034, z039, future ones)
  being readable by Guy/Chris/the rest of the AskEffi team via
  `effi ask`? They include phrases like "Nitsan argued (rightly)
  this is not Effi's official use case" (`z028`-adjacent). Some
  decision zettels record cross-team disagreement.
- Should `effi-publish: false` be honored on a decision zettel
  (allowing genuine dev-only decisions), or is that a leak in the
  one-shared-brain principle of `z028` extended to Effi?
- Is there a third boundary worth naming — "publishable to Effi but
  marked internal"? `effi files add --internal` is the default;
  `--external` is the opt-in. We could push *all* decision zettels
  as `--internal`, never `--external`. That keeps them inside the
  AskEffi team workspace without ever risking a customer-facing
  leak.

### Dilemma 2 — how sync runs

**Decision needed:** When does `dx zettel → effi` actually fire?

**Options:**
- **A. Manual.** `dx zettel sync --to=effi` run by the human (or
  by Claude when asked). Authors decide when.
- **B. Hook on `dx zettel add`.** Every new publishable zettel
  (per Dilemma 1's filter) syncs immediately as part of the add.
- **C. Background daemon.** Polls the zettels directory, syncs
  diffs every N minutes.
- **D. Git post-commit hook.** When zettel-touching commits land,
  a sync runs.

**UseGin's lean:** **A — manual `dx zettel sync --to=effi`.**

**Why:**
- Slice 1's bar (`SLICE-1.md` "Lean") is "minimum infra to ship."
  A manual command is the smallest surface that proves the pipe
  works end-to-end.
- Hook-on-add (B) couples two systems that should be allowed to
  drift — the markdown corpus is the source of truth; Effi is a
  projection. If the projection breaks (auth expired, Effi down,
  network), zettel writing should not block.
- Background daemon (C) is a process to babysit, a log to read,
  and a failure mode to debug. We don't have one for `dx his` or
  any other tool in `tools/`. Don't introduce the pattern for the
  zettel sub-app first.
- Git post-commit hook (D) is invisible magic that surprises
  cross-machine contributors when their commit triggers a write to
  *production* Effi. Too remote-action-at-a-distance.

**Price:** Sync is "as fresh as the last time someone ran it." If
the team forgets, Effi has stale dev-team knowledge. Mitigation: the
command is in the dx surface and easy to alias; if friction emerges
("I always forget"), slice 3 can add a daemon.

**Risk:** Stale-Effi means a non-dev teammate queries about a
recent dev decision and Effi cites the prior version. Acceptable
slice-2 cost; the email/Fathom firehose has the same staleness.

**For you to weigh:**
- Should `dx zettel add` for a publishable zettel **print a hint**
  ("Run `dx zettel sync --to=effi` to push this to the team
  canon") so the trigger isn't memory-resident? UseGin lean: yes,
  this is z003 open-to-empty for the daemon — surface the address,
  let the human take the action.

### Dilemma 3 — de-dup / re-sync

**Decision needed:** How does Effi know "this is the same zettel I
already have, just updated" vs "this is a new zettel"?

**Options:**
- **A. Filename collision.** `effi files add` re-uploads when the
  filename matches; same filename = same zettel. Relies on Effi's
  upsert semantics (need to verify these exist).
- **B. Frontmatter `effi-id:` field.** Sync command uploads the
  file, Effi returns an id, sync writes it back into the markdown
  frontmatter. Subsequent syncs use the id to upsert.
- **C. Content hash.** Sync hashes each zettel; only re-uploads
  when the hash changed. Tracks the previous hash in a sidecar
  (`.effi-sync-state.json` in `usegin/zettel/`).
- **D. No de-dup; full re-sync every time.** Delete-and-re-upload
  the whole corpus. Idempotent by brute force.

**UseGin's lean:** **B (effi-id frontmatter) + C (content hash) in
combination.** `effi-id` for identity (so Effi knows *which* file
to update); content hash for "skip the upload if nothing changed
since last sync" — both stored in frontmatter so the source of truth
stays in git.

**Why:**
- Filename collision (A) breaks the moment a zettel gets renamed
  (typo fix in slug, or the title sharpens). The slug isn't stable;
  the id is. Don't bind sync identity to a mutable name.
- Content hash alone (C) doesn't tell Effi *which* file to
  overwrite — it just tells the sync tool whether to skip.
- Full re-sync (D) is robust but it's O(N) every run, it churns
  Effi's vector index, and it loses the audit trail (what changed
  between syncs). Also `effi files add` may not have a "delete-all"
  primitive; verify before counting on this.
- The combined approach keeps both pieces in the markdown
  frontmatter — no sidecar state file, no out-of-band metadata to
  lose. `git log -p <file>` still tells the whole story (`z039`).

**Price:** First sync needs to write back to the markdown file
(append `effi-id:` to frontmatter). That's a write that mutates
the source corpus from the act of syncing — feels backwards. Also
needs the `effi files add` API to actually return a stable id; if
it doesn't, this design needs a CLI gap to be filed (per
dogfooding-effi "rough edges").

**Risk:** Two simultaneous syncs from two machines (different dev
team members) race on writing `effi-id:` back. Slice 1 already has
a `nextId()` race for `dx zettel add` (`SLICE-1.md` "Known
limitations"); this is the same shape, same severity. Slice 2's
Supabase backend resolves both.

**For you to weigh:**
- Do you accept that the first sync mutates the markdown corpus
  (writes `effi-id:` back into each file)? It's a one-time write
  per zettel; subsequent syncs are read-only against the corpus
  unless a new zettel is added. Alternative is a sidecar
  `usegin/zettel/.effi-sync-state.json` — keeps the corpus pure
  but adds out-of-band state.
- Is it OK for the version bump (`z039`) to *not* trigger a
  separate Effi entry — the same `effi-id` just gets overwritten,
  and the version history lives only in git? UseGin lean: yes,
  consistent with z039's "git is the version trail."

### Dilemma 4 — what format

**Decision needed:** What does Effi's canon copy of a zettel
actually look like?

**Options:**
- **A. Raw markdown.** Upload the file as-is, frontmatter and all.
  Effi's chunker handles it.
- **B. Stripped markdown.** Strip frontmatter, push only the body
  (the Human/UseGin/Consultant sides). More readable in Effi's UI
  for non-dev humans.
- **C. Distillation summary.** Generate (LLM-pass at sync time) a
  one-paragraph plain-prose summary of the zettel and push that
  alongside or instead.
- **D. Topic digest.** Cluster zettels by thread (per `z040`) and
  push *clusters* as single files, one per topic.

**UseGin's lean:** **B — stripped markdown, body only, with a tiny
synthetic header.** Header carries the zettel id, title, threads
(humanized), version, and a "from the dev team's zettel corpus"
provenance line. Body is the Human + UseGin sides verbatim.

**Why:**
- Raw frontmatter (A) leaks `session: <uuid>`,
  `authored-by: usegin`, and other dev-internal noise into Effi's
  citation surface. A non-dev querier doesn't need
  `session: 5d7f3c80`.
- LLM-distillation-at-sync (C) introduces a lossy step at the
  sync boundary — the very thing the team's "WHY gets lost"
  thesis warns against (`raw-quotes/q5-FULL.txt §1`). The zettel
  is *already* the distillation; don't distill the distillation.
- Topic digests (D) are nice for readability but they pre-impose
  cluster structure — `z040` says clusters emerge from threading,
  they are never imposed. Don't bake a clustering step into sync.
- Stripped-markdown-with-header (B) is the cheapest format that
  makes a zettel readable to a human browsing Effi *and* preserves
  the threads field as humanized text Effi can chunk and cite.

**Price:** Sync needs a small renderer (frontmatter → header). Not
hard; ~30 lines. The header convention needs to be stable so the
chunker treats it the same way across re-syncs.

**Risk:** Effi's chunker splits the header from the body and cites
just the body, losing the "this is from the dev team zettel corpus"
context. Mitigation: filename slug already encodes the id
(`z028-...`); the slug is what Effi cites. Header is gravy.

**For you to weigh:**
- Should the **threads** field render as inline links in the
  stripped markdown (e.g. `*Threaded to:* z020, z028`)? This makes
  cluster-following possible inside Effi's UI. UseGin lean: yes —
  it's the cheapest way to expose the graph structure to a
  non-dev browser.
- Do you want the header to mention "dev team only — do not cite to
  customers" or similar? Currently UseGin lean is to not — the
  `--internal` flag (Dilemma 1) carries that semantic; restating
  it in the header is belt-and-suspenders that makes the corpus
  feel more guarded than it is.

### Dilemma 5 — two-way (feedback flowing back)

**Decision needed:** Should team feedback in Effi (questions,
comments, "Effi noticed two zettels disagree") flow back into the
zettel corpus as new zettels?

**Options:**
- **A. One-way only.** Zettels → Effi. Feedback in Effi stays in
  Effi. Slice ∞ if ever.
- **B. Manual.** A human reads Effi, decides "this is a real
  observation," writes a new zettel by hand.
- **C. Semi-automated.** `dx zettel from-effi <session-id>` pulls
  an Effi conversation back as a draft zettel for review.
- **D. Fully automated.** Effi gets write access to the zettel
  corpus, drops new zettels when its semantic-drift detection
  fires (the "Time-Awareness" feature from the Jan 29 architecture).

**UseGin's lean:** **A — one-way only, slice 2.** Flag B as the
slice-3 candidate when there's evidence Effi-side conversations are
producing zettel-worthy material the dev team is missing.

**Why:**
- Slice 2's job is to prove the *first* loop closes — zettel exists,
  zettel queryable in Effi, non-dev gets a useful answer. Two-way
  doubles the surface and triples the failure modes (auth in both
  directions, write conflicts, "who authored this zettel" questions
  for an Effi-generated one).
- Manual (B) is what a thoughtful human does anyway — read an
  interesting Effi conversation, distill the insight, write the
  zettel. Don't tool what humans already do well.
- Fully-automated (D) collides head-on with the
  "is-this-Effi's-job?" debate from Apr 16 (Nitsan vs Oria).
  Resolving that debate is *not* slice 2's job.

**Price:** Effi-side conversations stay ephemeral for now. If
someone asks Effi about a dev decision and Effi *almost* gets it
right, the gap doesn't auto-feed back into the corpus.

**Risk:** None for slice 2. The risk is that we *like* one-way and
forget to revisit when two-way would actually pay off. Mitigation:
file as ENG-5379 follow-up; revisit-trigger = "the team is asking
Effi questions about zettels that Effi answers ambiguously, and a
human is then writing a zettel to disambiguate" → that's the
signal that semi-automated capture would save real time.

**For you to weigh:**
- Is "one-way for slice 2, revisit for slice 3" the right call, or
  do you want to design two-way now (even if not built) so the
  frontmatter / id scheme leaves room?
- If two-way ever happens, should Effi-authored zettels carry
  `authored-by: effi` (a third actor type, alongside `human` and
  `usegin`)? Worth declaring now so the type field doesn't need a
  schema migration later.

---

## Known Limitations

- **`effi files add` upsert semantics unverified.** Dilemma 3
  assumes `effi files add` returns a stable id and supports
  re-upload-by-id (or filename). Per `dogfooding-effi/SKILL.md`'s
  "rough edges" section, gaps should be surfaced when hit. If the
  CLI doesn't have upsert yet, the design needs a CLI gap filed
  before slice 2 can build sync.
- **Effi's chunker behavior on synthetic-header markdown is
  empirical.** Dilemma 4's stripped-markdown-with-header design
  assumes the chunker keeps the header attached to the body. We
  have no test of this for our project; first slice-2 dry-run
  must verify and adjust the header shape if Effi splits it off.
- **No `effi files delete` is documented.** If a zettel is renamed
  (slug change without id change) or marked `effi-publish: false`
  retroactively, sync needs to remove the old Effi entry. Behavior
  TBD; may be a gap to file.
- **Cross-machine sync race** (same shape as `dx zettel add`'s
  `nextId()` race, `SLICE-1.md`). Two team members running sync
  simultaneously could double-upload the same zettel before either
  writes `effi-id:` back. Slice 1's "single-author, low rate"
  acceptance applies here too; slice 3's Supabase backend resolves
  it via atomic id allocation.
- **Linear is still invisible to Effi** (historian gap #5). Even
  with this design shipped, ENG-5379 sub-issues are not in Effi's
  index. This is **out of scope for zettel sync** — it's a
  separate Effi-side connector. Surface upward, do not try to
  paper over by uploading Linear issue summaries as zettels.
- **Frustration-zettel privacy boundary is genuinely new.** `z028`
  established zero privacy *inside* the dev team. This design
  carves out `effi-publish: false` *implicitly* for non-decision
  zettels — that's an extension of `z028`, not a contradiction.
  Worth naming as a follow-up zettel once Dilemma 1 resolves.

## Ideas / Notes

- **Sync as a forward-only operation parallels distillation
  (`z039`).** Both are "git is the trail; the canonical artifact is
  the latest version; old versions are recoverable but not
  browsable." Same mental model, two surfaces.
- **The first sync is the audit moment.** Running
  `dx zettel sync --to=effi` for the first time on the existing 43
  zettels will surface any per-zettel quirks (malformed
  frontmatter, missing titles, weird thread references) that the
  parser tolerates but Effi might choke on. Treat the first run
  as a corpus-validation pass.
- **A zettel about this zettel.** Once Dilemma 1 resolves, write
  a `z0NN-effi-publish-default-is-decision-zettels.md` capturing
  the decision in z020 shape. That zettel itself will be
  publishable per its own rule (it's a decision zettel) — nice
  recursive sanity check.
- **Cluster-level retrieval might want to cheat the format
  decision later.** If Effi-side queries consistently miss "the
  whole z028→z034→z039 thread" because each zettel is chunked
  separately, slice 3 might want to push *thread roots* with their
  descendants concatenated. That's Dilemma 4 option D revisited
  with evidence, not pre-emption. Hold.
- **The save-to-effi skill is the manual analog.** Right now a
  human can `effi files add /tmp/effi-drafts/<slug>.md` for any
  one-off. After this design ships, zettels are the *systematic*
  version of save-to-effi for dev-team knowledge. The skill stays
  for non-zettel content (one-off summaries, design notes that
  aren't atomic claims).
- **Dogfooding pressure.** The Jan 29 architecture talks about
  ingesting → extracting essence → mapping to graph
  (`raw-quotes/q1-zettelkasten-FULL.txt`). The dev team's zettel
  corpus *is* "essence already extracted." Pushing it into Effi
  closes the loop the product roadmap is aiming for, on the dev
  team first — exactly the principle-3 pull-Claude-into-our-world
  pattern.

## Changelog

| Date | Change | Motivation |
|------|--------|-----------|
| 2026-04-27 | Design drafted in purpose.md shape. | Slice 2 of `dx zettel` needs the Effi sync question answered before frontmatter conventions in slice 1 freeze (`effi-id:` field reservation). Five dilemmas surfaced for Lihu. |
