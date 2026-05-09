---
name: ask-with-html
description: Ask the user by building an HTML page and serving it via /serve-static. Use whenever the decision benefits from visual richness. Triggered by "/ask-with-html", "ask me with html", "show me the options", "mock this up so I can pick", or by your own judgment when the AskUserQuestion options would lose information the live user needs to decide.
---

# Ask with HTML

Build an HTML page, serve it via `/serve-static`, hand the live user a URL.

**If the artifact is about our web app** — read the *actual relevant pages* (not just the component library), e.g. `nextjs-app/app/projects/[projectId]/config/scheduled-reports/edit-form-modal.tsx`. Mimic or even quote/copy the real layout, copy, classes, badge variants, spacing. The mock should look like the real screen with the proposed change applied — not a generic shadcn page.

**Use the app's actual palette, not a dark-mode default.** The Effi app is a light theme — read tokens from `nextjs-app/app/globals.css` (`--effi-background #FAFBFD`, `--effi-primary #1560BD`, `--effi-deep-denim #102E4A`, `--effi-gray-text #646A83`, `--effi-border #E2E6F2`, `--effi-card-fill #F3F1EF`, `--effi-accent-orange #F3693E`, `--effi-gold #F2BB41`, `--effi-radius-button 8px`, `--effi-radius-card 12px`). Don't reach for `#0b0d12` / generic dark-mode CSS — when the mock is meant to read as "our app", the palette is half the recognition.

## Fidelity levels — pick before you build

Three levels. Cost rises sharply between them; don't silently pick mid-tier.

| Level | Method | Cost | Looks like |
|---|---|---|---|
| **A — Conceptual** | Hand-coded HTML, Effi palette, shape-correct components | a few minutes | "the right idea" — shapes and copy match, classes/spacing approximate |
| **B — Class-faithful** | Tailwind CDN config matching `globals.css` tokens (oklch + `--effi-*`) + paste real component JSX with its exact classes from `nextjs-app/components/ui/` and the page files | ~5–10 min per surface | ~95% — same buttons, badges, switches, dialogs as the app, no Radix runtime, fonts approximate |
| **C — Real screenshots** | Bring up `just agent-dev`, seed fixtures, navigate via playwright-cli, screenshot before-commit and after-commit | hours (seeding is the slow part — auth, project, report, plus a worktree at the pre-change commit) | 100% — pixel-identical |

**Default to A** for one-off "show me what this would look like" mocks where the user is choosing between options. **Reach for B** when the artifact is meant to read as "our app" — comparisons of shipped work, design proposals you'll sit with, anything you'll show a teammate. **Reserve C** for screenshots that will be reused outside the chat (changelog, customer comms, design review).

**Ask the user when** the artifact is non-trivial (more than one surface, or a surface they care about being recognizable) AND the right tier isn't obvious from the request. Skip the question for quick option-pickers — A is fine.

When you ask, name all three levels with a one-line cost/fidelity tradeoff each (per the table above). Don't bury C; people who want pixel-perfect deserve to know it's an option even though it's expensive.

When you build B, pipeline if the surface count is >3 — serve the page after surface 1 lands, add subsequent surfaces in-place via Edit, let the user review while later surfaces are still in flight. Static `serve.sh` keeps serving the file as you write to it.


## Optional — interactive feedback (Bun server)

When user feedback benefits from UI interactivity, spin a tiny `Bun.serve` POST endpoint instead of just static HTML.

