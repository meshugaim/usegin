# Ideator 01 — Poll (creative)

## Priming (one sentence)
Reframe rating as ambient/passive emission, not a discrete typed-in moment — what if Lihu never "rates" at all and the system just listens?

## Ideas

- **Single-keystroke aspect-less rating**: One number 0..9 typed anywhere in chat (e.g. as a `!7` interjection); auto-stamped as `general` for current session. Why: 5s ceiling collapses to <1s; nothing else asked.
- **Emoji-only rating**: Lihu drops one emoji ("🔥", "😐", "💩") in chat; a hook maps it to a 0..100 bucket. Why: emoji is the natural ambient vocabulary; zero context-switch.
- **Rate-by-reaction-on-last-message**: Hook reads a single-char follow-up ("+", "-", "=") to Claude's last reply as a per-turn vibe. Why: piggybacks on natural reaction reflex; aspect inferred from message content.
- **Statusline as the rating UI**: Statusline shows `[rate ←0..9 →]`; a key-listener hook on stdin captures one digit, no command typed. Why: surface Lihu already sees; never leaves chat.
- **Wispr-Flow-spoken rating**: Lihu says "vibe sixty, focus eighty" mid-dictation; a Wispr post-processor extracts and files. Why: matches Lihu's existing voice-input flow; rating is ambient speech.
- **Sentiment-mining the transcript**: A post-session hook runs the chat through an LLM that estimates Lihu's vibe per aspect from his actual messages. Why: zero-keystroke; the rating is a *measurement*, not a self-report.
- **Curse-counter**: Count expletives, "wtf", "ugh", caps-lock bursts in Lihu's messages → friction score. Why: the data already exists in transcript; behavioral telemetry > self-report.
- **Time-between-messages histogram**: Long pauses + short follow-ups = friction; rapid-fire = flow. Auto-derive vibe from cadence. Why: zero-asking; honest; calibrates against itself over weeks.
- **Two-button physical UI**: A USB foot-pedal or Stream-Deck key bound to "thumbs up/down this turn"; submissions accumulate. Why: removes typing entirely; Lihu's hands stay on the work.
- **Rating IS the wrapup phrase**: "wrap it up 7" or "we're done, vibe 60" — the number in the wrapup phrase IS the rating. Why: piggybacks on a phrase Lihu already says.
- **Rating-by-omission**: If Lihu types nothing rating-shaped after wrapup, default to neutral 50; the *act of saying nothing* becomes the data. Why: removes the chore entirely; explicit ratings only when Lihu cares to push back.
- **Diff-as-rating**: At session end, show last session's auto-derived rating; Lihu only types if he disagrees. Inline-edit, not blank-form. Why: editing is faster than authoring; defaults do the work.
- **Background daemon polls the desktop**: Reads window focus, typing speed, Slack emoji status; estimates session vibe from environment. Why: zero-touch; rating becomes telemetry, not a task.
- **Rate-the-commit**: A post-commit hook prompts a single digit per commit; aggregate to session. Why: distributes the rating across natural punctuation points instead of one big end-of-session ask.
- **The git commit message IS the rating**: A trailer like `Vibe: 70` in commit messages gets parsed; Lihu writes it where he's already typing. Why: collapses two artifacts into one keystroke moment.
- **Tamagotchi pet**: A small ASCII creature in statusline whose mood reflects accumulated vibe; petting it (any keystroke matching pattern) records "good session". Why: gamified ambient feedback; emotional surface, not a form.
- **Rate-by-not-rating**: If Lihu closes Claude with `Ctrl+D` it's a 50; with `/end` and a number it's that number; with rage-quit (SIGKILL detected) it's a 10. Why: the *manner* of exit is the signal.
- **One-line haiku rating**: Lihu writes a short free-form sentence; an LLM extracts numeric aspects from it. Why: humans express vibe in prose better than numbers; let the machine do the structuring.
- **Rating-by-meme**: Pre-bound aliases like `/fire`, `/meh`, `/dumpsterfire`, `/chefkiss` each file a preset rating bundle. Why: vocabulary matches actual emotional vocabulary; one keystroke per mood.
- **Whisper-to-Claude**: Lihu speaks the rating to Claude in passing ("by the way that was tedious"); Claude files it on his behalf without asking back. Why: Claude is already listening; rating is conversational not formal.
- **Color-the-prompt**: The chat prompt color shifts hue based on accumulated vibe; clicking/touching it (somehow) records a pulse. Why: ambient visual; reading the color is the rating.
- **Session post-mortem auto-draft**: At end, Claude posts a one-paragraph "here's how I think it went, score X" message in chat; Lihu either thumbs-up (accept) or replies one number (override). Why: turn rating into a one-key acknowledgment.
- **Calendar-coupled rating**: Rate the *day* not the session; one daily 0..9 covers all sessions. Why: lower-cadence ask; session granularity may be over-precision.
- **Photo-of-face**: Webcam snapshot at session end → emotion-classifier → vibe score. Why: face is the ground truth; everything else is a proxy.
- **Heart-rate from watch**: If Lihu wears a watch, pull HRV during session → stress score → friction aspect. Why: physiological data > self-report; honest baseline.
- **The rating is the next session's first message**: When Lihu opens Claude next time, first prompt is "before we start, how was last time? <digit>". Why: shifts the moment to when the chore is cheap (already typing); coupled to commitment-to-start.
- **Rate-by-walking-away**: Idle timeout > N minutes after a wrap phrase = "fine, default 50, recorded, move on". Why: the inactivity IS the consent.
- **Rating-via-Linear-issue**: A daily Linear issue auto-created; Lihu drops emoji reactions throughout the day. Reactions = ratings. Why: Linear is already in his face; reaction UI is sub-second.
- **Public dashboard guilt-trip**: A statusline counter showing "X sessions un-rated"; pure social pressure, no UI to fix it except actually rating. Why: behavioral nudge; tests whether the friction is the form or the apathy.
- **Bypass the question, infer everything**: Ship zero rating UI; auto-derive every aspect from transcript+commits+git+sentry. The "rating" becomes a read-only report Lihu reviews weekly. Why: maybe self-report isn't worth the friction at all — let the substrate measure itself.
