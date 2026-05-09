---
name: suggest-with-html
description: Show the live user a proposal — a mockup, a draft, a "here's what I'd do" — as an HTML page served via /serve-static, instead of describing it in chat. Use when the proposal is visual (a UI change, a layout, a redesign, a comparison against the current state) and prose would lose the picture. Triggered by "/suggest-with-html", "suggest with html", "show me what you'd do", "mock up your proposal", or by your own judgment when describing a visual proposal in words would be lossy.
---

# Suggest with HTML

Sibling of `ask-with-html`. Same mechanics, different intent: instead of asking the user to *pick*, you're showing them what *you would do* — for them to react to.

Follow the body of `.claude/skills/ask-with-html/SKILL.md` — same HTML build, same `/serve-static` invocation, same "mimic real pages, not just components" rule when the artifact is about our web app, same optional Bun-server escape hatch for interactivity.

The only differences:

- Render *one* proposal (yours), with the current state next to it as a before/after — not N options.
- Lead the chat handoff with your recommendation in one sentence, then the URL.
- Expect the user to say "yes / no / change X" — not "option B".
