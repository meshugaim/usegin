---
name: cluster-search
description: Search the corpus for prior touches on the same area before declaring a tikur's root cause — 3+ touches = the cluster is the finding, not the incident. Per-zettel discipline makes the cluster visible; this skill is what promotes data to a finding (principle 9, IAF tikur enhancement #5). Used as step 4.5 in the tikur procedure but also invokable standalone whenever a friction zettel "feels familiar." Triggered by phrases like "cluster search", "is this a cluster", "find prior touches on X", "/cluster", or by your own judgment when a friction zettel rhymes with prior friction zettels.
---

# Cluster search

Promotes a single incident to a cluster finding when the same area has been touched 2+ times before. The cluster is the finding (principle 9, war research C8); standalone framing is the failure mode.

## When to use

- **Inside a tikur** (step 4.5, after picking the root cause, before declaring it).
- **Mid-session** when a friction zettel feels familiar — "didn't we hit this before?" That feeling is signal; check the corpus.
- **At synthesis time** when authoring a meta-zettel about a topic — verify the cluster you're claiming actually exists.

Don't use for: code-search (use `rg` or Explore sub-agent); finding a specific past session (use `find-session`); generic context-gathering.

## Procedure

### 1. Pick the area-keyword

What's the noun the cluster might form around? *Autosync race*. *Harness denial*. *CLI input validation*. *Charter ambiguity*. *Empty schema*. The keyword is what the search uses; pick wide enough to catch related framings, narrow enough to avoid noise.

### 2. Search three surfaces

```bash
# Zettels — the corpus
dx zettel list | rg -i <keyword>
rg -i <keyword> usegin/zettel/zettels/

# Tikur records — prior post-mortems
rg -i <keyword> .claude/tikur-records/

# Memory — feedback / reference notes
rg -i <keyword> ~/.claude/projects/-workspaces-test-mvp/memory/
```

Optional, depending on the area:
- `rg <keyword> .claude/skill-lab/` — skill labs (retros, known limitations).
- `usegin/research/<topic>/` — if a research track touched it.
- `git log --oneline --grep=<keyword>` — commit messages.

### 3. Count and decide

| Touches | Reading | Action |
|---|---|---|
| 0 | Fresh | Continue tikur as standalone. |
| 1 | Coincidence | Continue tikur as standalone, but cite the prior in the record. |
| 2 | Maybe — read both | If the *causal mechanism* is shared, treat as cluster. If just topic-adjacent, standalone. |
| 3+ | Cluster | The root cause is at the cluster level, not this incident. |

### 4. Re-state the root cause at the cluster level

Original incident: *"Commit 4f6988745 swept other agents' files under wrong message."*

Cluster re-statement: *"Our autosync mechanism has 4 distinct failure modes; this is the 4th. The shared root cause is the unisolated `.git/index` across concurrent agents."*

The system change targets the cluster, not the symptom. Per principle 8 (error vs negligence), the cluster level is also where the categorization usually lands — incidents are errors; the cluster is what reveals whether the *system* should have prevented the whole class.

### 5. Write the meta-zettel

```bash
dx zettel add --as=usegin \
  --title "<area-keyword> cluster — N touches reveal <shared mechanism>" \
  --placement <closest-existing-zettel> \
  --thread <zid-1> --thread <zid-2> --thread <zid-3> \
  "<body — name the mechanism, list the touches with brief framings, propose the cluster-level system change>"
```

Per principle 9: per-event capture is what made the cluster visible (without z058+z059+z060 each existing, the cluster about CLI-input validation never forms); this skill is what promotes the data to a finding.

## Pitfall guards

- **Don't curate by "obvious relevance"** (memory `feedback_cascade_scope_exploration`). Enumerate the keyword's edges; let the count be the signal.
- **The cluster has to share a *mechanism*, not just a topic.** Three zettels mentioning "autosync" isn't a cluster if one is about scheduling, one about hooks, one about the CLI surface — only when the *causal physics* match.
- **Don't fabricate the cluster.** If 2 touches don't share mechanism, say so and continue standalone. False clusters land bad system changes.
- **Konseptsia trap** (IDF TO"L). A cluster that looks coherent because the same wrong frame is filtering the data is the inverse failure. After picking the cluster, ask: *what would I see if my framing is wrong?* If the answer is "the same evidence," the cluster might be a frame, not a finding.

## Threading
↑z040 (clusters emerge from threading) · ~z057 (frustration cluster — the canonical example) · ~`tikur` skill (step 4.5) · ~principle 05 #9 · ~`feedback_cascade_scope_exploration` memory.

## Source
Principle 05 #9 (war-research SYNTHESIS C8) + IAF tikur enhancement #5 (`usegin/research/war-management/iaf-tikkur/proposed-tikur-skill-enhancements.md`).
