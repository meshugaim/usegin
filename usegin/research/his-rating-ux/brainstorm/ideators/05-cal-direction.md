# 05 — Cal — Direction

Persona: direction-priming ideator. North-star asks: in 6 months, what does
this UX *feel* like when it's mature? Not "the form is fast" — "there's
barely a form." Pointing at the destination, then back-casting intermediate
shapes that already gesture toward it.

Underlying axis: **rating-as-a-thing** vs. **rating-as-a-byproduct**.
Most ideas below pull toward the byproduct end — the destination is a UX
where Lihu never *files* a rating; the system reads vibe from signals he's
already emitting and asks for confirmation only when uncertain.

---

1. **Ambient vibe — never asked, always inferred.** System derives 80% of the rating from signals (tone, edits, retries, friction) and only confirms when confidence < threshold.
2. **One-glyph confirmation.** Statusline shows `vibe: 72? [y/n]` between turns; tap once or ignore. Silence = accept inference.
3. **Vibe-as-cursor-color.** The chat cursor / prompt prefix tints by inferred vibe; Lihu nudges it (`!up`, `!down`) when wrong. Rating *is* the nudge stream.
4. **No rate moment — rolling vibe.** No "end of session" — there's a continuous live number that drifts; Lihu pokes it when it's wrong. Sessions sample, never close.
5. **Voice-first, sub-second.** Wispr Flow → "felt good, ttm sucked" → parsed into aspect ratings. Same pipe Lihu already uses for chat; zero new surface.
6. **Mood-emoji suffix.** Append `:)`, `:|`, `:(` to any chat message to file a vibe inline. Ratings ride on existing turns; no separate moment.
7. **Inferred rating with redline.** Claude proposes the rating in its final message ("I'd score this 64 — friction high on env, gap low"); Lihu redlines or accepts in one keystroke.
8. **Team feed instead of file-it.** A shared ambient feed shows everyone's session vibes scrolling by; Lihu rates because he sees Oria's, Nitsan's — social, not procedural.
9. **Trend lines that surface themselves.** Statusline shows 7-day vibe sparkline; the *visibility of the trend* is the incentive to keep it honest.
10. **Auto-aspects from the diff.** System reads the session's diff/test/commit signals and pre-fills aspect ratings; Lihu reviews not enters.
11. **One-question default, drill-down on demand.** Default rating is single number; aspects appear only if Lihu hovers/expands. Aspects are progressive disclosure.
12. **Rating-by-comparison.** Show two recent sessions: "this one vs. yesterday's — better, same, worse?" Comparison is faster than absolute scoring.
13. **Frictionless because it lives in the next prompt.** Lihu's first message of the next session opens with a prefilled vibe-block from the previous; edit-or-accept. The trigger is *starting again*, not *ending*.
14. **Wearable / phone tap.** A physical "rate" button (Stream Deck, phone widget, Apple Watch complication). Pure muscle, decoupled from the chat surface.
15. **Inverse rating — file friction, not score.** Lihu only ever says "this sucked because X"; happy sessions auto-rate themselves. Rating is the complaint channel.
16. **Slack DM from a vibe-bot.** End of day, a bot DMs the day's session list with one-click reactions per row. Asynchronous; no in-session moment at all.
17. **The rating is the commit message.** Vibe-tag goes into the auto-commit footer that already lands every session; reuse a stream Lihu already trusts.
18. **Heat-map calendar.** Long-term destination is a Github-contrib-style heatmap of vibe; the daily rating exists to *colour a square*, which is intrinsically satisfying.
19. **Convergence prompt only.** System only asks Lihu to rate when his self-rating and Claude's self-rating diverge significantly — most sessions never prompt.
20. **Eye-tracker / dwell-time inferred.** In a real terminal, dwell time on the final assistant message is itself signal. No surface at all.
21. **Multi-modal blend — voice + emoji + slider.** Statusline-bar slider (mouse drag) for general; voice add-on for note. Pick whichever modality is to-hand.
22. **Rating as a side-effect of `/end`-narration.** Lihu narrates the session in 1 sentence ("good but slow on env setup"); LLM extracts ratings from prose.
23. **Adversarial rater.** Claude proposes a *deliberately wrong* rating ("I'd say 90 — perfect session"); Lihu corrects out of disagreement. Provocation is faster than open-ended elicitation.
24. **Per-aspect pop-up only when an aspect changes.** Most aspects don't move turn-to-turn; only show the one or two that just shifted ("friction_env spiked — confirm?").
25. **Destination: Lihu never rates; the team does.** In 6 months, ratings come from the *team's* cross-observation feed (Oria sees Lihu's session traces and rates them). Self-rating is replaced by peer-rating, which is more honest.

---

## North-star statement

The mature UX is *not* a form Lihu fills. It's a continuous ambient signal
the system mostly infers; Lihu's role is to **correct** the inference, not
to **produce** the data. The intermediate steps (1–7, 13, 17) all preserve
this destination: every shape lets the system carry more of the load over
time.

The critic-side worry: if we anchor on "5-second form," we'll iterate
faster forms forever and never cross the gap to inference. Build the dumb
inference loop *now*, even if it's wrong 50% of the time, because that
is the surface every later improvement compounds on.
