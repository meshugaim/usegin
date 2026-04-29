# Ideator 02 — Din (subtraction)

## Priming (one sentence)

Remove until there is nothing left to remove — the best rating UX is the one that costs zero keystrokes because the signal was already in the room.

## Ideas

- **Zero-keystroke infer**: don't ask. Compute `general` from signals already on disk (commits landed, tests passing, hook denials, /undo count, session length, error events). File silently as `as=human-inferred`. Why: the cheapest rating is the one Lihu never types.

- **Single keystroke, single digit**: `dx his` (no subcommand) prints `vibe? `, reads ONE char (1..9 mapped to 10..90, 0=skip), exits. Why: one byte of input, one second of attention, fits the ≤5s bar with margin.

- **Delete every aspect except `general`**: aspects are R&D vanity. Lihu's 5-second bar can't carry a multi-axis form. One number, file, done. Why: aspect granularity is the source of all friction; subtraction = collapse the schema.

- **Delete the rating, keep the note**: replace numeric scoring with a single optional sentence — "what's the vibe?" — and let downstream NLP score it. Why: humans rate by writing, not by picking numbers; the number was a translation tax.

- **Delete the slash command**: `/rate` is a step. Replace with auto-fire on `/end` with `general=inferred`; Lihu only types if he disagrees. Why: dissent is rare; assent is silent; only ask when needed.

- **Delete the prompt, use the statusline**: rating lives as a `[rate?]` chip in the statusline. Click-equivalent (or `dx his` shortcut) fires the inferred submission. Why: no chat real-estate consumed, no turn spent.

- **Delete the session boundary**: don't rate sessions. Rate days. One end-of-day rollup that infers from the day's commits + Sentry. Why: per-session is the wrong granularity for humans; daily fits energy cycles.

- **Delete the schema's centerpiece**: kill the 1..100 scale, replace with thumbs-up / thumbs-down / shrug (3 states). Why: 100-point precision is fake; 3-state is honest and one keystroke maps cleanly.

- **Delete confirmation**: never echo "filed!" — silence = success. Why: every confirmation line is a turn-tax.

- **Delete the question, keep the trigger**: on wrap-up phrase detected, fire `general=80, source=auto-wrapup-positive`. On `/end-frustrated` (new alias), fire `general=20`. Why: the WORD Lihu used IS the rating.

- **Delete the picker, use reactions**: Claude's last message gets a reaction-bar Lihu types as a single emoji (`+`, `-`, `=`). A hook parses the next user turn for those tokens. Why: no command, no surface change — just one printable char.

- **Inline-edit the auto-fill**: Claude posts `[auto-rated 70 — edit?]` in its final turn. Lihu either ignores (auto stands) or types a number to override. Why: default to action, not to question.

- **Delete the "rate" verb**: rename `/rate` → `/.` (literal dot). One keystroke, no semantic load. Why: the name itself is friction; remove the word.

- **Delete the human side entirely**: trust Claude's self-rating as proxy for the session's vibe. Compare-against-truth happens via occasional spot-checks (1 in 10 sessions Lihu rates). Why: 90% subtraction of human effort, 10% calibration retained.

- **Delete the "general" question, keep just "friction"**: Lihu's pain is the only signal that matters; pleasure is noise. One question: "what hurt?" — empty = nothing hurt = good session. Why: subtractive framing — absence of friction is the positive signal.

- **Collapse to one bind**: bind the entire flow to a single shell alias `r` that takes `1..9` as argv. `r 7` files. Why: muscle memory at the speed of typing.

- **Delete the Stop hook on Claude-side too**: if the rating is inferred, Claude doesn't need to be blocked. Drop the hook, drop the symmetry. Why: subtract the enforcement once the surface is frictionless.

- **Delete the SQLite store, append to a flat file**: `~/.claude/dx-his/his.jsonl` — one line per submission, no schema migration ever. Why: the storage layer was overengineered for the volume; subtract complexity.

- **Two faces, one click**: the artifact is one `[rate?]` chip; clicking it fires the human side, NOT clicking it for >2min fires the inferred side. Why: same surface, two faces, zero question.

- **Delete the timing**: don't tie rating to session end. Let Lihu fire `r 8` whenever the vibe shifts. Sessions become composite of pulses, not bookended by one verdict. Why: session-end is an arbitrary cut; the vibe is continuous.

- **Delete the chat turn**: rating lives entirely outside Claude's transcript — a tmux pane, a file watcher, a single keypress on a global hotkey. Why: the chat is sacred; don't pollute it with telemetry.

- **Inferred + dissent-only chat**: Claude posts in its last turn `[vibe inferred: 70]` and Lihu only types if wrong. No prompt, no question, no command. Why: surface the inference, accept silence as agreement.

## Chat summary

Filed 22 subtraction-shaped ideas to `02-din-subtraction.md`. Theme: every step in the current /rate flow is a candidate for deletion — ask less, infer more, collapse the schema, kill the verb, trust silence. Sharpest moves: zero-keystroke inference + dissent-only override, single-digit one-keypress, delete-aspects-keep-general, delete-the-question-and-read-the-wrap-up-word. The inference-plus-dissent shape recurred — it's the cleanest collapse of the existing surface.