# 03 — Johan (provocation-priming ideator)

Voice: provocation, inversions, "what if we did the opposite". The bigger,
weirder, more uncomfortable the framing — the better the calibration data.
No filtering, no ranking.

## Ideas

1. **No human rating at all.** Claude rates Lihu's vibe from the transcript;
   Lihu only sees + accepts/edits. Default-accept = 1 keystroke or 0.
2. **Inverted Stop hook.** Claude refuses to start the *next* session until
   the previous one is rated. The pain lands at value-time, not at end-time.
3. **$1 unrated-session tax.** Pipe to a real charity (or beer fund). Skin in
   the game. Skip count visible in statusline.
4. **Rating IS the goodbye.** No "/end" — typing the rating closes the
   session. The artifact becomes the exit door.
5. **One emoji, one digit.** `/r 8🔥` and done. Sub-2-second target. Anything
   richer is a power-user mode nobody opens.
6. **No rating UI ever — passive sentiment parse.** Store the chat raw,
   Claude reads it later (in batch, free of session pressure) and emits a
   reading. Lihu's job: type freely. The rating is a *side effect of work*.
7. **Statusline is the form.** Statusline shows `[rate: 1-9 _]` — Lihu
   tabs once, hits a digit, statusline turns green. No new surface.
8. **Public rating wall.** Every session's rating posts to a team channel
   with the title. Social pressure replaces nag pressure.
9. **Anonymous wall, with Gin's counter-rating beside it.** Every session
   shows two numbers, no names. Lihu sees only the gap between his and
   Claude's takes — and gaps become the artifact.
10. **Rate the session by walking away.** Idle-timer triggers an auto-poll:
    if Lihu doesn't rate in 60s, Claude's reading is auto-filed AS Lihu's.
    Opt-out by rating.
11. **Rate by *not* rating.** No-rating = "default vibe" (the rolling
    median). The rating exists; doing nothing emits it.
12. **One question, picked dynamically.** Claude inspects the session and
    asks the *one* aspect most likely to differ from baseline. "Friction was
    higher than usual — 1-9?" Single question, single keystroke.
13. **Voice rating via Wispr.** Lihu mumbles "good one, friction on the
    rebase though" and a parser emits the multi-aspect rating. Speech is
    already the lowest-friction surface in his stack.
14. **Gamble it.** Claude guesses Lihu's rating; Lihu confirms or
    counter-bids. If Claude is within 1, it wins a "trusted" token. The
    rating becomes a betting game — fast because it's fun.
15. **No rating — a single thumbs.** 👍/👎/🤷, that's the whole product.
    Aspects die. Richness comes from frequency, not depth.
16. **Charge for *high* ratings.** Free to log a 1, costs $1 to log a 9.
    Inverts the spam-vs-truth economics: nobody flatters themselves.
17. **Rate the previous session, not this one.** End-of-session is the
    worst time (tired, biased by recency). At session *start*, Lihu rates
    yesterday's. He's fresh; the session's already cold; no nag at exit.
18. **Hook hijack — rate via prompt prefix.** Type `8! help me with X` and
    the `8!` prefix files a rating-of-previous-turn before the prompt runs.
    Zero new turns spent on rating.
19. **Bidirectional rating, contractually.** Claude can't proceed unless
    *both* faces rated the previous turn. Symmetric block. Conversation
    becomes a ratings-gated walkie-talkie.
20. **Rate by deleting.** Lihu deletes/edits Claude's previous message →
    inferred low rating. Lihu reacts with a 👍 emoji → high. Existing
    interactions become the rating signal; no rating UI exists.
21. **Make rating profitable.** Each rating contributes to a personal
    weekly retro Claude generates only for raters. The retro is the carrot;
    no rating, no retro.
22. **Mandatory reverse-Turing.** Claude posts its own self-rating first
    and asks Lihu only "agree? y/n". Disagreement opens the picker; agreement
    is one keystroke.
23. **Rating window during the work.** Mid-session, after every long
    Claude turn, statusline flashes a 1-9 picker for 3 seconds. Miss it →
    no rating, no nag. Capture the vibe at the moment, not at the end.
24. **Outsource it.** Ship the transcript to a $0.10 Mechanical-Turk-style
    micro-rater (or another Gin instance). Lihu never rates. Cost per
    session is rounding error vs his time.
25. **Negative-space rating.** Lihu only files when something is
    *exceptional* (very bad or very good). Default = mid. Eliminates the
    boring-but-fine 80% that makes rating feel like a chore.
26. **Rating is the commit message.** End the session with `git commit`;
    the commit-msg hook parses sentiment + extracts a rating. Work artifact
    and rating artifact collapse into one keystroke.
27. **Rate by re-prompting.** If Lihu starts the next prompt with "again"
    or "redo" or "no" — auto-rate the previous turn low. If he starts with
    "great, now…" — auto-rate high. NLP from his own next prompt.
28. **Public Slack bet.** Each morning, Claude predicts the day's average
    rating; the team sees the prediction. End-of-day, Lihu's actual ratings
    settle the bet. Social accountability without intrusion.
29. **Rating-free zone, with surprise audits.** 1-in-10 sessions, a rating
    is mandatory and blocking. The other 9, nothing. Sampling, not census —
    statistically richer than a 30%-completed census.
30. **No "rating" — a single sliding "session temperature".** Lihu drags a
    horizontal slider in statusline (or types a number 1-100). One number,
    no aspects, no questions, no taxonomy. Aspects derived later by Claude
    parsing the transcript against the temperature.
