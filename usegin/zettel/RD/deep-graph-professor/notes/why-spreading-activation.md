# Why "spreading activation", not "vector top-k"

A short note backing the §2 query in the whiteboard.

## The instinct: just embed everything and ANN-search

The default modern instinct for "find related notes" is: embed every note,
embed the query, return top-k nearest. Done.

This works for *similarity*. It does not give us *associative recall*.

## The difference, concretely

Associative recall, in cognitive psychology terms, is *ecphory* — a partial
cue activates a complete memory trace, which in turn activates its
neighbors. The hallmark is that an irrelevant-by-cosine note can surface
because it sits next to a relevant one in the explicit graph.

Two examples from our actual workflow:

1. *I'm fighting some DX thing.* Semantic search on "DX" returns the
   recent frustration zettels. Useful. **But it misses the earlier
   decision** that *caused* this DX shape — that decision's body might
   talk about "session boundaries" or "agent isolation", not "DX". An
   associative walk follows `frustration --about_artifact--> session-X
   <--decision-- "agent isolation in session-X"` and finds it.

2. *We're discussing whether to add feature toggles.* Semantic search on
   "feature toggle" returns toggle-related notes. **An associative walk
   surfaces the retrospective from 6 months ago where we said "we'll
   regret keeping toggles around" — even though that retro doesn't say
   the word "toggle"**, because it's `tagged` to the same `topic:rollout`
   node.

The first finding is good. The second is the magic. The schema and query
make the second one routine.

## How spreading activation gives us this

The query in v1-postgres.sql is doing this:

1. Seed the walk with the top-k vector matches.
2. Walk the *explicit and derived* edges from those seeds, decaying
   activation by hop and multiplying by edge weight.
3. Aggregate: a zettel reachable through multiple paths gets the *max* of
   the activations (could also be sum; max is more conservative).
4. Sort by activation, return top-N.

This is the same algorithm cognitive psych has used since the 70s
(Collins & Loftus 1975) and that recent KG-RAG papers re-derived in 2025
(EcphoryRAG, the alphaXiv spreading-activation paper). The novel thing for
2025-26 is that the *seeds* are vector-similarity-ranked, not
keyword-matched — but the *walk* is the same old idea.

## Why we don't bake this into a vector-DB-native pipeline

Vector DBs (Pinecone, Weaviate, Qdrant) have started shipping "graph
overlays" — a layer where you can store some edges next to vectors. They
are catching up. But:

- The walk needs to traverse heterogeneous edge kinds with kind-specific
  weights and filters. That's a SQL query, not a vector-DB primitive.
- Our explicit edges (links_to, supersedes, tagged) need real referential
  integrity to nodes that are already first-class rows. That's a join
  table. Putting it next to the vectors costs us nothing if both live in
  Postgres.
- The bridge step — turn cosine-similarity into similar_to edges with
  weights — is dead simple in Postgres (one INSERT … SELECT … ORDER BY
  embedding distance). In a vector DB we'd be re-running the ANN at query
  time inside the recursion, which is much more expensive.

## When this would stop being enough

If we ever need to do *real* graph algorithms at runtime — community
detection, PageRank, shortest path on a graph too big to materialize —
SQL CTEs run out of room and Cypher / GQL on a real graph engine starts
earning its keep. But for the spreading-activation pattern that
*associative recall* literally is, we're using exactly the right hammer.
