---
name: zettel-capture
description: Autonomously capture a zettel mid-session whenever a thought, decision, friction, or lesson worth preserving lands. Zettels are the shared 2nd brain in `usegin/zettel/zettels/` — append-mostly, threaded, two-faced where suitable. Use proactively, not on request. Triggered by phrases like "zettel that", "capture this", "write a zettel", "decided X", "we're going with X", "lesson learned", or by your own judgment when one of the trigger signals below fires.
---

# Zettel capture — autonomous UseGin capture

## Triggers from the human — `!zettleit`

When the human types `!zettleit "<thought>"` (or `zettleit "..."` in their shell), the bash output you see contains a `[ZETTLEIT]` banner. That banner *is the instruction*: same turn, run the procedure below — `dx zettel list` (zettleread) → choose placement + threads → `dx zettel add --as=usegin` → `dx zettel show` to verify. v0 captures autonomously; v1 will gate on approval first. Don't ignore the banner; don't ask the human to also tell you "now write it" — the trigger already did.

## Autonomous capture

**You can — and should — run `dx zettel add --as=usegin` whenever a thought, decision, friction, or lesson worth preserving lands.** You don't need permission. The corpus accumulates; per principle 02 (preserve, don't delete) nothing you write overwrites anything else, and per z002 there is never "later" — every "later" must commit to an artifact NOW.

This is the shared 2nd brain (z028). Both human and UseGin write to it. Future Gins read it as signal — clusters of zettels in an area expose where we're fighting (z048). The point of capture is to amplify how we already think, not to install a new discipline (principle 01).

## When to autonomously capture (mid-session)

Don't wait for `/end` or for the human to ask. File a zettel whenever any of these fire:

| Signal | Why it's a zettel |
|---|---|
| The human says "decided" / "settled" / "go with X" / "let's do X" — or you converge on a recommendation the human accepts | **Decision zettel** — z020 four-line shape, written before the response ships |
| You catch yourself thinking "we'll come back to that" / "out of scope for now" | z002 — there is no later. Open-to-empty (z003) if the content isn't ready |
| The human or you hits friction with tooling, the corpus, the CLI, the harness — anything that should be smooth and isn't | Friction zettel (z029, z030, z038, z058–z073 cluster) — surfaces DX-of-DX signal (z048) |
| A lesson lands — "this teaches us…" — about how we work, how UseGin should behave, how the system shapes us | Methodological zettel (z015, z022, z036, z048) |
| The human dictates a principle, rule, or stance — even mid-sentence, even paraphrased | Capture verbatim-ish into a zettel. The trail of *how* it was said carries meaning (principle 02) |
| You notice a cluster forming — three friction events in the same area, a repeated frustration | A meta-zettel naming the cluster (z057). The cluster IS a finding |
| A meeting / thread / external note produces a durable claim about how we work | Lift it into a zettel rather than letting it die in the channel it landed in |
| You're about to do something irreversible and want a marker (e.g. abandoning a path) | Capture the abandonment with rationale — the reverted choice carries information (principle 02) |

## The shape

Zettels are atomic claims, not narratives (z001). One zettel = one claim. If you're writing two claims, that's two zettels with a thread between them.

### Title is the API of the zettel

The title is a **complete claim** that stands on its own. A future reader scanning `dx zettel list` should learn the point from the title alone (Matuschak: titles are like APIs).

- Good: `"Concurrent dx-zettel-add race observed in the wild — slice 1 known limitation #1 fired"`
- Good: `"Decisions have a shape — Claude should know it cold and emit it without being asked"`
- Bad: `"Race condition"` / `"Decision shape"` / `"Notes on concurrency"`

The title is also the slug of the on-disk filename, so it's load-bearing for `rg` discoverability.

### Body — two-faced when suitable (z022)

Default to two faces when the zettel will be consumed by both Lihu and a future UseGin with different needs:

```
## Human side

<what Lihu needs from this — context, the rule, why it matters to him>

## UseGin side

<what a future UseGin needs from this — operational consequence, how to apply it,
what evidence would falsify it>
```

One face is fine when only one party will consume it (a Sentry probe is pure-UseGin; a Lihu-only physical-language note is pure-human). Don't force two faces; the cost is real (z022). When the other side isn't ready yet, write `(open-to-empty)` under that header — the address is real, the content fills later (z003).

### Threads — `--placement` (one parent) and `--thread` (cross-refs, repeatable)

Every zettel belongs in the graph. At capture time, decide:

- **One `--placement` parent** — the single "this lives under" link. A principle (`principle-01`), a parent zettel (`z002`), a slice (`SLICE-1`), a Linear issue (`ENG-5392`). The CLI enforces ≤1 placement per zettel.
- **Zero or more `--thread` cross-references** — the related zettels, principles, issues, or external addresses this claim touches. Repeatable.

Stored on disk as `↑<id>` (placement) and `~<id>` (cross). The CLI normalizes short forms (`3` / `z3` / `z003` all become `~z003`) and validates that zettel-shaped targets exist (z059 fix). Use `--force` only for legitimate forward refs / open-to-empty (z003).

### Decision zettels — z020 four-line shape, immediately, in the right artifact

When the trigger is a decision, the body uses the fixed shape:

> **We decided X because Y. The price is Z. The risk was W. Alternatives rejected: …**

Four lines. No prose padding, no hedging menu, no "we could consider…". Then place the artifact correctly (z020):

- **Linear issue body** if the decision shapes the spec.
- **Linear comment** if it's a tactical call within an open issue.
- **Zettel** (this skill) if it's meta / cross-cutting / methodological.

Decisions land *before* the response ships. Don't wait for the human to say "now zettel that."

## Read first — `dx zettel list` + `rg`

Before adding, check what's already there:

```bash
dx zettel list                              # see ids, authors, titles
dx zettel list --by usegin                  # only UseGin-authored
rg "<term>" usegin/zettel/zettels/          # full-text (no `dx zettel search` yet — z065)
dx zettel show z022                         # read the one(s) that look related
```

Reasons to read first:
- The claim may already exist — link to it (`dx zettel link`) or add a face to it rather than a duplicate.
- You'll find the right `--placement` parent and `--thread` set, which is what makes the new zettel reachable.
- You'll catch the cluster — if four zettels already touch this area, the new one might be a meta-zettel about the cluster (z057), not another data point.

## How to capture

Body positional:

```bash
dx zettel add "<body markdown>" \
  --title "<complete claim — the API of the zettel>" \
  --as=usegin \
  --placement <parent-id> \
  --thread <related-id> --thread <related-id>
```

Body via stdin (works with Wispr Flow, slash commands, heredocs):

```bash
cat <<'EOF' | dx zettel add \
  --title "<complete claim>" \
  --as=usegin \
  --placement <parent-id> \
  --thread <id>
## Human side

<...>

## UseGin side

<...>
EOF
```

Author flag: a UseGin session passes `--as=usegin` explicitly (the CLI defaults to `human`; there's no auto-detection). Use `--as=consultant` when capturing on behalf of the consultant agent (z025).

After capture, `dx zettel show <new-id>` to verify the round-trip looks right (the slice-1 fixes — z058 round-trip blank line, z059 link target validation, z060 short-id normalization, z062 placement+thread dedupe — all landed; z074).

## What makes a good zettel

- **Atomic** — one claim. If you're saying two things, that's two zettels with a thread.
- **Complete-claim title** — readable in `dx zettel list` without opening the file.
- **Concrete** — name the trigger, the moment, the quote. "Lihu, paraphrased, this session: '…'" beats "we discussed values."
- **Threaded** — a zettel with no `--placement` and no `--thread` is a leaf no one will find. Place it.
- **Laconic** (z036) — distill to the semantic center; investigate without limit, output the click. A long investigation does not earn a long zettel.
- **Honest about open-to-empty** — if you only have one face, mark the other `(open-to-empty)`. Don't fake a Lihu voice.

## What NOT to capture

- **Implementation details** that belong in code or `git log` (principle 03 — pull Claude into our world, don't dive into Claude's). The zettelkasten is the meta layer: intent, rationale, lessons, frictions, decisions.
- **Restatements** of an existing zettel. Add a thread or a face to the existing one instead.
- **Every turn.** Capture when something *shifted* — a decision landed, friction surfaced, a lesson clicked. Not as a per-turn ceremony.
- **One-off observations with no claim shape.** If you can't write a complete-claim title, you're not ready to capture — keep working, the claim will form.
- **Anything you'd capture to flatter Lihu (or yourself).** The corpus is signal for future Gins, not a performance log.
- **Speculation framed as finding.** If you saw something once and didn't characterize it, record the raw observation as-is or don't capture — don't invent thresholds, categories, or recommendations.

## When in doubt

Reach for capture, not silence. A weak zettel with a real address can be distilled later (principle 02 — preserve forward, never delete). A thought you let pass is gone. Per z002: pick one of the four moves — do it, write to yourself, bind it, or open-to-empty. None of them is "later".
