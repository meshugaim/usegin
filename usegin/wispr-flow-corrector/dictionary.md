# Wispr Flow Corrector — Dictionary

Word-level corrections. When Wispr Flow mishears a word the same way repeatedly, it goes here. Gin uses this as the first reach when something looks weird in Wispr-dictated input.

This is a **corrector**, not a translator (`gin/zettel/zettels/z007`).

## Format

`heard → intended` — and if the correction is context-dependent, a one-line note. Newest at the top of each section so we can see what's been added recently.

## Domain words

| Heard | Intended | Notes |
|---|---|---|
| `settle`, `settles` | `zettel`, `zettels` | Always. |
| `settled` | `zettel'd` / `make a zettel of it` | Past-tense form of the same mishearing — common in "let's get this settled" / "write it settled" contexts. |
| `Cloud` | `Claude` *or* `Gin` | Context-dependent: agent identity in this repo = Gin; the underlying model / non-repo references = Claude. |
| `GynLab`, `GymLab`, `Gym-Lab` | `Gin` (the umbrella; "Gin-Lab" the separate name was retired in z021) | |
| `Gynn`, `Ginn`, `Eun`, `Gain`, `Gain's`, `Gim` | `Gin`, `Gin's` | "Gain" and "Gim" especially common. |
| `gains`, `wins` (when context is agents/sub-agents) | `gins` | Lihu uses "gins" for spawnable Gin instances. (z023) |
| `cell`, `cells` (when context is notes) | `zettel`, `zettels` | Heard once; watch for recurrence. |
| `Zetel`, `Zetels` | `Zettel`, `Zettels` | Domain-name spelling. |
| `Lina Arishiu` | `Linear` | The issue tracker. |
| `Trig him`, `Trig` (as verb) | `Trigger him`, `Trigger` | Wispr cuts "Trigger" mid-word. |
| `FECLI`, `FE CLI`, `Session CLI` (when context is Effi-querying) | `effi CLI` | The `effi` command. Distinct from the actual `session` CLI. |
| `record-base` | `codebase` | Lihu has self-corrected this in dictation. |
| `UX app` (when context is Gin / DX) | `DX app` / `Gin app` | Wispr drift between "UX" and "DX" mid-conversation. |
| `Settlecast`, `Zetelcast`, `Settle-cast` | `Zettelkasten` (the concept) | |

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
