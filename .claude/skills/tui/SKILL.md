---
name: tui
description: Ask the human for a structured answer through an interactive tmux-popup TUI instead of a chat exchange — reorder a list, pick one, multi-select, confirm, free-text input. Use when the answer would otherwise be a long chat ping-pong (e.g. "rank these 8 items", "which of these 12 should I include", "is this list right?"), when the input is positional or visual (ordering, set-membership) rather than verbal, or when you want a clean structured handoff (`{ordered:[...]}`, `{value:"..."}`, `{indices:[...]}`). Triggered by "let me reorder", "let me pick from a list", "ask me which", "show me a picker", "popup picker", "/tui", or by your own judgment when chat would be slower than three keystrokes.
---

# tui — interactive TUI primitives

The `tui` CLI (`tools/bin/tui`) renders a small ink-based TUI inside a tmux popup, takes a JSON spec on stdin, and emits a JSON result on stdout. Use it instead of asking the human to type a list back in chat.

Subcommands: `reorder`, `choose`, `multi`, `confirm`, `input`, `preview`, `score`, `form`, `batch`. Run `tui <subcmd>` with no stdin or read `tools/bin/tui` for the spec shapes — they're tiny.

## When to reach for it

- **Reorder**: "rank these by priority", "what's the slice order", "fix this list". Chat round-trips for ordering are painful; popup is three keystrokes.
- **Choose / multi**: 5+ candidates and the human's answer is a pick, not an explanation. Below ~5, chat is fine.
- **Confirm**: only when the question is genuinely binary AND you want to gate a non-trivial action. For "ok?" mid-conversation, chat is faster.
- **Input**: a single short string with a default — branch name, file path, label. For anything multi-line or exploratory, chat.
- **Preview**: show a charter/spec/diff/markdown blob with an action footer (approve/edit/reject/…). The right tool when you want a gate after the human reads something — beats "here's the doc, ok?" in chat.
- **Score**: rate a list of items on a scale (1–5 stars or 1–100 bar). Direct fit for `prioritize`, retros, vibe ratings — replaces a chat list of "X: 4, Y: 3, …".
- **Form**: 3+ fields collected at once, tab between fields, single submit. Field types: `text`, `confirm`, `choose` (single-line, edited inline), plus `multi`, `reorder`, `score` (multi-row, focus-mode — press enter to drop into the field, enter/esc/tab to leave back to form-nav). Use when you'd otherwise ask three or more questions in a row (`spec` metadata, issue creation, slicing-with-priorities in one screen).
- **Batch**: 1–4 *sequential* questions in one popup invocation (one-screen-per-question, next question appears after answer). Different from `form` — use when later questions depend on earlier answers, or when each question wants its own full-screen real estate (rich items, scrollable details). Closest match to AskUserQuestion's batched-questions shape.

## "Other" escape (choose / multi)

Pass `{"allowOther": true}` on `choose` or `multi` and a synthetic `Other…` row appears at the bottom of the list. On `choose`, picking it opens a text input and returns `{"index":-1,"value":"<typed>","other":true}`. On `multi`, pressing space on it opens an input; the typed string comes back alongside ticked items as `{"indices":[...], "values":[...], "other":"<typed>"}`. Use when the right answer might not be in the option list — the user is never trapped.

## When NOT to use it

- The answer needs reasoning or explanation (use chat).
- Open-ended discussion / brainstorm (use chat).
- The list is 2–3 items (chat is faster than launching a popup).
- You're outside tmux. The wrapper exits with `{"cancelled":true,"reason":"no-tmux"}` (exit 1) by design — fall back to chat. Setting `TUI_FORCE_INLINE=1` forces the raw-mode render but mangles chat scrollback; treat as a last resort.

## Attention modes (`TUI_ATTENTION`)

The user often pairs across multiple tmux windows — Claude in one, real work in another. The default popup is loud: it floats over whichever pane the user is currently looking at, regardless of where Claude lives. That's correct when Claude *wants* to interrupt, wrong when Claude just wants to ask politely.

| Mode | Behavior | Use when |
|---|---|---|
| `now` (default) | Pop immediately over whatever pane the user is on. | Active pairing; you have the user's attention; the question gates your next step. |
| `ring` | Bell + status flash, then pop now. | You drifted into a long-running task and want the user's eyes back; interrupt, but signal it. |
| `quiet` | Bell + status flash; **wait** until the user navigates to Claude's window/pane, then pop. Blocks (cap: `TUI_TIMEOUT_S`, default 1h). | The question is real but you don't need to interrupt them. You'd rather wait than break flow. Returns `{"skipped":true,"reason":"timeout"}` if they never come. |
| `optional` | Like `quiet` but bounded (default `TUI_TIMEOUT_S=60`). On timeout returns `{"skipped":true,"reason":"timeout","default":<spec.default>}` and exits 1. | You'd rather use a default than block. Set a `default` field on the spec; the wrapper echoes it back. Lines up with the "pick a sensible default, surface the assumption, keep going" posture. |

### Preferred workflow

- Default to **`now`** during interactive pairing — interrupting *is* what the user signed up for.
- Switch to **`quiet`** the moment you sense the user has moved on to other work (long agentic stretches, watching a build, in another window for >a minute). Better to wait politely than break their flow.
- Reach for **`optional`** when the answer would be nice but you have a sane default. Set `default` on the spec. Treat the timeout-skip as *information* — "user wasn't around, I picked X, surface that in the end-of-turn line."
- **`ring`** is the mid-point — when you genuinely want their attention but want to mark "this is from Claude" rather than just stealing the screen.

### Detection limits

`window_active` and `pane_active` only know about *this* tmux session. We can't tell whether the user is in another tmux session, in their browser, or AFK. So "user is here" is a best-effort signal — `quiet` and `optional` both have timeouts to avoid blocking forever.

## Protocol

```bash
echo '{"items":["a","b","c"],"prompt":"order"}' | tui reorder
# → {"ordered":["b","a","c"]}                           exit 0
# → {"cancelled":true}                                  exit 1 (esc/q)
```

Exit codes: `0` confirmed · `1` cancelled · `2` usage/spec error.

Cancel handling: treat exit 1 as "the human declined to answer this way" — fall back to asking in chat, don't loop the popup.

## Result shapes

| subcmd | result on success |
|---|---|
| `reorder` | `{"ordered":[...strings]}` |
| `choose` | `{"index":N,"value":"..."}` |
| `multi` | `{"indices":[...],"values":[...]}` (input order preserved) |
| `confirm` | `{"value":true|false}` |
| `input` | `{"value":"..."}` |
| `preview` | `{"action":"approve","index":N}` (one of `actions[]`) |
| `score` | `{"scores":[{"value":"...","score":N}, ...]}` |
| `form` | `{"values":{name1: ..., name2: ...}}` |
| `batch` | `{"values":{name1: <result>, name2: <result>}}` — each `<result>` is the per-subcmd shape above. Cancelling mid-batch returns `{"cancelled":true,"cancelledAt":"<name>","values":<partial>}`. |

## Implementation pointer

Source: `tools/tui/tui.tsx` (ink + react). Wrapper: `tools/bin/tui`. To add a subcommand, add a component + entry in `components` map; keep the JSON-spec-in / JSON-result-out contract.

If you find a primitive missing (sort-by-criterion, range-slider, table-row-pick), add it to `tui.tsx` rather than rolling a new tool — first place we looked is where it belongs.
