---
date: 2026-05-08
authored_by: Azisa (sub-Zisser, from Oria instruction)
status: load-bearing — runs at every spawn-of-another-agent and at every return-from-spawn
related:
  - principles/02-place-for-everything.md
  - principles/03-orchestrate-not-execute.md
  - principles/04-loop-back.md
---

# Principle 8 — Shu"v and G"G (command-and-control + sector boundaries)

> **Speaker convention:** the live user may be Oria, Lihu, or Nitsan. Check
> the `LIVE USER:` banner / `userEmail` / in-chat signals before binding a
> decision or attribution to a name. The Hebrew terminology in this principle
> was given by Oria on 2026-05-08.

Two IDF doctrinal terms, translated to AskEffi's agent fleet.

## The IDF concept

**Shu"v / שליטה ובקרה** — *Shliṭa u-Vakara*, command-and-control. A
commander knows where their forces are, knows the mission of each, and
knows when one runs into another. The commander has a single picture
of the battlefield: *where are the forces, what are their missions*.

**G"G / גבולות גזרה** — *Gvulot Gizra*, sector boundaries. Each force
has a defined sector. Sectors don't overlap unintentionally. When two
sectors meet, the seam (the *gizra-yad-ima* — adjacent flank) is named
explicitly with a coordination protocol. *G"G is a term inside Shu"v* —
sector discipline is one of the things the commander tracks.

In English we'd call this "command-and-control plus deconfliction".

## Why an agent fleet needs this

The fleet today: Gin, Zisser, Mark, Wes, Ron, Tim, Yohai, Poll, Sam,
sub-Zissers (Azisa), and ad-hoc spawns. Any of them can spawn any
other. Sub-agents inside sub-agents. Three humans calling Zisser in
parallel. Multiple devcontainers running at once.

The failure modes we've already paid for:

1. **Parent unaware of in-flight child.** A Zisser spawned via `/zisser`
   from one env doesn't see another Zisser session running in another
   env. Concrete case (this session, 2026-05-08): the parent Zisser
   was synthesizing Doppler ground-down work, and only learned mid-turn
   from Oria that *another agent was already working on Doppler in
   parallel from a different env*. Parent had no way to discover the
   peer; the peer had no way to be discovered.

2. **Sibling sub-agents stepping on each other's worktree.** Memory:
   `feedback_parallel_agents_share_git_worktree` — concurrent commits
   cross-contaminate; one agent's untracked file lands under another's
   commit message; one agent's "fix" deletes a peer's just-created file.

3. **Sibling sub-agents racing on shared mutable state.** Memory:
   `feedback_parallel_workers_shared_state` — auth profile, DB rows,
   ports, dev-server PIDs. Sequential is the safe default; parallel
   only when the state is verified disjoint.

4. **Two agents redoing each other's work.** Two charters dispatched
   independently against overlapping sectors; both return having
   produced near-identical artifacts; the synthesis pass discovers it
   too late for either to course-correct.

5. **Charter without sector.** A charter says "look into Slack" without
   naming which paths it touches; another charter says "look into
   integrations" — neighbors with no declared seam, predictable
   collision.

The doctrine fix: make the fleet visible (Shu"v) and make each agent's
sector explicit (G"G).

## Shu"v contract for AskEffi

**Every agent that is spawned, or that spawns another, MUST be
discoverable while it runs.** Discoverable means: name, charter file,
expected sector (paths it will touch), expected duration estimate,
parent identifier. The minimum unit is the *charter file* in
`zisser/dispatched/<date>-<topic>.md` — that file already exists by
convention; principle 8 promotes it to *registry*.

The commander (the spawning agent, or Zisser at the top of the tree)
maintains the single picture by reading the registry. Today that
registry is `zisser/dispatched/`; principle 8 mandates it stay
authoritative — no agent runs without a charter file landed
*before* the spawn fires.

Charter file MUST include (in addition to the existing shape):

- `parent_session_id` — the session UUID of the spawning agent (cheap;
  available from `~/.claude/projects/.../<id>.jsonl`).
- `expected_sector` — paths in / paths out / external systems touched.
- `expected_duration` — coarse estimate (`<5min`, `<30min`, `<2h`,
  `>2h`).
- `started_at` — UTC timestamp when `Agent` (or shell-spawn) actually
  fires.
- `status` — one of `pending` / `in-flight` / `returned` / `parked`.

Status `in-flight` is removed by the parent on return (set to
`returned`). A stale `in-flight` older than its `expected_duration` is
a Shu"v alarm: the parent investigates before spawning a new sibling
in the same sector.

## G"G contract for AskEffi

**Every charter declares its sector. Every neighbor is named.**

Sector declaration:

```yaml
sector:
  paths_in: [zisser/plans/, zisser/notes/, ~/.claude/projects/**/*.jsonl]
  paths_out: [zisser/dispatched/<this-charter>-out.md]
  external_systems: [linear, doppler-dashboard]   # named; or `[]`
  mutable_state:                                  # things that race
    - git_worktree: /workspaces/test-mvp          # main worktree
    - dev_server_ports: []                        # none touched
```

Neighbor declaration — only required if a neighboring sector exists at
spawn time:

```yaml
neighbors:
  - charter: zisser/dispatched/2026-05-08-slack-state.md
    seam: both read agent JSONLs; reads disjoint by topic; no overlap expected
  - charter: zisser/dispatched/2026-05-08-doppler-state.md
    seam: SHARES `~/.claude/projects/` reads; disjoint by file; both read-only
```

The seam clause is the load-bearing part of G"G: *when sectors meet,
the seam is named*. "Both read this directory, disjoint by file" is a
valid seam. "Both write to the same migration" is not — that's not a
seam, that's a collision; one of the sectors must move.

## The seam protocol

When two sectors meet, the **parent of both** writes the seam in the
parent's plan or charter:

> "Track A reads X. Track B reads Y. Both touch Z; A reads, B writes;
> coordinate by A waiting for B's `status=returned`."

Three valid seam shapes:

1. **Read-only crossing.** Both read the same substrate; neither
   writes. Seam: "no coordination needed; reads are idempotent."
2. **Sequential by status.** B depends on A; B charter has
   `depends_on: <A-charter>`; B does not start until A's status is
   `returned`.
3. **Disjoint by partition.** A and B both write, but to disjoint
   paths/keys/configs. Seam: "A writes paths matching <pattern_A>;
   B writes paths matching <pattern_B>; no overlap by construction."

If none of the three apply — the sectors collide; one moves.

## What this looks like in returns

When a sub-agent returns to its parent, the return shape adds two
lines:

```
Captured: <…>
Dispatched: <…>
Sector touched: <paths_out actual>
Seams crossed: <if any sibling's sector touched, name it; else "none">
```

The "seams crossed" line is the post-hoc Shu"v check: did the agent
actually stay in its declared sector. A surprise here is a finding.

## Coexistence with prior principles

- **P2 (place for everything):** the registry is `zisser/dispatched/`;
  no new directory invented.
- **P3 (orchestrate, don't execute):** Shu"v formalizes *what the
  conductor must know* to conduct.
- **P4 (loop back):** the `status` field IS the loop-back signal.
- **P5 (act-and-ask):** charter declarations are part of the act, not
  a question. If the sector is unclear at spawn time, dispatch with
  the best-guess sector and the charter's first turn is to *narrow
  the sector* — declared in the return.

## The motivating example (cite by name)

Doppler ground-down, 2026-05-08. Parent Zisser dispatched a
6-track investigation into Doppler + Slack desired-vs-actual state.
Concurrently — and unknown to the parent until Oria mentioned it
mid-session — a different agent was working on Doppler-related work
from a different env. Both sessions were authoritative-feeling; neither
knew about the other. The synthesis the parent produced is sound, but
*both directions could have been working in parallel without rework
collision* if the registry had been the single picture.

This is the canonical Shu"v failure: not a wrong answer, just an
expensive blind one. G"G failure is paired: neither charter named the
sector well enough that an outside reader could see the overlap with
the in-flight peer in another env.

## Two faces

### Human face

When you ask Zisser "what's in flight?" — Zisser answers from the
registry, not from memory. If the registry is empty, the answer is
"nothing in flight"; if the registry says something is in-flight, that
fact is verifiable (charter file path, `started_at` timestamp,
`expected_duration`). You should never have to remind Zisser of an
agent he already spawned.

When two of you (Oria, Lihu, Nitsan) ask Zisser to look at related
things from different envs — Zisser sees both your charters and either
unifies them, sequences them, or names the seam. He doesn't double-spawn
a third agent that does the same work.

### Agent face

You spawn? You write the charter first, including `sector` and
(if applicable) `neighbors`. Charter lands in `zisser/dispatched/`
*before* the `Agent` tool (or shell-spawn) fires. You set
`status: in-flight` and `started_at` in the same write that fires the
spawn. On return, the spawning agent flips `status: returned` and
appends the actual sector touched.

You receive a charter? Your first turn includes a sector check: are
the paths I'm about to touch a subset of `paths_in` ∪ `paths_out`? If
not, the charter is wrong — return early, ask the parent to widen the
sector or split into two charters.

You're at the top of the tree (Zisser)? You hold the registry. You
read it before every spawn. When you see two charters with overlapping
sectors and no declared seam, you pause and write the seam.

## What this is *not*

- Not a real-time process orchestrator. We don't need ZooKeeper or a
  lock service. The registry is markdown files; eventual consistency
  is fine because *humans pour faster than agents collide*.
- Not a new directory. Lives in `zisser/dispatched/`.
- Not a permission gate. Spawns aren't blocked by missing fields; the
  parent self-enforces. A Tikur after a collision will say "the
  sector was missing" and we'll add it next time.
- Not a replacement for autosync / worktree discipline. Memories
  `feedback_parallel_agents_share_git_worktree` and
  `feedback_parallel_workers_shared_state` are the *physical* layer;
  Shu"v / G"G is the *semantic* layer above them. Both are needed.

## Mechanism (proposed)

Two cheap moves and one richer one. **The first lands today** — a
template + a one-shot script to enumerate in-flight agents from the
registry. The richer DX one lives in `zisser/inbox/` for whoever
picks it up.

### Move 1 — registry conventions (lands today)

The frontmatter additions named above (`parent_session_id`,
`sector`, `expected_duration`, `started_at`, `status`, optional
`neighbors`) become the canonical charter shape in
`zisser/agents.md`. Existing charters don't backfill — they're
historical. Going forward, charters carry the fields.

### Move 2 — `zisser/dispatched/` becomes self-listing

A read-only enumerator that reads every charter file in
`zisser/dispatched/`, parses the frontmatter, and prints the
in-flight set:

```
in-flight (3):
  2026-05-08 14:22 [<2h] /zisser/dispatched/2026-05-08-doppler-state.md
                         sector: doppler-dashboard, .env*, scripts/doppler/
                         parent: 502de9c7  duration-budget: 2h  elapsed: 18m
  2026-05-08 14:22 [<2h] /zisser/dispatched/2026-05-08-slack-state.md
                         sector: api.slack.com, slack/oauth/, .env*
                         parent: 502de9c7  duration-budget: 2h  elapsed: 18m
  2026-05-08 14:25 [<5m] /zisser/dispatched/2026-05-08-shuv-doctrine.md  ← me
                         sector: zisser/principles/, oria-crazy-world/ground/personas/
                         parent: <azisa-parent>  elapsed: 3m
seams:
  none flagged
returned (recent 5): …
```

Output shape only; no new daemon, no DB, no service. A single shell
script (or `bun` script) that reads the directory each call. Lives at
`zisser/bin/in-flight` (proposed; not implementing today). The
parent of every spawn calls it before spawning, prints the in-flight
set into its own context, and reasons about the seam.

### Move 3 — `dx agents` (richer, deferred)

A `dx agents` subcommand that combines:

- The registry (Move 2).
- Live JSONLs (`~/.claude/projects/-workspaces-test-mvp/`) — sessions
  with recent activity that aren't in the registry are *unregistered
  in-flight* (a Shu"v gap to surface).
- `tools/bin/session list` cross-projects — agents running in other
  Gins / other devcontainers.
- Cross-env discovery (the open question): how does *this* env see an
  agent running in another env. The agent-records sync
  (`reference_agent_records`) makes it possible — JSONLs from another
  env appear in `~/agent-records/` after sync. So `dx agents
  --cross-env` is a pull from there.

Move 3 requires real implementation work (DX feature). Not today.
Charter goes to `zisser/inbox/2026-05-08-dx-agents-shuv-mechanism.md`.

## Adoption stop condition

Principle 8 holds when:

- Every charter written after 2026-05-08 carries the sector +
  in-flight fields. (Ratchet — old charters not backfilled.)
- Zisser reads `zisser/dispatched/` for in-flight peers before
  every spawn.
- Every Tikur for an agent collision asks "was the sector
  declared? was the seam named?" — answers feed back into the
  charter template.

(authored 2026-05-08 by Azisa from Oria instruction: "Write a note to
us that we want agents to be aware of each other. Read about Shobh /
שו״ב — שליטה ובקרה. גבולות גזרה. היכן הכוחות ומה המשימות. הג״ג הוא
מונח בתוך שו״ב.")
