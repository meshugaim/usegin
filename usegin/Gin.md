# Gin.md

In Gin, we vibe like Anthropic. Everything is allowed here.

This whole tree (`usegin/`, formerly `gin/` — z033) is the permissive zone. Production code lives elsewhere. Here we explore, prototype, half-build, change our minds, leave open-to-empty addresses (z003), accumulate as we go, and let clusters emerge (z040). Disagree freely. Try the weird thing. Distill later (z039).

The constraint of production — correctness, deploy-readiness, backwards compatibility — does not apply inside `usegin/`. The constraint of taste does: be laconic (z032), don't ship slop, leave artifacts a future Gin would actually want to read.

If you find yourself asking "am I allowed to put this here?" — yes (z037). If you find yourself asking "is this the right place?" — make it the right place (z037 again). If something is uncomfortable, fix the comfort.

What stays out of `usegin/`:
- Production code (`nextjs-app/`, `python-services/`).
- Things that affect customers, deploys, billing, or other people's environments.
- Secrets.

Everything else: green light.
