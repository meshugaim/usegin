---
name: ask-with-html
description: Ask the live user a decision question by building an HTML page (mockups, side-by-side options, rich comparisons) and serving it via /serve-static — instead of the constrained text-only AskUserQuestion picker. Use whenever the decision benefits from visual richness: UI changes, layout choices, copy variants, comparing 2+ designs. Triggered by "/ask-with-html", "ask me with html", "show me the options", "mock this up so I can pick", or by your own judgment when the AskUserQuestion options would lose information the live user needs to decide.
---

# Ask with HTML

Build an HTML page that asks the question, serve it via `/serve-static`, hand the live user a URL.

## Why this exists

`AskUserQuestion` is text-only labels + descriptions. When the decision is visual (UI mockups, layout, copy in context, side-by-side comparisons), text strips the information the user needs. HTML doesn't.

## How

1. Write `/tmp/<topic>/index.html`. Tailwind CDN is fine: `<script src="https://cdn.tailwindcss.com"></script>`. Render every option side-by-side with the *same scenario* so the user compares like-for-like.
2. **If the artifact is about our web app** — read the *actual relevant pages* (not just the component library), e.g. `nextjs-app/app/projects/[projectId]/config/scheduled-reports/edit-form-modal.tsx`. Mimic the real layout, copy, classes, badge variants, spacing. The mock should look like the real screen with the proposed change applied — not a generic shadcn page.
3. Invoke the `serve-static` skill on the directory. Hand the user the URL plus a one-line summary of what they're looking at and your recommendation.
4. Wait for the user's reply in chat. Default return path is conversational.

## Optional — interactive feedback (Bun server)

When click-and-tell-Claude-in-chat is friction (long lists, rank-orderings, multi-field forms), spin a tiny `Bun.serve` POST endpoint instead of static HTML:

- Page POSTs JSON to `/submit`; server writes `/tmp/<topic>/response.json`; page shows "got it, you can close this".
- Claude polls/reads `/tmp/<topic>/response.json` (use Monitor for an event-driven wait).
- Kill the server when done.

Skeleton (~20 lines):

```ts
// /tmp/<topic>/server.ts
const responsePath = "/tmp/<topic>/response.json";
Bun.serve({
  port: 0, // free port
  routes: {
    "/": new Response(await Bun.file("/tmp/<topic>/index.html").bytes(), { headers: { "Content-Type": "text/html" } }),
    "/submit": {
      POST: async (req) => {
        await Bun.write(responsePath, await req.text());
        return new Response("ok");
      },
    },
  },
});
```

Use the static path by default. Reach for the Bun server only when interactivity genuinely beats chat.

## Cleanup

When the decision lands: kill the serve-static port (the script prints the kill command), remove `/tmp/<topic>/`.
