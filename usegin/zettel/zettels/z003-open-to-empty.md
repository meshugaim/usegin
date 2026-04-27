---
id: z003
title: Open-to-empty — create the address before you have the content
type: zettel
authored-by: human
threads: [↑z002, ~z015, ~zettel-custom-future]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

The implementation primitive that makes "no later" survivable.

When you don't yet have the content for a node, you don't drop the thought. You **open** an empty zettel (or task) at a real address and bind your current context to it. The address is real; the content is empty; the wire is pulled-able.

This primitive lives in two places:

- **Task management**: an empty Linear sub-issue is fine. Title only. The thread to the parent + the placement is the value, not the body.
- **`_zettel_custom_`** (the future zettel-creation interface): same primitive — open an empty zettel from any context, the act of opening it threads it to that context automatically.

## Gin side

Open-to-empty has a graph property worth naming: **degree-0 nodes are NOT noise**. They're addresses-without-content, which is different. The traversal layer should treat empty zettels as first-class — when you "pull a wire" you should land on the empty zettel and immediately see its inbound threads, which IS the content for now.

Concrete consequence for the Postgres+pgvector schema (ENG-5381): an empty zettel has no embedding yet, so it won't show up in vector top-k seeds — but its threaded neighbors will, and the recursive walk will reach it. Empty zettels are reachable through their context, not their content.
