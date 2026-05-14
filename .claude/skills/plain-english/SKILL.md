---
name: plain-english
description: Re-state the previous message in plain English — same content, stripped of dev/AI/security jargon, reordered for fast reading. Use this when the user wants the prior turn said again, plainer; trigger phrases include `/plain-english`, "say that again plainly", "without the jargon", "I didn't follow that". The goal is faster-to-read, not shorter — preserve every thread the original raised.
---

# Plain English

This is a re-statement skill. The previous message had too much jargon and the user wants to read it again, faster. Re-state it. Don't append "in other words" — start fresh, as if the original hadn't been sent.

## Preserve the function

The original turn was doing something — reporting status, explaining a finding, presenting a decision, walking through a problem. Re-state it in the *same function*, just plainer. A three-thread status update re-states as a three-thread status update, not a one-line summary. Speed-to-read comes from clarity, not from dropping content.

## Shape

Lead with these three, in this order, only the ones the original message actually contained:

1. **What happened** — concrete actors (which service, which script, which person), concrete actions. One short analogy if it helps; don't mix metaphors.
2. **Where we stand now** — the current state in user terms. What's working, what's not, what's been tried.
3. **What's pending** — open threads, decisions waiting on the user, things you're about to do next. Name each one as its own item, not a buried clause.

If the original was a pure explanation with no pending action, stop after #2. Don't manufacture a decision.

## Translation rules

**Substitute, don't define.** "PostgREST (the REST layer over PostgreSQL) raised an APIError" is jargon with footnotes. Replace the whole phrase with what actually happened: "our database's API layer returned an error."

| Jargon | Plain |
|---|---|
| Cloudflare-frontdoor 5xx APIError | a brief Cloudflare hiccup between us and the database |
| Background-loop entrypoint | a script that runs continuously checking for stuff to do |
| Capture to Sentry | report to our error tracker, which emails you |
| RLS / RLS policy | "who's allowed to see this row" rule |
| Worker tick | one round of the script's loop |
| Schema migration | a change to the database's shape |
| Endpoint / route | the URL the frontend calls |
| Transport | how one piece talks to another |
| Mock / fixture | a fake stand-in used during tests |
| In-flight | currently running |
| Blast radius | how much breaks if this goes wrong |
| Load-bearing | the thing other things depend on |

**Name services in plain words on first mention** — then you can use the short name after.

- Supabase → "our database service (Supabase)"
- Sentry → "our error tracker (Sentry)"
- Cloudflare → "Cloudflare, the routing layer in front of our database"
- Railway → "Railway, where our backend runs"
- Doppler → "Doppler, where our secrets are stored"
- Linear → "Linear, our issue tracker"

**Drop these unless the word is genuinely doing work the question depends on:** transport, endpoint, monkeypatch, mock, fixture, hook, shim, wrapper, RPC, JWT, OAuth, CDN, DNS, blast radius, load-bearing, in-flight, non-blocking, PostgREST, APIError, schema, migration, payload, stream, substrate, pipeline, envelope, primitive, upgrade path, wire-probe.

If you find yourself reaching for one of these, ask whether the user would understand the sentence without it. Usually yes — drop it.

## When to skip

- Jargon the user introduced themselves — they're using those terms on purpose, match their register.
- Precision contexts (code review, security audit, legal/contract text). Flag this and ask before flattening — losing precision there can lose meaning.

## Anti-patterns

- **Appending instead of re-stating.** "In other words, …" or "to put it plainly, …" means you paraphrased one sentence instead of re-shaping the whole message. Start fresh.
- **Defining instead of substituting.** "X (which is Y) did Z" is jargon with a footnote attached. Replace X with Y entirely.
- **Compressing past the function.** If the original raised three open threads, the plain version still has three threads. Don't lose content for speed — the goal is *faster to read at the same fidelity*, not shorter.
- **Mixed metaphors.** Don't go "internet weather" → "the door is locked" → "the janitor walks past" inside one explanation. Pick one register and stay there.
- **Closing coda.** Don't end with "Let me know if you have questions" or "Hope that helps". End with the actual pending thread or the last fact — whatever the original was actually saying.
