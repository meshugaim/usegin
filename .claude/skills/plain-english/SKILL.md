---
name: plain-english
description: Re-explain the current topic without dev/AI/security jargon — concrete analogies, services named in plain words, tradeoffs surfaced visibly. Manual trigger via `/plain-english`, "explain plainly", "without the jargon", "summarize for me"; also reach for it on your own when you sense the user has hit a wall of technical terms.
---

# Plain English

The conversation got too technical. Re-state. Don't append "in other words" — start fresh.

## Shape

1. **"What's actually happening"** — lead with the situation in user terms. Concrete actors (services, scripts, users), concrete actions. One short analogy if it helps; don't mix.
2. **"The N options, plainly"** — number them. State the **tradeoff inside the option**, not buried after. Each option 2–4 sentences max.
3. **"My read"** — short recommendation with reasoning. Optional.
4. **End with the actual question.** No closing coda.

## Translation rules

**Substitute, don't define.**

| Jargon | Plain |
|---|---|
| Cloudflare-frontdoor 5xx APIError | a brief Cloudflare hiccup between us and the database |
| Background-loop entrypoint | a script that runs continuously checking for stuff to do |
| Capture to Sentry | report to our error tracker, which emails you |
| RLS / RLS policy | "who's allowed to see this row" rule |
| Worker tick | one round of the script's loop |
| Schema migration | a change to the database's shape |

**Name services in plain words on first mention.**

- Supabase → "our database service (Supabase)"
- Sentry → "our error tracker (Sentry)"
- Cloudflare → "Cloudflare, the routing layer in front of our database"
- Railway → "Railway, where our backend runs"

**Drop unless load-bearing for the question:** transport, endpoint, monkeypatch, mock, fixture, hook, shim, wrapper, RPC, JWT, OAuth, CDN, DNS, blast radius, load-bearing, in-flight, non-blocking, PostgREST, APIError, schema, migration.

## When to skip

- Jargon the user introduced themselves — they're talking in those terms on purpose.
- Precision contexts (code review, security audit, legal/contract). Flag and ask before flattening.

## Anti-patterns

- **Appending instead of re-stating.** "In other words, …" is a sign you didn't actually re-shape; you just paraphrased one sentence.
- **Defining instead of substituting.** "PostgREST (the REST layer over PostgreSQL) raised an APIError" is just jargon with footnotes. Substitute the whole phrase.
- **Burying the tradeoff.** If Option B has a real downside, name it in the *option*, not a paragraph below.
- **Mixed metaphors.** Don't go "internet weather" → "the door is locked" → "the janitor walks past" all in one explanation.
- **Closing coda.** Don't end with "Let me know if you have questions" / "Hope that helps". End with the actual decision the user has to make.
