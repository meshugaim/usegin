---
name: tui
description: Ask the human for a structured answer through an interactive tmux-popup TUI instead of a chat exchange — reorder a list, pick one, multi-select, confirm, free-text input. Use when the answer would otherwise be a long chat ping-pong (e.g. "rank these 8 items", "which of these 12 should I include", "is this list right?"), when the input is positional or visual (ordering, set-membership) rather than verbal, or when you want a clean structured handoff (`{ordered:[...]}`, `{value:"..."}`, `{indices:[...]}`). Triggered by "let me reorder", "let me pick from a list", "ask me which", "show me a picker", "popup picker", "/tui", or by your own judgment when chat would be slower than three keystrokes.
---

# tui — interactive TUI primitives

The `tui` CLI (`tools/bin/tui`) renders a small ink-based TUI inside a tmux popup, takes a JSON spec on stdin, and emits a JSON result on stdout. Use it instead of asking the human to type a list back in chat.

Subcommands: `reorder`, `choose`, `multi`, `confirm`, `input`, `preview`, `score`, `form`. Run `tui <subcmd>` with no stdin or read `tools/bin/tui` for the spec shapes — they're tiny.

## When to reach for it

- **Reorder**: "rank these by priority", "what's the slice order", "fix this list". Chat round-trips for ordering are painful; popup is three keystrokes.
- **Choose / multi**: 5+ candidates and the human's answer is a pick, not an explanation. Below ~5, chat is fine.
- **Confirm**: only when the question is genuinely binary AND you want to gate a non-trivial action. For "ok?" mid-conversation, chat is faster.
- **Input**: a single short string with a default — branch name, file path, label. For anything multi-line or exploratory, chat.
- **Preview**: show a charter/spec/diff/markdown blob with an action footer (approve/edit/reject/…). The right tool when you want a gate after the human reads something — beats "here's the doc, ok?" in chat.
- **Score**: rate a list of items on a scale (1–5 stars or 1–100 bar). Direct fit for `prioritize`, retros, vibe ratings — replaces a chat list of "X: 4, Y: 3, …".
- **Form**: 3+ fields collected at once (text/confirm/choose), tab between fields, single submit. Use when you'd otherwise ask three questions in a row (`spec` metadata, charter scaffolding, issue creation).

## When NOT to use it

- The answer needs reasoning or explanation (use chat).
- Open-ended discussion / brainstorm (use chat).
- The list is 2–3 items (chat is faster than launching a popup).
- You're outside tmux without a TTY (the wrapper falls back to inline raw mode, but that mangles the chat scrollback — prefer chat).

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

## Implementation pointer

Source: `tools/tui/tui.tsx` (ink + react). Wrapper: `tools/bin/tui`. To add a subcommand, add a component + entry in `components` map; keep the JSON-spec-in / JSON-result-out contract.

If you find a primitive missing (sort-by-criterion, range-slider, table-row-pick), add it to `tui.tsx` rather than rolling a new tool — first place we looked is where it belongs.
