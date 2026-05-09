---
name: ask-with-html
description: Ask the user by building an HTML page and serving it via /serve-static. Use whenever the decision benefits from visual richness. Triggered by "/ask-with-html", "ask me with html", "show me the options", "mock this up so I can pick", or by your own judgment when the AskUserQuestion options would lose information the live user needs to decide.
---

# Ask with HTML

Build an HTML page, serve it via `/serve-static`, hand the live user a URL.

**If the artifact is about our web app** — read the *actual relevant pages* (not just the component library), e.g. `nextjs-app/app/projects/[projectId]/config/scheduled-reports/edit-form-modal.tsx`. Mimic or even quote/copy the real layout, copy, classes, badge variants, spacing. The mock should look like the real screen with the proposed change applied — not a generic shadcn page.


## Optional — interactive feedback (Bun server)

When user feedback benefits from UI interactivity, spin a tiny `Bun.serve` POST endpoint instead of just static HTML.

