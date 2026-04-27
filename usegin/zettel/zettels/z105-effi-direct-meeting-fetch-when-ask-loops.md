---
id: z105
title: Effi-direct meeting fetch beats `effi ask` for paraphrased English queries against Hebrew transcripts
type: zettel
authored-by: usegin
threads: [↑z040, ~z038, ~z011]
created: 2026-04-27
session: c9d84b44-7654-4727-af3e-5fff83a1f771
---

## Human side

Asked Gin: "what did Oria say in today's meeting about 'it's never prioritized, I can get it done for tomorrow'." Gin tried `effi ask`, watched it loop 15+ semantic-search rounds, get compacted, then loop again on the resumed session — never surfacing the quote. Gin then went around `ask`, fetched the transcript directly, grep'd `מחר|עדיפות`, found the moment in 3 commands. The friction is repeatable; the fix lands in `use-gin`.

## UseGin side

Two converging failure modes when the corpus is Hebrew and the query is paraphrased English:

1. **Semantic search misses across language + paraphrase boundary.** "It's never prioritized, I can get it done for tomorrow" is Lihu's English paraphrase of Oria's Hebrew "כן, אני יכול לעשות שמחר ילנו וי אפס של איבל" said in response to Guy's "אנחנו בחיים לא נתעדף את כל הסיפור של האיבה." Effi's embedding model retrieves chunks about chat history and seamless deploy (other recent topics) but not the eval exchange — the shared semantic surface is too thin.
2. **Effi compacts mid-investigation.** Multiple semantic-search results exceeded Effi's per-tool token budget; the runtime saved them to local paths Effi could not read back (no Read tool exposed). After compaction, the resumed Effi started fresh attempts with the same query shape and looped again.

The workaround when you already have the meeting entity id (Effi's first search reliably surfaces it):

```bash
effi --profile <you>:prod meetings show <meetingId> --transcript > /tmp/m.json
jq -r '.meeting.transcript' /tmp/m.json > /tmp/t.txt
grep -nE '<keyword>|<hebrew-keyword>' /tmp/t.txt
```

The whole transcript is one JSON blob; Gin's local `grep` does the search Effi's embeddings could not. Worked in 3 commands, ~10 seconds.

**Pattern, not just a recipe.** The same shape applies whenever:
- The corpus is in a language Effi's embedder doesn't index well (Hebrew, Spanish — see z011).
- The query is a paraphrase several rephrasings away from the source.
- Effi has already surfaced the entity id but can't surface the chunk.

In those three conditions, the CLI direct path beats `effi ask`.

**First-place capture (z040 reified).** Added under `### Pull a meeting transcript directly (when effi ask loops)` in `.claude/skills/use-gin/SKILL.md` the same turn the friction landed. Next Gin who asks "can I get the full transcript without going through `ask`?" will read it there instead of looping.

## Threading

↑z040 (clusters emerge — this is touch #2 on "Effi semantic search misses Hebrew/paraphrased queries", paired with `reference_effi_semantic_search_gaps` in memory). · ~z038 (effi session JSONLs — different escape hatch, same instinct) · ~z011 (team languages — Oria/Lihu Hebrew default; the embedder doesn't carry).
