# Modern-Tools Professor — Whiteboard

**Manager:** Modern-Tools Professor
**Parent:** ENG-5379 — Zettelkasten-inspired shared 2nd brain for the Effi dev team
**This issue:** ENG-5382
**Reader:** a developer building our system. Opinionated, not balanced.
**Captured:** 2026-04-27.

---

## 0. The lens we judged everything through

Five filters from `principles/` and from the parent goal:

1. **Low-friction capture** for both humans *and* Claude. If a zettel takes more than 3 seconds, it doesn't happen. (Principle 1)
2. **Append-mostly preservation of trajectory** — reverted decisions stay visible. (Principle 2)
3. **Pull Claude into the management layer.** Zettels are *meta* (intent, lessons, frustrations), not implementation. (Principle 3)
4. **Multiplayer.** A *team's* shared 2nd brain, not one human's solo PKM. Almost the entire PKM industry fails this filter.
5. **Effi-self-managed eventually.** Effi must be able to read *and* write this brain through the same interface a human uses. (Parent goal stretch.)

A sixth de-facto filter emerged during scouting: **file-over-app** (Steph Ango's phrase). Plain markdown in git. Anything proprietary-format is a non-starter for a brain that will outlive the tool we picked.

---

## 1. Top — the shortlist (TL;DR)

Five candidates that map best to *our* requirements. Ranked.

### #1 — Plain markdown in git + Claude Code skills, Karpathy-style. **(Recommended starting point.)**

This is what we are *already* doing in `gin/zettel/`. The Karpathy LLM Wiki pattern (§2) is the closest ideological match to our principles, and the only configuration where every filter above is satisfiable today:

- Files are plain markdown → file-over-app, lives in *our* repo, auditable in PRs, no vendor.
- Capture is whatever-is-already-open: a CLI command, a Claude session, a `git commit`, an editor, eventually a slash command from Effi.
- Claude is not bolted on — it *is* the maintainer. Skills (`/wiki`, `/save`, `/process-inbox`, `/lint`) are the canonical interface.
- Multiplayer = git. Same merge model the team already uses for code. PRs preserve trajectory by construction (Principle 2).
- Effi can read/write the same files Claude does, the day we point her at the directory.

What's missing and we'd build: associative *retrieval* (the "pull a wire, see the rope" promise). Karpathy's pattern uses LLM read-time scanning of `index.md` plus a "hot cache" — fine for a personal brain, weak for a team brain that may grow into thousands of zettels. We'd add the **Deep Graph Professor's** output (ENG-5381) and likely an MCP-exposed semantic search layer here. See "what we'd add" in §2.

### #2 — Obsidian as the human IDE, *over the same git directory*

If the team wants a UI for browsing/linking instead of just `cat`/editor, Obsidian sits on top of plain markdown without changing the underlying brain. Pair with:

- **`obsidian-claude-code-mcp`** (Sinnott) or **`mcp-obsidian`** (Pfundstein) — exposes the vault via MCP so Claude Code talks to it from anywhere.
- **Agent Client** plugin — embeds Claude Code/Codex/Gemini *inside* Obsidian's pane.
- **`claude-obsidian`** (AgriciDaniel) — production reference of Karpathy's pattern with 11 skills already written. Cribbing surface area for our own skills.

Tradeoff: adds a tool. Doesn't replace #1; it's a *view* on #1. Use it if humans ask for it.

### #3 — Granola Spaces (or equivalent) as the *capture funnel*

Voice and meeting capture is the largest source of un-captured-zettel today. Granola's Spaces (team workspaces, Series-C feature) and its API turn meetings into structured markdown that can be auto-piped into our git brain. Bot-free, runs locally, doesn't require the other side to install anything. Wispr Flow / Superwhisper / VoiceInk cover the same gap for *typed* capture (you speak, it dictates into whatever editor is open).

This isn't the brain — it's the **mouth**. Pair with #1.

### #4 — Tana (only as a comparable to study, not a candidate)

Tana's Supertags model — write freely, attach a schema *afterward* and the node becomes a database row while staying readable as prose — is the most interesting structural idea in the PKM space right now. We should *steal* the pattern (one zettel = one node, optionally tagged with a Supertag-like role: `#decision`, `#frustration`, `#id`, `#good`, `#bad`) but not the tool: it's cloud-only, proprietary format, no git, weak file-over-app posture. It also doesn't let Effi own her own brain.

### #5 — Basic Memory (MCP) as a possible plug-in retrieval layer

`basic-memory` (basicmachines-co) is exactly what #1 needs as a backend: it builds a semantic graph from plain markdown files, exposes it via MCP, and is designed for Claude/Obsidian. Local-first, SQLite under the hood, FastEmbed for vector search, hybrid full-text + semantic. We could adopt it wholesale for retrieval without changing how zettels are written.

**Disqualified from the shortlist** — Roam, Reflect, Mem.ai, Notion, Anytype, Logseq, Heptabase, Capacities, SiYuan, Trilium, AppFlowy, Khoj, Reor, NotebookLM. Reasons in §3.

---

## 2. The Karpathy pattern, dissected

### The original gist (verbatim digest)

Karpathy published `gist.github.com/karpathy/442a6bf555914893e9891c11519de94f` on April 4, 2026. It hit 5,000 stars in four days. The full pattern:

**Three layers.**

1. **Raw sources.** Curated documents you drop in. Immutable. Source of truth. You own this.
2. **The wiki.** LLM-generated, interlinked markdown. Summaries, entity pages, concept pages, comparisons. *"The LLM owns this layer entirely."*
3. **The schema.** A `CLAUDE.md` (or equivalent) that tells the LLM how the wiki is structured and what workflow to follow. This is the *constitution* of the brain.

**Three operations.**

- **Ingest.** Drop a source. The LLM reads it, discusses takeaways with you, writes a summary page, updates the index, refreshes any entity/concept page the source touches, appends to a log. *"One source might touch 10–15 wiki pages."*
- **Query.** Ask a question against the wiki, not against raw sources. The LLM scans the index, drills into pages, answers with citations to wiki pages. **This is the key insight: shift from retrieval to compilation.** You're not asking "find the doc"; you're asking the already-compiled wiki.
- **Lint.** Health-check pass. Find orphan pages, broken links, stale claims, contradictions, missing cross-references. Run periodically.

**Two navigation files.**

- **`index.md`** — content-oriented catalog of every page, with summaries, by category. LLM updates on every ingest.
- **`log.md`** — append-only chronological record of every ingest/query/lint. Consistent prefixes for parsing.

**Karpathy's metaphor:** *"Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."* You curate sources, ask questions, and think. The LLM does everything else.

### What this maps to in our principles

| Karpathy | Our principle | Fit |
|---|---|---|
| Compilation, not retrieval | Pull-a-wire-see-the-rope (parent goal) | three stars — same idea |
| `log.md` append-only | "Preserve trajectory, never delete" (P2) | three stars — same idea |
| LLM owns wiki maintenance | "Pull Claude into our world" (P3) | two stars — close, but Karpathy still has the human curating sources actively; we want it more emergent |
| Three operations (ingest/query/lint) | Low-friction capture (P1) | two stars — three commands is fine, but our zettel-emission needs to fire automatically during work too, not only on explicit `/ingest` |
| `CLAUDE.md` schema | — | three stars — clean primitive |

### What it looks like for a *team* (the gap Karpathy doesn't address)

The pattern is built for a solo knowledge worker. For our team it needs three extensions, none of which are show-stoppers:

1. **Concurrent writers.** Multiple humans + multiple Claude sessions ingesting at once. Solution: git. Each ingest = a commit. Conflicts = merge conflicts, resolved like code. The discipline of "commit early, commit often" already in our `CLAUDE.md` extends naturally. The 2026 community implementations (`claude-obsidian`, `obsidian-skills`, `llm-wiki`) all push toward git as the sync substrate.
2. **Multi-source provenance.** A team brain ingests from email, Slack, Linear, Sentry, code review comments — not just curated PDFs. The "raw sources" layer becomes a *firehose*. Solution: each capture pipeline (Granola, Linear, session retro, etc.) writes to `inbox/`; `/process-inbox` runs ambient and triages. This is the **Effi Historian** sub-issue (ENG-5387) territory.
3. **Cluster-aware retrieval.** With one user, `index.md` + LLM scan is fine. With ten people and 5K zettels, the LLM needs help finding the relevant cluster. Solution: graph layer (ENG-5381) and/or `basic-memory` MCP-style semantic graph. This is where #5 in the shortlist enters.

### What we'd add on top of Karpathy for our brain

Things Karpathy's pattern doesn't have that our principles demand:

- **Frustration / fighting-vs-asking detection** (P4). A zettel type that tags emotional state. A `/lint` rule that surfaces "this area has 7 frustration zettels in the last week" as a cluster.
- **Decision trajectory.** Not just `log.md`, but per-decision pages that record *what we considered and rejected*, not only what we chose. Reverted PRs, abandoned spikes, "we tried X and it sucked because Y" — first-class zettel types.
- **Effi self-write.** Effi must be able to call `/save`, `/wiki`, `/lint` through the same interface. With markdown-on-disk + skills, she gets it for free.

### Reference implementations to crib from

Already-built versions of the Karpathy pattern, ranked by usefulness as a starting code base:

- **`AgriciDaniel/claude-obsidian`** — 11 skills, `/wiki` `/save` `/autoresearch`, hot-cache pattern preserves ~500 words of session context across conversations. Most production-ready.
- **`qhuang20/obsidian-skills`** — Obsidian-focused Claude Code plugin; `llm-wiki` is the first skill.
- **`ekadetov/llm-wiki`** — clean Claude Code plugin format.
- **`NicholasSpisak/second-brain`** — minimal LLM-Wiki-pattern repo, good for understanding the bare bones.
- **`rohitg00/2067ab416f7bbe447c1977edaaa681e2`** — "LLM Wiki v2" gist, extends with lessons from production deployment of an `agentmemory` system.
- **`redmizt/968165ae7f1a408b0e60af02d68b90b6`** — "Beyond the Wiki," 18 architectural extensions for multi-agent production: identity, security, concurrency, knowledge graphs. Closest to the *team* version of the pattern.

---

## 3. Full landscape — capsule per tool

Format: **What it does** / **Interesting for us** / **Disqualifies it.**

### Editor / vault tools (the "IDE" layer)

**Obsidian** — Local-first markdown editor with a graph view, plugins, and (paid) Sync. *Interesting:* file-over-app philosophy *originates here* (Steph Ango); it's the substrate Karpathy and almost every 2026 LLM-wiki implementation targets; rich MCP ecosystem (`obsidian-claude-code-mcp`, `mcp-obsidian`, Agent Client, claudian, peerdraft). *Disqualifies:* nothing in particular — but it's a UI, not the brain. The brain is the directory of `.md` files. We don't *need* Obsidian if we have an editor and a CLI.

**Logseq** — Open-source, local-first, outliner-based block reference / bidirectional links. *Interesting:* outliner + block-ID model is closer to "atomic zettel" than Obsidian's page model; daily-notes-first capture loop fits Principle 1. *Disqualifies:* AI integration is weak relative to Obsidian; community momentum has shifted to Obsidian + Tana; project has had a turbulent 2024–2026 with the rewrite.

**Roam Research** — The original bidirectional-link outliner that started the modern PKM era. *Interesting:* daily-notes pattern, block references. *Disqualifies:* cloud-only, proprietary format, expensive ($15/mo), no AI-native story, momentum stalled. Shortlist of "Roam alternatives" articles in 2026 is 90% of search results — bad sign.

**Reflect** — Hosted Roam-like, AI-integrated (GPT-4/Claude/Gemini, large context window over your library, voice transcription). *Interesting:* end-to-end encrypted by default; large-context query is the closest commercial implementation of "ask the wiki." *Disqualifies:* proprietary format, hosted, no team mode, no git, no agent write-access. Pure consumer product.

**Mem.ai** — AI-native, no manual filing, smart-tags everything semantically. *Interesting:* the *vision* is right — capture without ceremony, retrieval without folders. *Disqualifies:* total black box. You can't see why it tagged what it tagged. Violates Principle 2 (preserve trajectory) and Principle 3 (you can't pull Claude into a brain you can't read).

**Notion** — Block editor + database, the team-collab default. *Interesting:* team multiplayer is genuinely solved here. *Disqualifies:* proprietary, not file-over-app, AI features are bolted on, agent write-access requires their API not Claude Code, RLS-style permissions are clumsy for "everyone reads everything" which is what we want.

**Anytype** — Local-first, Notion-like UI, P2P sync, end-to-end encrypted, knowledge graph view. *Interesting:* genuinely local-first, object-and-relation model is the cleanest "Notion + Obsidian without selling your data." *Disqualifies:* no real-time co-editing, AI integration thin, custom binary format under the hood (not plain markdown), agent integration story missing.

**Tana** — Outliner + Supertags + Live Queries + AI agents in meetings. *Interesting:* **Supertags are the most novel idea in PKM in years** (write free prose, attach schema later, node is now a queryable DB row); 2026 added agentic AI in meetings producing PRs/specs/storyboards from graph context. *Disqualifies:* cloud-only, proprietary, $9/mo per seat, no markdown export that round-trips cleanly, no path for Effi-as-writer.

**Heptabase** — Whiteboard-of-cards, infinite spatial canvas. *Interesting:* visual / spatial thinking layer; team plan ($25/user/mo) supports shared whiteboards with granular roles. *Disqualifies:* proprietary; Product Hunt reviews flag it as laggy past ~100 cards per board; not designed as a Claude-writable surface.

**Capacities** — Object-based PKM with type system. *Interesting:* clean object model; community loves it. *Disqualifies:* explicitly individual-only by design ("no collaboration is planned"). Hard pass for a team brain.

**SiYuan** — Self-hostable, block editor, WYSIWYG, block refs, graph view, flashcards, AI. *Interesting:* most powerful self-hosted block editor; great for solo or small team. *Disqualifies:* SQLite-backed proprietary block format (not plain `.md` round-trip), Chinese-language-first community, not targeted at agent integration.

**Trilium** — Hierarchical notes, cloning, self-hostable. *Interesting:* tree+clone model. *Disqualifies:* not markdown-native, weak agent story, project has been in maintenance mode.

**AppFlowy** — Open-source Notion clone with AI. *Interesting:* full workspace replacement. *Disqualifies:* not file-over-app, not agent-native, still maturing.

**Dendron** — Open-source, markdown, VS Code-native, hierarchical schema. *Interesting:* developer-targeted, lives in your repo, schema-validated note structures. *Disqualifies:* project effectively unmaintained since 2024; community moved to Obsidian.

### Agent-native / LLM-native tools

**Khoj** — Self-hostable AI second brain over docs+web, custom agents, automations. *Interesting:* AGPL self-host story; works with local LLMs via Ollama; one of the few mature agent-native PKMs. *Disqualifies:* the agent is the *only* interface; humans don't get a great editing experience; "AI-first" means the data layer is opaque to ordinary file tooling. Reviews report it being janky in practice (DarkEdge teardown).

**Reor** — Local AI note app, RAG-backed, semantic search, runs Ollama locally. *Interesting:* clean local-first agent integration. *Disqualifies:* solo, not multiplayer, no Claude Code skills story.

**NotebookLM** — Google's source-grounded RAG over a notebook. *Interesting:* "Spaces"-style sharing in Enterprise tier. *Disqualifies:* not a brain you write *to*, it's a reader over fixed sources; sharing model is per-notebook and broken across consumer/Enterprise tiers; cannot be the long-term substrate.

**Saner.ai** — AI-first PKM. *Interesting:* often listed as Tana competitor. *Disqualifies:* very early; little public traction; same proprietary pattern as Tana.

**Second Brain (thesecondbrain.io)** — Visual canvas + chat nodes + auto-organize. *Interesting:* the Tiago-Forte-branded "AI Second Brain" pitch is hosted; multi-modal (videos, social, docs). *Disqualifies:* hosted, proprietary, consumer-grade, not for a dev team.

**Dust** — Team agent platform with shared knowledge sources and custom agents. *Interesting:* explicitly team-shaped, not solo PKM; agents-as-shared-org-citizens. *Disqualifies:* the brain *is* the platform; no plain-markdown substrate; vendor lock; agents are Dust-defined, not Claude Code skills.

**Ponder** — NotebookLM alternative with "Ponder Agent" as a proactive thinking partner over an infinite canvas. *Interesting:* agent + visual layout. *Disqualifies:* hosted, proprietary, prosumer.

### Agent memory frameworks (the "what's under the hood" layer)

These are not user-facing PKMs — they're libraries you'd embed *into* a brain. Worth knowing because we may build with them.

**Mem0** — 3-tier memory (user/session/agent), hybrid vector + graph + KV, Apache 2.0, ~48K stars, self-hostable. *Interesting:* the most mature open-source agent memory, mature graph add-on. Could plug in as the retrieval layer beneath our markdown.

**Zep / Graphiti** — Temporal knowledge graph with validity windows ("when was this true, when did we record it"). *Interesting:* directly maps to Principle 2 (trajectory) — every fact carries its history. Scores 15 points higher than Mem0 on LongMemEval. **Strong candidate for the "associative memory" backend.**

**Letta (née MemGPT)** — Self-editing agent memory; the agent decides what to keep in vs. out of context. *Interesting:* OS-style memory paging is a clean conceptual frame. *Disqualifies:* designed for agent autonomy more than for shared human-readable artifacts.

**Supermemory** — Open-source personal KB across sources. *Interesting:* lightweight. Less differentiated than Mem0/Zep.

**LangMem** — LangChain's built-in memory. *Disqualifies:* LangChain coupling, not a fit.

**Basic Memory** — Local-first, semantic graph from plain markdown, MCP-exposed, integrates with Obsidian. *Interesting:* **closest backend match to our needs.** It assumes the substrate we want (markdown on disk), exposes it through MCP so Claude reads/writes it, gives us hybrid full-text+vector search for free. Already #5 on the shortlist.

### Capture / voice (the "mouth" layer)

**Wispr Flow** — Cross-platform voice-to-text overlay; system-wide; cloud-processed. *Interesting:* the de-facto "speak into any text field" tool the user already mentioned. Enterprise/team tier exists. *Watch:* cloud processing is a privacy tradeoff for sensitive zettels.

**Superwhisper** — Mac-native, on-device Whisper. *Interesting:* same UX as Wispr but local. Best-in-class for privacy.

**VoiceInk** — Open-source, on-device, free, integrates with Obsidian/Cursor/etc. *Interesting:* cheapest path to voice capture; aligns with Principle 1.

**Voibe** — 100% offline, privacy-first dictation. *Interesting:* clean offline option.

**Weesper Neon Flow** — €5/mo, on-device, Mac+Windows, 50+ languages. *Interesting:* cheapest paid offline option.

**Otter.ai** — Meeting transcription with speaker IDs. *Disqualifies for us:* Granola does this better and pipes to markdown more cleanly.

**Granola** — Bot-free meeting transcription, Mac/Windows, **Spaces** = team workspaces with granular access (added at Series C in 2026), enterprise + personal API. *Interesting:* **the team-capture pipeline candidate.** Slack integration auto-posts summaries; folder-level AI chat with citations; private API to wire meetings into our brain. Pair with #1 in the shortlist.

**Fathom** — Meeting AI with the most generous free tier. *Disqualifies for us:* per-recorder OAuth scope (we already learned this — see memory `project_fathom_per_recorder_scoping.md`); team coverage gaps make it wrong as a team-brain capture pipeline.

**Voicenotes** — Voice-first note app with transcript+search. *Interesting:* if we wanted a dedicated voice-zettel pipeline distinct from meetings.

### Team-collab layers on top of Obsidian/markdown

**Relay** — Real-time collab in Obsidian with CRDT-based co-editing, live cursors. *Interesting:* if we want Google-Docs-style multiplayer over our vault.
**Peerdraft** — End-to-end encrypted ad-hoc and long-term sharing for Obsidian, supports async/offline. *Interesting:* lighter alternative to Relay.
**Obsidian Sync (Teams tier)** — Official, no live cursors, last-writer-wins per file. *Disqualifies:* git already gives us better semantics for free.
**Obsidian Git plugin** — Auto-commit/push/pull on a schedule. *Interesting:* required if humans use Obsidian on top of #1 and we want the commits to flow without manual `git push`.
**`mcp-obsidian` (Pfundstein)** — MCP server over Obsidian REST API.
**`obsidian-claude-code-mcp` (Sinnott)** — auto-discovers vaults via WebSocket on port 22360, supports SSE for Claude Desktop and WebSocket for Claude Code, multi-vault.
**claudian (YishenTu)** — Embeds Claude Code as a collaborator panel inside Obsidian.

### Patterns / philosophies we're stealing

- **File over app** (Steph Ango) — non-negotiable.
- **Karpathy LLM Wiki** — the architectural template.
- **Tana Supertags** — the zettel-typing model.
- **Zep temporal graph** (validity windows) — the trajectory model.
- **Granola Spaces** (folder-scoped team chat with citations) — the team-discovery pattern.
- **Anthropic's own Claude Projects** as a benchmark — engineering teams already put architecture decisions / deployment procedures into Projects and ask in natural language. Our brain should be that, but **writeable by everyone**, **versioned**, and **agent-maintained**.

---

## 4. Synthesis — what we should actually build

Drawing #1–#5 of the shortlist together:

**Substrate.** `gin/zettel/` directory of plain markdown, in this repo, in git. Schema in `gin/zettel/CLAUDE.md` (Karpathy-style constitution, but ours).

**Skills.** Claude Code skills for the operations:
- `/zettel-capture <text>` — emit a zettel. Auto-classifies type (`#decision`, `#frustration`, `#id`, `#good`, `#bad`, `#lesson`, `#idea`).
- `/zettel-ingest <path|url>` — Karpathy `/ingest`.
- `/zettel-query <question>` — Karpathy `/query`.
- `/zettel-lint` — Karpathy `/lint` extended with frustration-cluster and trajectory-coherence checks.
- `/zettel-thread <wire>` — pull a wire, return the rope (associative).

**Capture pipelines.**
- Granola Spaces → markdown into `gin/zettel/inbox/meetings/`.
- Linear comments → `inbox/linear/`.
- Sentry incidents → `inbox/sentry/`.
- Voice via Superwhisper or VoiceInk into whatever editor is open.
- A hook on Claude session end that runs `/zettel-capture` against session-retro signals (frustration phrases, "let's record this decision", etc.).
- `/process-inbox` triages on a cron.

**Retrieval layer.** Start with Karpathy's `index.md` + LLM-scan. Graduate to **Basic Memory** (or our own thin wrapper over the same idea) once we cross ~200 zettels — semantic graph + hybrid search exposed via MCP so any Claude session anywhere can call it.

**Trajectory layer.** Borrow Zep/Graphiti's validity-window model — every zettel has `created_at`, `superseded_by`, `superseded_at`. Never delete; the `superseded_by` field threads the trajectory.

**Human IDE (optional).** Anyone who wants Obsidian over the same `gin/zettel/` directory installs Obsidian + Obsidian Git + `obsidian-claude-code-mcp`. The substrate doesn't care.

**Effi self-management.** The day we want it: point Effi at `gin/zettel/`, give her the same skills. She uses the same MCP retrieval layer. Same brain.

**What we *don't* build.** We don't pick Tana / Mem / Reflect / Notion / Heptabase / Anytype as the substrate. Their formats can't be the long-term home of our brain. We can borrow ideas (Supertags especially) into the markdown layout.

---

## 5. Open threads to hand to siblings

- **Deep Graph Professor (ENG-5381)** — what graph DB / knowledge graph engine should sit under the markdown? Mem0 vs Zep vs Graphiti vs roll-our-own SQLite-graph-via-Basic-Memory.
- **Zettelkasten Professor (ENG-5380)** — formalize zettel atomicity rules. Tana Supertags is the model to discuss.
- **Anthropologist (ENG-5383)** — capture culture. The pattern's success depends on the *habit*, not the tool. Fathom-style "everyone wears the recorder" vs Granola-style "your laptop captures your meetings."
- **Effi Historian (ENG-5387)** — the AskEffi "(really)" Effi project is itself a precedent of "team brain Effi already manages." Compare patterns.
- **Researcher-discussed (ENG-5385) / Researcher-missing (ENG-5386)** — go find the past sessions where we already designed/needed this.

---

## 6. Sources (links + capture date 2026-04-27)

### Karpathy LLM Wiki — primary
- [Karpathy's gist (llm-wiki.md)](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [Karpathy's gists index](https://gist.github.com/karpathy)
- [Andrej Karpathy's LLM Wiki: Create your own knowledge base — Urvil Joshi, Medium, Apr 2026](https://medium.com/@urvvil08/andrej-karpathys-llm-wiki-create-your-own-knowledge-base-8779014accd5)
- [Karpathy Killed RAG. Or Did He? — Towards AI, Apr 2026](https://pub.towardsai.net/andrej-karpathy-killed-rag-or-did-he-the-llm-wiki-pattern-7824d876e790)
- [Karpathy's Instructions for Building an AI-Driven Second Brain — Techstrong.ai](https://techstrong.ai/features/karpathys-instructions-for-building-an-ai-driven-second-brain/)
- [LLM Wiki by Andrej Karpathy: Build a Compounding Knowledge Base — Data Science Dojo](https://datasciencedojo.com/blog/llm-wiki-tutorial/)
- [Karpathy's LLM Wiki: The Complete Guide to His Idea File — antigravity.codes](https://antigravity.codes/blog/karpathy-llm-wiki-idea-file)
- [LLM Wiki v2 extension gist — rohitg00](https://gist.github.com/rohitg00/2067ab416f7bbe447c1977edaaa681e2)
- [Beyond the Wiki: Scaling Karpathy's LLM Wiki Pattern for Multi-Agent Production — redmizt](https://gist.github.com/redmizt/968165ae7f1a408b0e60af02d68b90b6)
- [Karpathy's Wiki Pattern Gets Its First Real Implementation — Ihor Chyshkala](https://chyshkala.com/blog/andrej-karpathy-s-wiki-pattern-gets-its-first-real-implementation)
- [How I Built a Self-Maintaining Knowledge Base for 6 Projects Using Claude Code & Karpathy's LLM Wiki — HackerNoon](https://hackernoon.com/how-i-built-a-self-maintaining-knowledge-base-for-6-projects-using-claude-code-and-karpathys-llm-wiki)

### Karpathy-pattern reference implementations
- [AgriciDaniel/claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian)
- [NicholasSpisak/second-brain](https://github.com/NicholasSpisak/second-brain)
- [qhuang20/obsidian-skills](https://github.com/qhuang20/obsidian-skills)
- [ekadetov/llm-wiki](https://github.com/ekadetov/llm-wiki)
- [rvk7895/llm-knowledge-bases](https://github.com/rvk7895/llm-knowledge-bases)
- [Ar9av/obsidian-wiki](https://github.com/Ar9av/obsidian-wiki)
- [Building an LLM Wiki with Claude Code and Obsidian — manav ghosh, Medium, Apr 2026](https://medium.com/@manavghosh/building-an-llm-wiki-with-claude-code-and-obsidian-eb6c0990e723)
- [Claude Obsidian: Self-Organizing AI Knowledge Engine — PyShine](https://pyshine.com/2026/04/claude-obsidian-self-organizing-ai-knowledge-engine/)
- [Persistent Second Brain with Claude-Obsidian in 2026 — TechnoSports](https://technosports.co.in/persistent-second-brain-with-claude-obsidian/)

### Obsidian + agent integration
- [iansinnott/obsidian-claude-code-mcp](https://github.com/iansinnott/obsidian-claude-code-mcp)
- [MarkusPfundstein/mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian)
- [YishenTu/claudian](https://github.com/YishenTu/claudian)
- [Agent Client plugin announcement — Obsidian Forum](https://forum.obsidian.md/t/new-plugin-agent-client-bring-claude-code-codex-gemini-cli-inside-obsidian/108448)
- [Obsidian + Claude Code: Complete Integration Guide — Starmorph](https://blog.starmorph.com/blog/obsidian-claude-code-integration-guide)
- [3 Ways to Use Obsidian with Claude Code — Awesome Claude](https://awesomeclaude.ai/how-to/use-obsidian-with-claude)

### Team / multiplayer Obsidian
- [Relay (relay.md)](https://relay.md/)
- [peerdraft/obsidian-plugin](https://github.com/peerdraft/obsidian-plugin)
- [Obsidian Sync — Collaborate on a shared vault](https://help.obsidian.md/Collaborate+on+a+shared+vault)
- [Obsidian Sync for Teams](https://help.obsidian.md/teams/sync)
- [Sync Obsidian Vault with Git for AI Collaboration — BSWEN, Mar 2026](https://docs.bswen.com/blog/2026-03-23-sync-obsidian-vault-git-ai-collaboration/)

### Tana
- [Tana for PKM](https://outliner.tana.inc/pkm)
- [Mastering Tana Supertags — AI:PRODUCTIVITY](https://aiproductivity.ai/guides/tana-supertags-guide/)
- [Why Tana's Popularity is Exploding Among PKM Users — Theo James, Medium](https://medium.com/@theo-james/why-tanas-popularity-is-exploding-among-pkm-users-8a684c7d6fc0)
- [Tana Review 2026 — VisionStack AI](https://www.visionsparksolutions.com/reviews/tana/)
- [Tana Reviews 2026 — Saner blog](https://blog.saner.ai/tana-reviews/)

### Logseq / Roam / Reflect / Mem
- [Logseq vs Reflect vs Roam comparison — Slashdot](https://slashdot.org/software/comparison/Logseq-vs-Reflect-vs-Roam/)
- [Note-taking app comparison — Reflect blog](https://reflect.app/blog/note-taking-app-comparison)
- [7 Best Roam Research Alternatives in 2026 — Alfred](https://get-alfred.ai/blog/best-roam-research-alternatives)
- [Mem.ai Review & Guide — Productivity Stack](https://productivitystack.io/guides/mem-ai-guide/)
- [Best AI Note-Taking Apps in 2026 — Revoyant](https://www.revoyant.com/blog/best-ai-note-taking-apps-in-2026)
- [7 Best Logseq Alternatives in 2026 — Alfred](https://get-alfred.ai/blog/best-logseq-alternatives)

### Anytype / Notion
- [Anytype Review 2026 — Tooliverse](https://tooliverse.ai/tools/anytype)
- [Anytype Review 2026 — AI:PRODUCTIVITY](https://aiproductivity.ai/tools/anytype/)
- [Notion vs Anytype Privacy Showdown — ToolPilgrim](https://toolpilgrim.com/notion-vs-anytype/)
- [Anytype on Product Hunt](https://www.producthunt.com/products/anytype)

### Heptabase / Capacities / SiYuan / Trilium / AppFlowy / Dendron / Reor / Khoj
- [Heptabase](https://heptabase.com/)
- [Heptabase Reviews on Product Hunt](https://www.producthunt.com/products/heptabase/reviews)
- [Capacities Sharing docs](https://docs.capacities.io/tutorials/sharing)
- [Capacities is for individuals — Capacities blog](https://capacities.io/blog/capacities-is-for-individuals/)
- [Heptabase Collaboration Q&A](https://support.heptabase.com/en/articles/10510497-collaboration-q-a)
- [SiYuan Alternatives — Theo James, Medium](https://medium.com/@theo-james/siyuan-alternatives-personal-knowledge-management-tools-in-2025-f85be7351f45)
- [Best Self-Hosted Note Taking Apps 2026 — selfhosting.sh](https://selfhosting.sh/best/note-taking/)
- [dendronhq/dendron](https://github.com/dendronhq/dendron)
- [khoj-ai/khoj](https://github.com/khoj-ai/khoj)
- [Khoj private local AI: disappointing — Dark Edge](https://darkedge.world/posts/khoj_local_ai_for_pkm/)
- [Building a PKM Tool with Reor — KDnuggets](https://www.kdnuggets.com/building-a-personal-knowledge-management-tool-with-reor)

### Agent-memory frameworks
- [Best AI Agent Memory Frameworks 2026 — Atlan](https://atlan.com/know/best-ai-agent-memory-frameworks-2026/)
- [State of AI Agent Memory 2026 — Mem0 blog](https://mem0.ai/blog/state-of-ai-agent-memory-2026)
- [Graph-Based Memory Solutions for AI Context — Mem0 blog, Jan 2026](https://mem0.ai/blog/graph-memory-solutions-ai-agents)
- [Zep](https://www.getzep.com/)
- [AI agent memory systems in 2026 — Hermes OS](https://hermesos.cloud/blog/ai-agent-memory-systems)
- [5 AI Agent Memory Systems Compared — DEV.to, 2026](https://dev.to/varun_pratapbhardwaj_b13/5-ai-agent-memory-systems-compared-mem0-zep-letta-supermemory-superlocalmemory-2026-benchmark-59p3)
- [Top 6 AI Agent Memory Frameworks for Devs 2026 — DEV.to](https://dev.to/nebulagg/top-6-ai-agent-memory-frameworks-for-devs-2026-1fef)
- [basicmachines-co/basic-memory](https://github.com/basicmachines-co/basic-memory)
- [zilliztech/memsearch](https://github.com/zilliztech/memsearch)

### Voice / capture
- [9 Best Wispr Flow Alternatives in 2026 — Voibe blog](https://www.getvoibe.com/blog/wispr-flow-alternatives/)
- [Wispr Flow vs VoiceInk, Jan 2026](https://wisprflow.ai/post/wispr-flow-vs-voiceink-2025)
- [9 Offline Wispr Flow Alternatives — Weesper Neon Flow blog](https://weesperneonflow.ai/en/blog/2026-03-19-wispr-flow-alternatives-offline-dictation-2026/)
- [7 Best Open Source Wispr Flow Alternatives 2026 — OpenAlternative](https://openalternative.co/alternatives/wisprflow)
- [Granola](https://www.granola.ai/)
- [Granola Review 2026 — tldv](https://tldv.io/blog/granola-review/)
- [Granola vs Otter vs Fathom 2026 — itsConvo](https://www.itsconvo.com/blog/granola-vs-otter-vs-fathom)
- [Best AI Meeting Notes 2026 — Zack Proser](https://zackproser.com/blog/best-ai-meeting-notes-2026)

### NotebookLM and team-AI alternatives
- [NotebookLM Enterprise — Share notebooks](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/share-notebooks)
- [Top NotebookLM alternatives 2026 — Dust blog](https://dust.tt/blog/notebooklm-alternatives-research-documents)
- [16 Best NotebookLM Alternatives — Ponder](https://ponder.ing/blog/notebooklm-alternatives)

### Philosophy / file-over-app
- [File Over App — Steph Ango](https://stephango.com/file-over-app)
- [File Over App: A Philosophy for Digital Longevity — rishikeshs.com](https://rishikeshs.com/file-over-app/)
- [Obsidian vs Notion vs Markdown Files — dasroot.net, Mar 2026](https://dasroot.net/posts/2026/03/obsidian-vs-notion-vs-markdown-files-2026-pkm-comparison/)

### General landscape
- [Best PKM Apps in 2026 — Toolfinder](https://toolfinder.com/best/pkm-apps)
- [Top 13 Personal Knowledge Management Software for 2026 — ClickUp](https://clickup.com/blog/personal-knowledge-management-software/)
- [Knowledge Management in 2026 — Rost Glukhov](https://www.glukhov.org/knowledge-management/)
- [Best 15 Second Brain Apps in 2026 — Buildin](https://buildin.ai/blog/best-second-brain-apps-2026)
- [AI Native Second Brain Ultimate Guide 2026 — Remio](https://www.remio.ai/post/ai-native-second-brain-ultimate-guide)
- [The Best PKM Software 2026 Guide — GoLinks](https://www.golinks.com/blog/10-best-personal-knowledge-management-software-2026/)
- [The AI Second Brain — Building a Second Brain (Tiago Forte)](https://www.buildingasecondbrain.com/ai-second-brain)
- [agamarora.com second-brain — git-native template](https://agamarora.com/lab/second-brain/)

### Engineering team usage
- [How Claude Code is built — Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built)
- [Claude Projects: your new knowledge management system — Amit Kothari](https://amitkoth.com/claude-projects-knowledge-management/)
- [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)
