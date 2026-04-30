# Synthesis — dev-channel Slack prior art

Round: 5 parallel Polls (agent-bridges, terminal-cli, multi-identity-bots, tmux-popup-ux, socket-mode-listeners). 2026-04-30.

## TL;DR

Two of the handoff's "decided" pieces don't survive contact with prior art: **(1) one-listener-per-dev does not deliver every-message-to-every-dev** — Slack Socket Mode load-balances, it does not broadcast (socket-mode finding F2); **(2) the auto-popup checkbox `[x] inject into active agent context` cannot mean `tmux send-keys`** — that's the exact pattern Anthropic has four open race-condition bugs against in their own agent-teams feature (tmux-popup-ux finding B.3). Both have safe re-shapes (central coordinator OR backfill-as-correctness; `UserPromptSubmit` hook + inbox file). The Path-A identity choice survives, with three concrete annoyances to bake into UX up front. **`claude-code-slack-channel`** (jeremylongshore, MIT, v0.8.0) already implements the official `claude/channel` MCP injection primitive — read its `server.ts` end-to-end before writing a line of our own listener.

## Convergent findings

- **Use `metadata.event_payload` as the routing primitive, not `bot_id` or `username` parsing.** [agent-bridges, multi-identity, socket-mode] — three independent Polls landed on the same `{sender_kind, owner, agent_id, session_id, ...}` envelope. socket-mode adds `sender_machine` for filter-own; multi-identity flags a doc contradiction worth a 5-min wire probe before locking.
- **`tmux send-keys` into a running Claude is a known-bad pattern.** [tmux-popup, agent-bridges] — Anthropic's own agent-teams ships it; four open race bugs (#40168, #23513, #33987, #37217). `claude-code-slack-channel` deliberately avoids it via the `claude/channel` MCP (banner-style injection at turn boundaries). Our `tools/bin/question` already encodes the right contract.
- **The auto-inject piece is NOT novel — `claude-code-slack-channel` shipped it in March 2026.** [agent-bridges, tmux-popup] — implements `claude/channel` MCP capability; Slack messages arrive in the running Claude Code session as `<channel>` tags. Research-preview, allowlisted-plugins-only, but `--dangerously-load-development-channels` is a viable internal-tool path.
- **Path A (`chat:write.customize`) is the right default; the APP badge is non-removable.** [agent-bridges, multi-identity] — no prior art removes it within bot-token land. Mattermost (toggle-off) and Discord (no badge) made different platform calls.
- **Camp B (local-CLI-listener) tools are all 2026-Q1, all single-bot-single-instance.** [agent-bridges, terminal-cli] — `claude-slack-bridge`, `codex-slack-auto-bridge`, `claude-code-slack-channel`, `slack_codex_bot`, `remote-coder` all built recently; pattern is converging in real time. ~30% chance someone publishes a tmux-native variant before us — re-survey before we ship.
- **No prior art for our two-popup tmux-native UX.** [terminal-cli, tmux-popup] — TUIs are RTM-era and decaying; send-only CLIs don't receive; agent bridges reply Slack-side, not in-terminal. The compose-popup-keybind + receive-popup design is genuinely new ground.
- **None of the local-listener prior art solves cross-machine durability.** [terminal-cli, socket-mode, agent-bridges] — Slack's Delayed Events doesn't help (socket-mode F6). Camp A solves it implicitly (state in cloud).

## Load-bearing tensions (preserved, not averaged)

### T1 — Auto-popup-on-receive vs banner-only

- **Side A — keep the auto-popup (handoff's current design).** Demoed live, Lihu liked it ("Yes! Exactly like this :)"). The popup IS the human-in-the-loop step; clicking inject = explicit consent.
- **Side B — banner-only, popup-on-keybind.** [tmux-popup D1] `tmux display-popup` is focus-stealing; if Lihu is mid-typing into Claude when Oria pings, his next keystrokes go to the popup (tmux #4032/#4379 still open). Every other in-terminal chat client (weechat, gomuks, jj) notifies via status-bar/bell, attaches on demand. Demoed scenario was Lihu *idle*; the hazard is invisible until he's typing.
- **Evidence weight.** Side B has stronger architectural evidence (focus-steal is a real tmux-level constraint, not a guess); Side A has stronger UX evidence (Lihu actually used it and signed off). Resolution requires a re-demo with Lihu deliberately typing into Claude when popup spawns. Hybrid is available: banner inline always; auto-popup only when pane has been idle ≥N seconds.

### T2 — One-listener-per-dev vs central coordinator vs poll-as-fallback

- **Side A — pure local listeners (handoff design).** No central infra; matches "two products sharing a wire, separate stacks".
- **Side B — central coordinator (D1.a).** [socket-mode] Slack Socket Mode load-balances events across the N listeners — each event lands on ONE listener, not all. The handoff's "every dev sees every message" assumption is broken without something. Coordinator solves backfill once, filter-own per-dev, matches Slack's recommended production shape.
- **Side C — poll `conversations.history` as correctness layer (D1.c).** Socket Mode = fast path; poll = correctness path; dedup on `(channel, ts)`.
- **Evidence weight.** Side A is decisively wrong on the load-balance claim — Slack docs are explicit, and three Bolt-Python issues confirm empirically. Real fork is B vs C. Side B is cleaner; Side C is more "stay strictly local". Per-dev Slack apps (D1.b) is a third option, dismissed for OAuth-3x cost.

### T3 — Hybrid Path-A-for-agents + Path-B-for-humans, or pure Path A

- **Side A — pure Path A (handoff lock).** One bot, one OAuth, `chat:write.customize` per message. Cost: APP badge on human messages, mobile push shows bot identity not human, `chat.delete` blocked on customized posts.
- **Side B — hybrid (multi-identity Top).** Humans use per-dev user OAuth (Path B); agents stay on Path A shared bot. Removes badge on humans, fixes mobile push for human-to-human pings, opens redact UX. Cost: 3× OAuth, per-user token storage, sender-routing branch in CLI.
- **Evidence weight.** Multi-identity Poll explicitly leans hybrid-but-not-day-one — build Path A end-to-end, live with badge for ~1 week, decide. Two of the three Path-A annoyances (mobile push, `chat.delete`) are conjecture-grade — need 10-min live probes (multi-identity D2, D3). Don't promote hybrid until probes confirm the friction is real.

### T4 — Build on `claude/channel` MCP, or roll our own listener

- **Side A — build on `claude/channel`.** [agent-bridges D1] `claude-code-slack-channel` already implements Slack-as-channel; the `<channel>` injection mechanism is the official blessed primitive. Less code; future-proof.
- **Side B — roll our own Socket Mode listener.** [terminal-cli, socket-mode] Independence; not gated on Anthropic's allowlist; `--dangerously-load-development-channels` is technically viable internally but blocks productizing.
- **Evidence weight.** Side A has the official-primitive advantage but research-preview API churn (`claude-code-slack-channel` updated through v0.8.0 in ~6 weeks). Side B costs us re-solving event dedup, self-echo filtering, prompt-injection defense — all already shipped in `claude-code-slack-channel`. **Read `server.ts` before deciding** — agent-bridges Poll's strongest recommendation, currently un-acted-on.

## Decisions for Lihu (z026 shape)

### D1 — Listener architecture: coordinator vs poll-as-fallback vs per-dev-apps

- **Decision needed.** How do all three devs see every `#dev-pings` message when Slack only delivers each event to one listener?
- **Options.** (a) Central coordinator process + own pub/sub to local listeners. (b) Each listener also polls `conversations.history` every N seconds; Socket Mode is latency-only, poll is correctness. (c) Three Slack apps, one per dev — fan-out becomes moot because each app has one listener.
- **Lean.** (b) — keeps the "no central infra" property the handoff valued; existing `lib/channels.py` pagination is reusable; backfill-on-startup is already in the design and naturally generalizes to continuous-poll.
- **Why.** (a) introduces a coordinator the handoff explicitly avoided; (c) triples OAuth burden and shows three APP badges in the channel.
- **Price.** Every listener does ~60×N history-pulls/min; doubles dedup burden (Socket Mode + poll seeing same `ts`); non-winners see ~poll-interval latency.
- **Risk.** Tier-3 rate (50+ rpm) is comfortable for one channel; if we add more channels or shorten interval, re-evaluate.
- **For Lihu to weigh.** Latency tolerance for non-winner listeners. If 5–10s is fine, (b). If sub-second is required, (a).

### D2 — Auto-popup default vs banner-only

- **Decision needed.** Does an `@oria` message auto-spawn a tmux popup in Lihu's session?
- **Options.** (a) Auto-popup with two checkboxes (handoff). (b) Banner-only inline; popup behind `prefix + i` keybind. (c) Hybrid — banner always; auto-popup only when pane has been idle ≥N seconds.
- **Lean.** (c). Preserves the demoed UX Lihu liked when idle; sidesteps focus-steal when active.
- **Why.** Auto-popup is genuinely focus-stealing; tmux community asked for non-stealing popups for years and didn't get them. Banner-only loses the autonomous-feel Lihu signed off on.
- **Price.** (c) needs idle-detection logic (last-keystroke timestamp). Modest.
- **Risk.** "Idle" threshold-tuning. Start at 30s; iterate.
- **For Lihu to weigh.** Re-demo with Lihu deliberately typing into Claude when popup spawns. If focus-steal is invisible-bad, (c). If popup-spawn-while-typing is fine, keep (a).

### D3 — "Inject into active agent context" mechanism

- **Decision needed.** When the user ticks `[x] inject into active agent context`, what actually happens?
- **Options.** (a) `tmux send-keys` into the Claude pane (the naïve read of the handoff). (b) Write to an inbox file; `UserPromptSubmit` hook folds unread entries on next human prompt. (c) Build on `claude/channel` MCP via `--dangerously-load-development-channels`.
- **Lean.** (b). It's the only path that's turn-boundary safe today, mirrors `tools/bin/question`, doesn't depend on Anthropic allowlist or research-preview API churn.
- **Why.** (a) replicates Anthropic's own four open race bugs in our code. (c) is the official blessed primitive but research-preview only; we'd be early-adopting an unstable API.
- **Price.** (b) means injection happens at next human prompt, not the instant Slack event arrives. The "without-me-lifting-a-finger, my agent reads Oria's message and acts on it" autonomous fantasy is lost — but no production agent framework supports that fantasy today.
- **Risk.** Rename the checkbox to "queue for next prompt" or similar — set expectations honestly.
- **For Lihu to weigh.** Is the autonomous-mid-flight fantasy load-bearing for the product, or is queue-at-next-prompt enough? If load-bearing, accept (c)'s instability; otherwise (b).

### D4 — Hybrid Path-A/Path-B, or stay pure Path A

- **Decision needed.** Do humans post via per-dev user OAuth (Path B) while agents stay on shared bot (Path A)?
- **Options.** (a) Pure Path A, accept the three annoyances. (b) Hybrid from day one. (c) Pure Path A, upgrade to hybrid only after ~1 week if friction proves real.
- **Lean.** (c). Two of the three Path-A annoyances (mobile push fallback, `chat.delete` block) are conjecture-grade — multi-identity Poll explicitly flagged them as "judgment, partly evidence" and recommended 10-min wire probes.
- **Why.** Don't pay the 3× OAuth + per-user token storage + dual-stack cost on day one for friction we haven't actually felt.
- **Price.** Live with possible APP-badge noise on human messages for a week.
- **Risk.** Low. Upgrade cost is ~half a day per dev.
- **For Lihu to weigh.** Run the two probes (multi-identity D2, D3) before locking. Total: ~15 min wall-clock.

### D5 — Read `claude-code-slack-channel` source before writing our own

- **Decision needed.** Do we read `jeremylongshore/claude-code-slack-channel/server.ts` end-to-end before designing our listener, or build independently?
- **Options.** (a) Read first, copy what's good, reject what isn't, write our listener with their solved-problems already absorbed. (b) Build independently, look at theirs only if we hit problems.
- **Lean.** (a). Strongly. agent-bridges Poll's #1 recommendation, currently un-acted-on.
- **Why.** They've shipped event dedup, self-echo triple-check (`bot_id` + `bot_profile.app_id` + `user`), tamper-evident audit journal, policy-gated tool approvals, five-layer prompt-injection defense. Re-discovering all of these in our codebase is a week of work we don't need to do.
- **Price.** ~1–2h read.
- **Risk.** None. Worst case we conclude their architecture doesn't fit and proceed independently — but informed.
- **For Lihu to weigh.** Nothing. Just do it.

### D6 — Wire-probe Slack metadata + customize behavior before locking design

- **Decision needed.** Do we run the cheap probes that resolve doc contradictions before writing code?
- **Options.** (a) Run all four probes (~30min total). (b) Skip; trust the docs.
- **Lean.** (a).
- **Why.** Probes resolve: (i) does `chat.postMessage(metadata=...)` work with bot token or require app-token? (ii) does mobile push surface `username` override or bot identity? (iii) does `chat.update` preserve `username`/`icon_emoji` or must we re-pass? (iv) does Socket Mode actually load-balance (the F2 disprover, ~30 lines).
- **Price.** ~30min wall-clock.
- **Risk.** None. All probes are read-or-test-only against the existing spike.
- **For Lihu to weigh.** Nothing. These have to happen before code.

## What we reuse vs build

| Slice | Verdict | Source |
|---|---|---|
| Slack manifest (scopes + events + Socket Mode + app-token) | **crib** | `aisandler/claude-slack-bridge/slack-app-manifest.yaml` (terminal-cli) |
| Event dedup, self-echo filter, prompt-injection defense, audit journal | **read-then-decide** | `jeremylongshore/claude-code-slack-channel/server.ts` (agent-bridges) |
| Shell-hook auto-start (`claude` shell wrapper boots listener) | **crib pattern** | `oh1701/codex-slack-auto-bridge/install-shell-hook.sh` (terminal-cli) |
| `<channel>` MCP injection (the "auto-inject" piece) | **reuse, possibly directly** | `claude-code-slack-channel` implements official `claude/channel` (agent-bridges) |
| `UserPromptSubmit` hook + inbox file (the safe inject path) | **reuse our own** | `tools/bin/question` + `.claude/skills/parking-question/SKILL.md` (tmux-popup) |
| `metadata.event_payload {sender_kind, owner, agent_id, session_id, sender_machine, target}` envelope | **build** | novel; flat-only constraint per Slack metadata docs |
| `chat:write.customize` per-message identity (`<dev>` vs `<dev>@<handle>`) | **build** | novel — no prior art uses customize this way |
| Two-checkbox receive popup (`[x] inject / [ ] clipboard`) | **build, possibly Lean (c)** | novel |
| tmux compose-popup keybind | **build** | novel |
| Backfill on startup (`conversations.history` since checkpoint) | **build, standard** | wee-slack reconnect/backfill discipline as reference (terminal-cli) |
| Cross-machine durability | **build OR defer** | no prior art helps; `conversations.history` poll is the only honest answer |
| Tmux popup substrate (toggleable inbox) | **crib** | `loichyan/tmux-toggle-popup` ≥ 0.5.1 (tmux-popup) |
| macOS native fallback (Lihu off-tmux) | **defer** | `vjeantet/alerter` reply-prompt notifications if needed later |

## Re-shaped design

What the handoff said vs what we'd say now (deltas only):

1. **"Per-dev Socket Mode listener, always-on local"** → *and* a correctness layer (D1 lean (b): each listener also polls `conversations.history` every N seconds). Without this, Slack's load-balance fan-out means Lihu's listener sees ~1/3 of messages live.

2. **"Targeted-at-me messages auto-spawn tmux popup"** → *only when pane has been idle ≥N seconds* (D2 lean (c)). Banner inline always. Re-demo with Lihu typing-into-Claude before locking.

3. **"`[x] inject into active agent context` (default on)"** → *means write to inbox file; `UserPromptSubmit` hook folds in next prompt* (D3 lean (b)). Rename checkbox to "queue for next prompt" to set expectations. NOT `tmux send-keys`. The `claude/channel` MCP path (D3 (c)) is a defensible upgrade once Anthropic stabilizes the API.

4. **Path A locked** → unchanged, *but* run the two 10-min wire probes (mobile push, `chat.delete`) before declaring the cost. Hybrid (D4) is week-2 conditional, not day-one.

5. **`metadata.event_payload {sender_kind, owner, agent_id, session_id}`** → add `sender_machine` (filter-own key) and `target` (popup-routing key). Flat-only, per Slack constraint.

6. **Slack scopes "still needed"** → confirmed: `chat:write.customize` + app-level token with `connections:write` + Socket Mode enabled + `message.channels` subscribed. Verify metadata-write works on bot token (D6 probe (i)) before assuming.

7. **"Cross-machine durability ... flagged but deferred"** → backfill-on-startup is already in the design and *is* the answer when paired with poll-as-correctness (D1 lean (b)). Not separately deferred — it's solved by the same primitive.

8. **Read first.** Before any of the above is built, read `claude-code-slack-channel/server.ts` (D5). Almost certainly changes specifics in items 1, 3, 5.

## Friction

- **Round produced no friction zettels.** Charters were clean, prior art was on the open web (with one closed-source gap noted), no inter-Poll deadlocks. Multi-identity and tmux-popup Polls each *considered* capturing zettels and deferred to Sam — see below.
- **Closed-source gap.** None of the Polls could read inside-Anthropic discussion on the four agent-teams send-keys race bugs. We see public threads only. *Whose problem.* Anthropic's; not actionable.
- **Allowlist-policy gap.** `claude/channel` MCP allowlist application path is undocumented. `--dangerously-load-development-channels` is the workaround for internal tools. *Whose problem.* Anthropic's; flag as gating-question for productization later.
- **`/tmp/slack-incoming-v2.sh` and `/tmp/slack-send.sh` were evicted from the devcontainer before tmux-popup Poll could read them.** Mitigation: recover from `.claude/handoffs/transcript_20260430_105055.md` if exact tmux-popup invocation matters. *Whose problem.* Devcontainer ephemerality; future spike scripts should land in `experiments/` not `/tmp`.
- **Doc contradiction on metadata + bot-token write authority.** One Slack docs surface says metadata requires app-level token; current `chat.postMessage` reference shows it as a kwarg on bot-token calls. Resolved by 5-min wire probe (D6.i). *Whose problem.* Slack's doc consistency; not blocking.
- **Two zettel candidates worth capturing post-synthesis (Sam's call):**
  - "Slack APP badge is non-removable on `chat:write.customize` posts" — Path-A-vs-B decision is partially aesthetic + partially functional, not just OAuth-cost.
  - "Send-keys into a running agent is a known-bad pattern; banner-inject + `UserPromptSubmit` hook is the right shape." May overlap z032/z036 (parking-question contract) and z023 (first-place-we-looked); confirm before capturing.
