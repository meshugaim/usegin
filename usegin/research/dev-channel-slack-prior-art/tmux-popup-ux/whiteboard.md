# tmux-popup chat UX + auto-inject — prior art

Author: Poll (sub-agent), 2026-04-30
Round: dev-channel Slack prior-art R&D
Angle: tmux popup as chat UX + injecting an incoming message into a running agent's context.

---

## Top — the click

**The "auto-inject into the active Claude session" half is genuinely
unsolved upstream.** Every documented attempt — Anthropic's own
agent-teams feature, the four-times-filed `claude inject` request,
aider's `/run --pipe` request — runs into the same wall: there is no
public Claude Code IPC for "inject this text into a running session."
`tmux send-keys` is the only mechanism actually available, and
Anthropic shipped that for agent-teams *in 2025-2026* and immediately
filed four open race-condition bugs against themselves
(#40168, #23513, #33987, #37217 on `anthropics/claude-code`). The
hazard is real and recurring: send-keys arrives before the pane's
shell, or mid-tool-call, or while the user is typing — content gets
swallowed, partially interpreted, or pollutes a draft.

**The closest thing to a working contract is our own
`parking-question` / `[Q parked …]` banner-inject pattern.** It
sidesteps the hazard by not actually injecting into Claude's stdin —
it writes a banner to a queue file the active context will see at the
next natural read, and Claude is contracted (via SKILL.md) to honor
it without breaking the current task. That's the same shape OpenHands
chose for `ask_agent()` (non-blocking, doesn't interrupt main
conversation flow), and the same shape Anthropic's `UserPromptSubmit`
hook chose (stdout-as-context, fired only when the human submits — *no
external trigger*).

**Recommendation for the dev-channel popup:** keep the receive-popup
two-checkbox UX, but treat `[x] inject into active agent context` as
"write a `[MSG from oria]:` banner to the same parked-question queue
or an analogous inbox file" — *not* as `tmux send-keys` into the
Claude pane. Send-keys-into-running-Claude is a known foot-gun with
multiple Anthropic open bugs; we'd be re-discovering them in our own
codebase. Our existing in-house analog (ci-watcher in
`tools/bin/ci-watcher`) already side-steps the hazard by spawning a
NEW window with a fresh shell and send-keying *into the shell prompt*,
not into a running Claude — that's the only `send-keys` pattern in
this repo that works reliably.

---

## Middle — the body

### A. tmux popup as chat UX (the "shell" of the popup)

#### A.1 `tmux display-popup` (built-in, tmux ≥ 3.2)

1. **Popup mechanism** — `tmux display-popup -E '<cmd>'` opens a
   modal floating overlay running `<cmd>`; `-E` means close-on-exit.
   Default behavior steals focus and blocks the calling client.
2. **Reply flow** — whatever process you launched inside owns input.
   For chat UX you'd run e.g. `gum input` / `dialog` / `whiptail` /
   a shell loop reading from stdin, then `tmux send-keys` or write to
   a file on submit.
3. **Inject target** — popup itself doesn't inject; it just renders.
   Whatever the inner process does on close is the "inject" step.
4. **Safety** — popup is *blocking* by default; the calling client is
   frozen until popup exits. If the user is mid-typing in their main
   pane when the popup auto-spawns, **their next keystrokes go to the
   popup, not where they were typing**. That's a real UX hazard for
   "auto-spawn on incoming Slack message."
5. **Repo + status** — alive. Active development. Open feature
   requests for non-blocking popups (#4379, #4032 — toast-style
   non-focus-stealing popups) are explicitly *not yet shipped*.

Sources:
- https://github.com/tmux/tmux/issues/4032 — toast/non-focus-stealing
  popups: still open, no workaround merged
- https://github.com/tmux/tmux/pull/4379 — non-blocking `-b` flag for
  display-popup, still in PR
- https://www.joshmedeski.com/posts/popup-history-with-tmux-and-fzf/
  — canonical "popup with fzf reading lines from a file" pattern

**Implication for dev-channel:** auto-spawning a popup on every
incoming `@oria` message is a *focus-stealing event*. If Lihu is
typing into Claude when Oria pings, his next keystroke lands in the
popup. Either:
- (a) put the popup behind a keybind only — banner inline, popup on
  demand (mirrors parking-question's contract), or
- (b) accept the focus steal but make the popup trivially dismissable
  with a single key (Esc/Enter), and document the hazard.

Our handoff says option (b) is what was demoed and Lihu liked. Worth
re-confirming with the focus-steal hazard named explicitly.

#### A.2 `loichyan/tmux-toggle-popup` (≥ 0.5.1, Feb 2026)

1. **Popup mechanism** — wraps `display-popup` to add toggle + state
   persistence. Popup keeps its shell/working-dir between toggles.
2. **Reply flow** — same as raw popup; you supply the inner process.
3. **Inject target** — n/a; popup is the renderer.
4. **Safety** — toggle model means popup can be summoned cheaply, so
   "show banner inline; user toggles popup to read+reply" is the
   clean variant. State persists across toggles, so a chat history
   feels right inside it.
5. **Repo + status** — alive, recently shipped; tmux ≥ 3.4.

Source: https://github.com/loichyan/tmux-toggle-popup

**Implication:** if we go banner-only (no auto-popup), this plugin
is the right substrate — bind `prefix + i` to a toggleable inbox
popup that shows the unread queue.

#### A.3 `atomicstack/tmux-popup-control`

TUI for managing tmux from inside a popup. Not chat, but the same
plumbing — Bubble Tea + Lip Gloss inside `display-popup -E`. Useful
reference for "rich TUI inside a popup" if the inbox grows past one
message at a time.

Source: https://github.com/atomicstack/tmux-popup-control

#### A.4 `aaronNGi/jj` — file-based IRC, popup-ready

1. **Popup mechanism** — n/a; it just exposes files. Popup is the
   user's job.
2. **Reply flow** — write to `in` FIFO; output appended to per-channel
   log files. Stock pattern: `tail -f channels/#dev.log | jjp`
   inside a tmux popup; compose by writing to the FIFO.
3. **Inject target** — FIFO. Critically: **no stdin race** because the
   FIFO has its own reader (jjd daemon), not a shell-prompt-bound
   process.
4. **Safety** — clean separation of input/output channels. The
   pattern that aged best: the daemon owns the connection, the
   popup is just a cheap renderer with no state of its own.
5. **Repo + status** — last release v0.9 Aug 2021; mostly dormant
   but the *pattern* is the artifact.

Source: https://github.com/aaronNGi/jj

**Implication:** the cleanest dev-channel architecture is jj-shaped:
a daemon (Socket Mode listener) owns Slack; popup is a stateless
renderer over a file/FIFO. The "inject into Claude" question becomes
"how does Claude read the file" — which is the parking-question
shape, not the send-keys shape.

#### A.5 weechat / gomuks / IRC-in-tmux

These run TUI inside a tmux pane (not popup). Notification is
typically `notify-send` / bell / status-bar. They do NOT auto-spawn
popups; the user attaches the pane on demand. This is the dominant
pattern for in-terminal chat: **notify, don't pop**. Strong vote
in favor of banner-only.

Sources:
- https://github.com/lukaszkorecki/weechat-tmux-notify — tmux
  status-bar / bell on highlight; no popup
- https://blog.petrzemek.net/2015/08/08/a-new-notification-plugin-for-weechat/
  — same; notify-send / bell

#### A.6 macOS native: `terminal-notifier` + `alerter`

`terminal-notifier` is fire-and-forget. `alerter` (julienXX's
fork) adds **reply-prompt notifications**: a system notification with
a "Reply" text box; user input is returned via stdout/JSON. This is
the macOS-native analog of our popup. Cross-platform: macOS only.

1. **Popup mechanism** — system notification with reply field.
2. **Reply flow** — stdout / `--json`.
3. **Inject target** — your script's stdout — *you* decide what to do
   with it.
4. **Safety** — non-focus-stealing in the OS sense; user can ignore.
5. **Status** — alive, last release 26.5 (Feb 2026).

Source: https://github.com/vjeantet/alerter

**Implication:** if we ever want a non-tmux fallback (Lihu on his Mac
with no terminal focus), `alerter` gives the same UX shape — and
it's deliberately non-focus-stealing, which is what the tmux folks
*want* but haven't shipped.

---

### B. Auto-inject patterns (the hazardous half)

#### B.1 Our own `tools/bin/question` — banner-only inject

1. **Popup mechanism** — none. Lihu types `!question "..."` in the
   chat; the script writes to a per-day jsonl queue and prints a
   `[Q parked TIMESTAMP]:` banner to stdout.
2. **Reply flow** — Claude sees the banner in its next context read,
   answers inline at next natural pause.
3. **Inject target** — *not stdin*. The banner appears in stdout that
   gets folded into Claude's context-stream alongside Lihu's own
   message. Crucial: it's "context" not "input" — Claude reads it
   the way it reads any tool output.
4. **Safety** — by design, **never breaks the current task**. The
   parking-question SKILL.md is explicit: "Don't drop your current
   task. Whatever you were doing — keep doing it." Mid-tool-call is
   safe because there's no event injection — just a queue file Claude
   re-reads at convenient points.
5. **Repo + status** — live, in this repo.
   `/workspaces/test-mvp/tools/bin/question`
   `/workspaces/test-mvp/.claude/skills/parking-question/SKILL.md`

**This is the contract to mirror.** It's the only injection pattern
I found anywhere — local or external — that explicitly addresses the
mid-tool-call hazard *and* documents the receive-side discipline.

#### B.2 Our own `tools/bin/ci-watcher` — fresh-shell send-keys

1. **Popup mechanism** — none. Spawns a tmux window.
2. **Reply flow** — n/a; one-way notification to a fresh Claude.
3. **Inject target** — `tmux new-window` then `tmux send-keys -t ...
   "claude-canonical $CLAUDE_ARGS \"$FIRST_MSG\"" Enter` into the
   *fresh shell prompt*, not into a running Claude.
4. **Safety** — sleeps 1s between `new-window` and `send-keys`. The
   window is brand-new so the shell-init race is bounded. **It does
   NOT inject into the existing session.** It forks a new Claude
   resumed from the prior session via `--fork-session --resume
   $SESSION_ID`. So the existing session is undisturbed; the user
   notices via `tmux display-message` ringing the bell.
5. **Repo + status** — live.
   `/workspaces/test-mvp/tools/bin/ci-watcher` (lines 174-191)

**Key takeaway:** the only working `send-keys` pattern in our
codebase deliberately avoids injecting into a live Claude. It
spawns a new pane, send-keys into a fresh shell, and resumes
session state via the official `--resume` flag. If we want
"agent reacts to Slack message," the safe shape is the same:
spawn a sibling Claude that's resumed from session state, not
inject into the running one.

#### B.3 Anthropic agent-teams — send-keys race-condition cluster

This is the most direct prior art for "what happens if you ship
auto-inject naively." Anthropic's own agent-teams feature spawns
teammate Claudes via tmux split-pane + send-keys; four open bugs
and counting:

- **#40168 (open)** — send-keys arrives before zsh prompt; command
  text appears in pane but never executes. Repro on bare zsh
  configs even with 0.03s shell init — i.e. *not* fixable by "add
  more sleep."
- **#23513 (open)** — same race, different symptom: teammates fail
  to start.
- **#33987 (closed as duplicate)** — proposed config
  `team.tmuxSendKeysDelayMs: 5000`. Maintainer treated as dup; no
  fix landed.
- **#37217 (open)** — same.

Proposed safer fixes from the threads:
- `tmux split-window -- <command>` — bypass send-keys, exec command
  directly as the pane's PID 1
- Poll for shell readiness (write a marker, wait for echo)
- Write to a FIFO the teammate reads, instead of send-keys

1. **Popup mechanism** — n/a; tmux pane.
2. **Reply flow** — n/a.
3. **Inject target** — running shell's stdin via `send-keys`.
4. **Safety** — broken. Multiple bugs, no fix shipped. The maintainer
   pattern is to mark these "stale" and not address.
5. **Status** — bugs open in Anthropic's official repo, late 2025
   through 2026.

Sources:
- https://github.com/anthropics/claude-code/issues/40168
- https://github.com/anthropics/claude-code/issues/23513
- https://github.com/anthropics/claude-code/issues/33987
- https://github.com/anthropics/claude-code/issues/37217

**This is the most important data point in this whiteboard.** If
*Anthropic* can't make tmux send-keys safe for spawning a fresh
Claude, we should not assume we can make it safe for injecting into
a running one. The variance is worse, not better.

#### B.4 `claude inject` feature request (#24947, #27441)

Both filed asking for what we want. Both closed without a fix.

- **#24947** (closed, was high-priority) — exact CLI shape we'd
  want: `claude inject <session_id> --text "..."`, `--text-file`,
  `--stdin`, idempotency `--key`. Suggested impls: unix domain
  socket per session, named pipe, file-based message queue.
- **#27441** (closed as duplicate of #24947) — three-Claude
  multi-agent use case (vclod/mclod/aclod). Proposed alternative
  hook: `InboxMessage` / `TeammateMessage` event firing on
  watched-file change, output injected to Claude's context. *This is
  the parking-question pattern, generalized.*

Status: there is **no public Claude Code API to inject prompts into
a running session** as of 2026-04. The only sanctioned channel is
`UserPromptSubmit` hook, which fires only when the human types.

Sources:
- https://github.com/anthropics/claude-code/issues/24947
- https://github.com/anthropics/claude-code/issues/27441
- https://github.com/anthropics/claude-code/issues/6009 — closed
  "not planned": pipe stdin to pre-populate prompt

#### B.5 `UserPromptSubmit` hook — the official "context injection"

The closest blessed pattern: Claude Code has a `UserPromptSubmit`
hook whose stdout is added as context Claude can see. Fires only
when the human submits a prompt. So you can't use it for "Slack
message arrives" autonomously — but you CAN use it for "next time
the human types, prepend any pending parked questions / Slack
inbox to context."

1. **Popup mechanism** — none.
2. **Reply flow** — Claude reads injected context and responds in
   the same turn.
3. **Inject target** — Claude's context, prepended to user's prompt.
4. **Safety** — turn-boundary by construction. Cannot fire
   mid-tool-call because it's gated on the human pressing Enter.
5. **Status** — official, documented, supported.

Source: https://code.claude.com/docs/en/hooks

**Direct application:** the listener writes incoming `@oria`
messages to an inbox file. A `UserPromptSubmit` hook reads
unread inbox entries on every prompt submit and prepends them as
"[INBOX since last turn]: ..." context. No popup; no race; turn-
boundary safe; works exactly like parking-question. **This is
probably the right primary path.**

#### B.6 aider `/run --pipe` request

Aider's `/run` runs a shell command. Issue #2740 asks to add `--pipe`
that injects command output into the chat as if typed. **Not
implemented**; same gap as Claude Code. No safety discussion in
thread — the requesters appear unaware of the mid-tool-call hazard.

Source: https://github.com/Aider-AI/aider/issues/2740

Aider does have `--message-file` for non-interactive use (read message
from file, run, exit). Not interactive injection.

#### B.7 OpenHands `ask_agent()`

The only major agent framework that has actually shipped this:

```python
response = conversation.ask_agent("Summarize activity in 1 sentence.")
```

Non-blocking, runs alongside `conversation.run()` in another thread.
Returns a string answer. Crucially: the docs *don't* describe
turn-boundary semantics or mid-tool-call behavior — which suggests
the hazard exists but isn't documented. The framing is "ask
*about* the agent's state," not "inject *new instructions* mid-run"
— a softer ask that sidesteps the hardest cases.

1. **Popup mechanism** — n/a; SDK call.
2. **Reply flow** — return value of the function.
3. **Inject target** — agent's reasoning context.
4. **Safety** — undocumented. Likely OK because it's read-only
   ("summarize"); injecting "now also do X" is not what the API is
   sold as.
5. **Status** — shipped, documented.

Source: https://docs.openhands.dev/sdk/guides/convo-ask-agent

**Implication:** even the best-shipped variant is read-only. The
prior art for *write*-injecting a mid-run agent is empty.

#### B.8 tmux send-keys hazards (general)

- `send-keys` simulates **keystrokes**, not stdin. Difference matters
  when target uses raw mode / readline — the keys appear in whatever
  input box currently has focus. If user is typing, keys interleave
  with their typing.
- No native rate limiting; large strings can overflow input buffers
  on slower terminals. tmux/tmux#1186 (closed without fix) requested
  a "send-keys from a process with rate limiting."
- **`load-buffer` + `paste-buffer` is no safer** — paste-buffer also
  goes through the keystroke path; only difference is auto-newline
  behavior on default keybind. Not a real safety win.

Sources:
- https://github.com/tmux/tmux/issues/1186
- https://github.com/tmux/tmux/wiki/Clipboard

---

### C. Summary table

| Pattern | Inject target | Mid-tool-call safe? | Shipped? | Verdict |
|---|---|---|---|---|
| `tools/bin/question` (banner) | context-read | Yes (queue file) | Yes (us) | Mirror this |
| `ci-watcher` (fresh shell + send-keys) | shell prompt | N/A (new window) | Yes (us) | Safe; but spawns new Claude |
| Anthropic agent-teams (send-keys to teammate pane) | shell prompt | No (race bugs) | Yes (Anthropic) | Don't replicate |
| `claude inject` (proposed) | running session | Discussed; not designed | No | Wait |
| `UserPromptSubmit` hook | context, on human submit | Yes (turn boundary) | Yes (Anthropic) | **Use this** |
| OpenHands `ask_agent()` | reasoning context | Undocumented; framed read-only | Yes | Read-only path only |
| aider `/run --pipe` | chat input | Not discussed | No | Skip |
| `display-popup -E` (focus-stealing) | popup process stdin | Hazard: focus steal mid-typing | Yes | Use behind keybind, not auto |
| `tmux-toggle-popup` | popup process stdin | Same as raw popup | Yes | Good substrate for on-demand inbox |
| jj (FIFO + log files) | FIFO daemon | Yes (separate reader) | Yes (dormant) | Architectural reference |
| alerter (macOS reply) | stdout to caller script | Yes (OS-native, non-focus) | Yes | Mac fallback option |

---

## Bottom — the open ends

### Dilemma D1 (z026 shape) — banner-only vs. auto-popup-on-receive

**Frame:** the handoff documents that Lihu liked the auto-spawn
popup with two checkboxes (`[x] inject into active agent context`,
`[ ] copy to clipboard`). But the prior art strongly suggests:

- *Auto-popup steals focus.* User mid-typing into Claude → next
  keystrokes go to popup. tmux's own community has been asking for
  non-focus-stealing popups for years and it's not shipped (#4032,
  #4379). Every other terminal chat client (weechat, gomuks, hatcog)
  notifies via status-bar/bell and the user attaches on demand —
  *not* auto-popup.
- *"Inject into active agent context"* via tmux send-keys is exactly
  the operation Anthropic is currently shipping bugs against
  themselves on.

**Lean A — banner-only, popup-behind-keybind (recommend).**
Receive flow: listener writes incoming Slack message to an inbox file
plus prints a one-line `[INBOX from oria]: <body>` banner. User
reads the banner inline; presses `prefix + i` to toggle the
inbox popup if they want the full conversation. Injection into
Claude is via `UserPromptSubmit` hook reading unread inbox entries
on next human prompt — exactly the parking-question contract.
- Cost: loses the "without me lifting a finger, my agent reads
  Oria's message and acts on it" autonomous fantasy. But that
  fantasy is unsupported by any production agent framework today.
- Risk: very low. We already run this exact contract daily for
  parking-question.

**Lean B — auto-popup with two checkboxes (current handoff
design).**
Receive flow: popup auto-spawns on `@oria` message. Two checkboxes
control side-effects on close.
- Cost: focus-steal hazard mid-typing; the "inject" checkbox depends
  on `tmux send-keys` into a Claude pane, which is the known-bad
  pattern.
- Risk: medium. Replicates Anthropic's open bugs in our code. UX
  works only when user is idle.

**Lean C — hybrid.**
Banner inline on every message; popup auto-spawns only when message
is `@oria` *and* tmux pane has been idle ≥ N seconds (no recent
keystrokes). "Inject" checkbox writes to inbox file; relies on
`UserPromptSubmit` hook for actual context-folding (not send-keys).
- Cost: more moving parts (idle detection).
- Risk: low if we keep the inject path off send-keys.

**My read:** Lean A or Lean C. The handoff design (Lean B) was
demoed live with Lihu idle, which is the exact scenario where the
hazard is invisible. The hazard surfaces only when Lihu is mid-
typing or Claude is mid-tool-call. Worth re-demoing with Lihu
deliberately typing into Claude when the popup spawns to expose
the focus-steal.

This is the load-bearing decision. Sam should put it in front of
Mark.

### Dilemma D2 — "inject into active agent context" — what does
that actually mean?

The handoff phrasing is ambiguous between three implementations:

1. **`tmux send-keys` into the Claude pane.** Hazardous (Anthropic's
   own open bugs).
2. **Write to an inbox file; `UserPromptSubmit` hook folds it in
   next turn.** Safe; turn-boundary; supported. Doesn't fire until
   user types.
3. **Wait for `claude inject` to ship.** It's not shipped (#24947
   closed without fix; #27441 closed as dup). No ETA.

If Lihu's mental model when he ticked the box was (1), the UX promise
is broken under load. If it was (2), we should rename the checkbox
to "queue for next prompt" or similar. (3) isn't an option until
Anthropic ships.

### Dilemma D3 — focus-steal is the headline UX hazard

Not mentioned in the handoff. Every popup-on-receive design has it.
Worth a single explicit demo: have Lihu start typing a long message
to Claude, have Oria send a message, see what happens to his
in-progress text. If his cursor jumps to the popup, that's the
hazard made concrete.

### Gap G1 — cross-machine message durability

Handoff already flags this: "Cross-machine durability (Lihu sees
Oria's messages even if Lihu's listener was offline) is unaddressed
— flagged but deferred." Not my angle but worth flagging here too:
backfill-on-startup will read the channel history, but if Lihu is
on his laptop *and* his desktop, two listeners → duplicate popups.
Solved by the daemon-not-popup architecture (jj-shaped).

### Gap G2 — friction not captured as zettel

I considered capturing this finding as a zettel:

> **Send-keys into a running agent is a known-bad pattern; banner-
> inject into a queue file the agent reads at turn boundaries is
> the right shape.**

But it overlaps z032/z036 (parking-question contract) and likely
z023's "first-place-we-looked" rule about mirroring known-good
contracts. Leaving the call to Sam — if there's no clear pre-
existing zettel that says "don't send-keys into running agents,
use UserPromptSubmit + inbox," it's worth a fresh zettel.

### Gap G3 — I did not read

- The actual `/tmp/slack-incoming-v2.sh`, `/tmp/slack-send.sh`
  scripts referenced in the handoff. They were deleted before I
  reached them (devcontainer state evicted /tmp). Couldn't verify
  the exact `tmux display-popup` invocation or the checkbox
  behavior. **Mitigation:** re-create them next session or recover
  from the prior session transcript referenced at
  `.claude/handoffs/transcript_20260430_105055.md`.
- Inside-Anthropic discussion on the four agent-teams race bugs is
  not visible — only the public issue threads.

---

## Sources (read this round)

In-repo:
- `/workspaces/test-mvp/tools/bin/question`
- `/workspaces/test-mvp/.claude/skills/parking-question/SKILL.md`
- `/workspaces/test-mvp/tools/bin/ci-watcher` (lines 174-191)
- `/workspaces/test-mvp/.claude/handoffs/handoff_20260430_105055.md`
- `/workspaces/test-mvp/.claude/skills/interactive-cli/SKILL.md`

External:
- https://github.com/anthropics/claude-code/issues/24947 — `claude inject` request, closed
- https://github.com/anthropics/claude-code/issues/27441 — inter-agent message injection, dup
- https://github.com/anthropics/claude-code/issues/6009 — pipe stdin to populate prompt, not planned
- https://github.com/anthropics/claude-code/issues/40168 — agent-teams send-keys race, open
- https://github.com/anthropics/claude-code/issues/23513 — same race, open
- https://github.com/anthropics/claude-code/issues/33987 — configurable delay for send-keys, dup
- https://github.com/anthropics/claude-code/issues/37217 — same race
- https://github.com/Aider-AI/aider/issues/2740 — /run --pipe request
- https://github.com/tmux/tmux/issues/4032 — toast popups, open
- https://github.com/tmux/tmux/pull/4379 — non-blocking popups, open
- https://github.com/tmux/tmux/issues/1186 — send-keys from process, closed
- https://github.com/loichyan/tmux-toggle-popup
- https://github.com/atomicstack/tmux-popup-control
- https://github.com/aaronNGi/jj — file/FIFO IRC pattern
- https://github.com/vjeantet/alerter — macOS reply-prompt notifications
- https://docs.openhands.dev/sdk/guides/convo-ask-agent — OpenHands ask_agent()
- https://code.claude.com/docs/en/hooks — UserPromptSubmit hook
- https://github.com/lukaszkorecki/weechat-tmux-notify — weechat→tmux status-bar pattern
- https://www.joshmedeski.com/posts/popup-history-with-tmux-and-fzf/
