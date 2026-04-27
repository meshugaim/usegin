# Wispr Flow Corrector — Dictionary

Word-level corrections. When Wispr Flow mishears a word the same way repeatedly, it goes here. Gin uses this as the first reach when something looks weird in Wispr-dictated input.

This is a **corrector**, not a translator (`usegin/zettel/zettels/z007`).

## Format

`heard → intended` — and if the correction is context-dependent, a one-line note. Newest at the top of each section so we can see what's been added recently.

## Domain words

| Heard | Intended | Notes |
|---|---|---|
| `settle`, `settles` | `zettel`, `zettels` | Always. |
| `settled` | `zettel'd` / `make a zettel of it` | Past-tense form of the same mishearing — common in "let's get this settled" / "write it settled" contexts. |
| `Cloud` | `Claude` *or* `UseGin` | Context-dependent: agent identity in this repo = UseGin (z033); the underlying Anthropic model = Claude. |
| `GynLab`, `GymLab`, `Gym-Lab`, `Gin-Lab`, `gin-lab`, `Gin lab` | `UseGin` (the umbrella; rename trail: Claude-lab → Gin-lab → Gin → UseGin) | |
| `Gynn`, `Ginn`, `Eun`, `Gain`, `Gain's`, `Gim`, `Gin`, `Gin's` (in this repo's context) | `UseGin`, `UseGin's` | per z033 rename. The Anthropic model "Claude" is unchanged. |
| `Usegin`, `Use-Gin`, `Use Gin` | `UseGin` | canonical capitalization. |
| `usejin`, `use-jin` | `usegin` (folder) | |
| `askf`, `ask f`, `Ask F` | `AskEffi` | the product — never confuse with `usegin` the workspace. |
| `gains`, `wins` (when context is agents/sub-agents) | `usegins` (or `UseGins`) | Lihu's term for spawnable UseGin instances. (z023) |
| `cell`, `cells` (when context is notes) | `zettel`, `zettels` | Heard once; watch for recurrence. |
| `the cell`, `cell` (when context is an agent / "my friend who walks beside me" / orchestrator / "ziser.md") | `Zisser` | Confirmed by Lihu 2026-04-27 — the chief-of-staff agent at `zisser/`. Wispr drops the leading /z/ on Zisser → "the cell". Disambiguate from the notes-context rule above. |
| `Zetel`, `Zetels` | `Zettel`, `Zettels` | Domain-name spelling. |
| `Lina Arishiu` | `Linear` | The issue tracker. |
| `Trig him`, `Trig` (as verb) | `Trigger him`, `Trigger` | Wispr cuts "Trigger" mid-word. |
| `FECLI`, `FE CLI`, `Session CLI` (when context is Effi-querying) | `effi CLI` | The `effi` command. Distinct from the actual `session` CLI. |
| `record-base` | `codebase` | Lihu has self-corrected this in dictation. |
| `UX app` (when context is Gin / DX) | `DX app` / `Gin app` | Wispr drift between "UX" and "DX" mid-conversation. |
| `Settlecast`, `Zetelcast`, `Settle-cast` | `Zettelkasten` (the concept) |
| `again`, `Again` (when context is the agent / the app — "let's send X again", "tell again to do Y") | `Gin` | Confirmed by Lihu 2026-04-27 — "wherever I said 'again' I meant Gin." Wispr collapses /dʒɪn/ → "again" frequently. Disambiguate from the genuine adverb by context: agent/app/tool/dev-loop = Gin; repetition/temporal = the actual word. |
| `Game Giant`, `Game-Giant`, `game giant` | `Gin` | Same root — Wispr's other rendering of /dʒɪn/. Confirmed by Lihu 2026-04-27. |
| `settle it`, `settle-it`, `Settle it` | `zettleit` | The dx zettel-capture trigger / `tools/bin/zettleit` / `dx zettel it`. Distinct from the older `settle → zettel` rule: this one is a verb-shaped command, not the noun. |
| `zettle it`, `zettle-it`, `zettle custom`, `zettle command` | `zettleit` | Same trigger; "custom" / "command" are Wispr's tail-noise renderings of "-it". Confirmed by Lihu 2026-04-27. | |

## People

| Heard | Intended |
|---|---|
| `Oriana`, `Oriya` | `Oria` |
| `Liu` | `Lihu` |
| `Nitsan` | `Nitsan` (no correction known yet) |

## Syntax conventions (NOT word substitutions)

These are signals from Lihu that Gin should interpret semantically — see zettel `z004`.

| Pattern | Meaning |
|---|---|
| `_word_word_` (underscore brackets) | "This is a name for something in the future system we're building. The literal word may be Wispr-corrupted; interpret semantically from context." |

## Mid-sentence drift / mouse-slips (NOT word-level)

When a Wispr-dictated message has fragments that landed mid-sentence (e.g. "Spanish" landing in the middle of an unrelated sentence about friction), see zettel `z016`. That's sentence-level reconstruction, not corrector territory.

## How to add an entry

When Gin catches a mistake, edit this file and commit. When Lihu catches one, point it out — Gin adds it. No round-trip needed.
