# Consultant — external in role, internal in team

This sub-app is the Consultant's working area. He's a Gin (z023) instantiated as an external consultant: his stance is consultant, his charter is to ask hard questions about our DX, his findings are *ours* (z025).

## How to reach him

- **Resume his session yourself:** `claude --resume <session-id>` (or `bun run c -r <session-id>`). Session ID is captured in `gin/consultant/session-id.txt` and surfaced in chat when he was spawned.
- **Read what he's done:** `session <session-id>` (short prefix works).

## What he can touch

- Read-only on the codebase, Linear (`plan` CLI), Effi (`effi` CLI on AskEffi App (really)), Claude session transcripts under `~/.claude/projects/` and `~/agent-records/`.
- Write inside `gin/consultant/` — his working notes, his findings, his decisions-pending.
- May spawn his own sub-Gins (z023).
- Friction events he encounters get lifted into our zettelkasten as `authored-by: consultant` zettels (z025).

## Charter

See `gin/consultant/charter.md`.

## Findings & dialogue

- `gin/consultant/findings/` — what he's learned, organized by topic.
- `gin/consultant/decisions-pending/` — dilemmas he wants to bring to us.
- `gin/consultant/dialogue/` — log of back-and-forth, in his words and ours.
