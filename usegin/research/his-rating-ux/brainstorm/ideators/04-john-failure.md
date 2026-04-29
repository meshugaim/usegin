# John — failure-imagination ideas

Each idea is named by the failure mode it dodges. Name failure first; idea
follows. No filtering, no ranking.

---

1. **Dodge "another modal interrupt"** → no prompt at all; rating is a
   single keystroke `r` in the statusline that submits the *currently
   inferred* general score and exits. Fail-mode dodged: any UX that asks
   anything gets skipped after week 2.

2. **Dodge "loses chat focus"** → submission is a single message Lihu
   types into the chat (`!42`), parsed by a UserPromptSubmit hook,
   never reaches Claude. Fail-mode dodged: shell context-switch.

3. **Dodge "needs to think of a number"** → 3-bucket only: `+`, `=`, `-`
   (good / fine / bad). Mapped to 75/50/25. Fail-mode dodged: number
   paralysis at 5pm.

4. **Dodge "score-shopping"** → no number entry at all; rating is a
   one-word free-text *vibe* (`grindy`, `clean`, `meh`) that the system
   later maps. Fail-mode dodged: Lihu spends 20s deciding 67 vs 72.

5. **Dodge "what aspects again?"** → never expose aspects to human.
   Human only ever rates `general`; Claude fills aspects from its own
   submission. Fail-mode dodged: aspect-menu re-orientation cost.

6. **Dodge "it nags at the wrong moment"** → no auto-trigger ever.
   Rating only fires when Lihu *himself* types `/end` or `!rate`. The
   Claude-side Stop block stays orthogonal. Fail-mode dodged: auto-arm
   firing mid-flow.

7. **Dodge "TTY missing in chat-bash"** → submission is a markdown link
   in the assistant's last message — `[rate this turn: 👍 👎 🤷]` — each
   link goes through a tiny localhost listener Claude already owns.
   Fail-mode dodged: no-TTY in chat-spawned bash.

8. **Dodge "voice input is a fantasy"** → don't try voice. Wispr Flow
   already does it; just accept Wispr-typed `!rate good, focus was
   bad` into the chat. Fail-mode dodged: shipping audio infra for one
   user.

9. **Dodge "a number with no anchor drifts"** → relative scoring only:
   `better`, `same`, `worse` than last session. Fail-mode dodged: scale
   inflation/deflation over months.

10. **Dodge "30 seconds of typing"** → rating is just a reaction emoji
    on the last assistant message. Hook scrapes the transcript file
    for the emoji and submits. Fail-mode dodged: typing latency.

11. **Dodge "I forgot what aspects I'm rating"** → if Lihu opts into
    aspects, show only the *one aspect Claude flagged worst* this turn.
    Single question, contextual. Fail-mode dodged: menu cognition.

12. **Dodge "binary skip becomes habit"** → no skip button. The only
    options are submit-something or close-the-window. Fail-mode dodged:
    the skip key being trained as the rating key.

13. **Dodge "auto-arm-on-wrapup miscategorizes"** → rip out auto-arm
    entirely. Trigger is `Esc Esc Esc` (triple-escape) in chat. Fail-
    mode dodged: false-positive wrap-up phrases.

14. **Dodge "rating breaks resume"** → never rate at session-end.
    Rating happens at session-*start* of the next session: "last
    session was: rate it `+ = -`". Fail-mode dodged: end-of-session
    rush.

15. **Dodge "we capture but never act"** → before asking for the
    rating, show the *previous* rating + what changed since. Fail-mode
    dodged: data-gathering with no feedback loop kills compliance.

16. **Dodge "human and Claude scores look like a contest"** → never
    show Claude's rating to Lihu before he files his. Fail-mode
    dodged: anchoring + contrarianism.

17. **Dodge "free-text note is the friction"** → notes are *optional
    voice-to-text only*, never required. Default note is
    auto-generated from the transcript's last 200 tokens. Fail-mode
    dodged: blank-note panic.

18. **Dodge "every session looks like the last"** → only ask for a
    rating when the session has measurable signal (>3 commits, >20
    turns, or a tikur/zettel landed). Fail-mode dodged: noise from
    20-second "what's the time" sessions.

19. **Dodge "the picker steals Claude's stop"** → rating is filed in a
    separate process spawned from a SessionEnd hook, not from the
    Stop hook. Lihu's terminal doesn't block. Fail-mode dodged:
    confused stop semantics.

20. **Dodge "habit decays in 2 weeks"** → randomize: only ask 1-in-3
    sessions, but always show "you've rated 7 of last 10". Fail-mode
    dodged: every-time fatigue.

21. **Dodge "rating UX is a second app"** → don't build a UX. Pipe
    `dx his rate` to read stdin, and let Lihu paste anything. The
    parser is generous. Fail-mode dodged: maintaining two surfaces.

22. **Dodge "what does 73 mean"** → labels not numbers internally.
    Store `+`/`=`/`-`. If Lihu types a number, accept it; don't ask
    for one. Fail-mode dodged: false precision in the data.

23. **Dodge "the data goes nowhere Lihu sees"** → after submission,
    the response is a *one-line trend* (`5-session avg: ↗ +`).
    Fail-mode dodged: pure data-extraction feels parasitic.

24. **Dodge "asking again next session"** → if Lihu rated within the
    last 30 min, auto-skip. Don't even fire the trigger. Fail-mode
    dodged: re-asking after a quick bounce.

25. **Dodge "aspect prompts feel HR-survey"** → if showing aspects,
    use Lihu's own words from past notes as the labels (`grindy`,
    `clean`, `chasing-tail`), not the system's `friction_*`/`gap_*`.
    Fail-mode dodged: HR-form vibe.

26. **Dodge "the rating comes from a context-loaded Claude"** → the
    rate-process must be a fresh tiny Haiku that only sees the
    last 50 turns of transcript, not the full session. Fail-mode
    dodged: rating reflects Claude's mood, not session reality.

27. **Dodge "Lihu can't undo a misclick"** → every submission is
    soft-deletable for 5 min via `dx his undo`. Fail-mode dodged:
    a fat-finger `-` poisoning the trend.

28. **Dodge "can't rate from the phone / away from chair"** → file
    rating via SMS-style reply to a nightly summary email
    (out-of-band). Fail-mode dodged: needing a terminal at all.

29. **Dodge "the prompt itself becomes mute background"** → rotate
    the prompt copy ("how was that?", "score?", "+ / = / -?"); fixed
    text becomes invisible after week 1. Fail-mode dodged: banner
    blindness.

30. **Dodge "we're solving the wrong question"** → kill `dx his rate
    --as=human` entirely; infer Lihu's vibe from his typing cadence,
    cancel rate, and revert frequency. Fail-mode dodged: building
    UX for a metric we could measure passively.
