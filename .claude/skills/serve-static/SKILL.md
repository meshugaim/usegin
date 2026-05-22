---
name: serve-static
description: Serve a local file or directory over HTTP on a free port and hand the user a URL they can open in their browser. The skill detects the host environment (Gitpod/Ona, GitHub Codespaces, or a plain local / devcontainer) and does the right exposure dance for each — Gitpod CLI for Gitpod, `gh codespace ports visibility` for Codespaces, plain localhost for local. Use this skill whenever the user needs to view something generated locally (an HTML report, a rendered preview, a static site build, an eval viewer, a dashboard) in their actual browser — not the terminal. Trigger on phrases like "open this in the browser", "serve this html", "preview this", "share this link with me", "expose this port", "give me a URL to open", "make this public", "how do I view this", or any time we've generated a local HTML file and want the human to see it. Do NOT use for: serving dev servers that already have their own tooling (next dev / vite / etc.), hosting long-lived services, anything that needs a real deployment.
---

# Serve static

Serve a local file or directory over HTTP on a free port, hand the user back one URL.

This skill exists because exposing a port to the user's browser means something different in every environment we run in: Gitpod/Ona needs `gitpod environment port open`, GitHub Codespaces needs `gh codespace ports visibility`, a plain local dev container just needs `http://localhost:<port>`. The script auto-detects and does the right thing.

## Host detection (auto)

The script inspects env vars and available CLIs, in order:

1. **Gitpod / Ona** — `$GITPOD_API_URL` or `$GITPOD_WORKSPACE_ID` set AND the `gitpod` CLI on PATH → open with `gitpod environment port open`.
2. **GitHub Codespaces** — `$CODESPACES=true` AND `$CODESPACE_NAME` set → set visibility with `gh codespace ports visibility <port>:<vis> -c $CODESPACE_NAME` and construct the forwarded URL `https://${CODESPACE_NAME}-${port}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}`.
3. **Local / devcontainer / anything else** — just prints `http://localhost:<port>`. VS Code / Cursor attached via remote dev will typically auto-forward the port; plain local just works.

Override detection with `--host gitpod|codespaces|local` if it guesses wrong.

**Plain remote box (e.g. a Hetzner server over SSH):** there's no auto-forward, so the printed `localhost:<port>` won't open in the user's browser. If `cloudflared` is on PATH, expose the running server with a quick tunnel — `cloudflared tunnel --url http://localhost:<port>` — which prints a public `https://<random>.trycloudflare.com` URL (no account needed); append the filename. It's a public (random, unlisted) URL, so keep sensitive content off it and kill the tunnel when done.

## Usage

```
.claude/skills/serve-static/scripts/serve.sh <path> [--name <label>] [--admission creator_only|organization|everyone]
```

- `<path>` — a file or a directory. If it's a file, the script serves its parent directory and the printed URL points directly at the file.
- `--name` — label shown in the Gitpod ports UI (default: `serve-static`).
- `--admission` — who can open the URL. Default `creator_only` (just the environment owner). Use `organization` for teammates, `everyone` only when you genuinely mean a public link (and there's nothing sensitive behind it).

The script prints the full URL on stdout. Everything else (PID, stop command) goes to stderr.

## How to use in conversation

Pattern:

1. Generate whatever the user needs to view (HTML report, rendered markdown, dashboard, etc.).
2. Run `serve.sh <path>`.
3. Paste the returned URL back to the user, one line, clear.

Example:

```
User: "show me the eval results"
You: [generate review.html]
     [run serve.sh /workspaces/.../review.html]
     "Open: https://<port>--<env-id>.<region>.gitpod.dev/review.html"
```

## Defaults and judgment calls

**Default admission is `creator_only`.** That's safer — even for something innocuous, leaking an unintended preview URL is a surprise we want to avoid. Upgrade to `organization` or `everyone` only when:

- The user explicitly asks for a shareable link ("send this to the team", "make it public").
- The content is genuinely not sensitive (a rendered public doc, an open-source demo).

**Port is picked fresh every call.** No state between calls. If the server survives across turns and you need to kill it, the stderr line tells you how.

**Don't leave servers running indefinitely.** If the user is done, stop the server (`kill $(cat /tmp/serve-static-<port>.pid) && gitpod environment port close <port>`). The stderr line from the script has the exact command with the right port filled in.

## When NOT to use

- **Real app dev servers** (`just dev`, `next dev`, `vite`, etc.) — these have their own port conventions and you should use those flows.
- **Things that need auth or APIs.** This is a dumb static file server; it serves whatever's in the directory to whoever opens the link (within the admission level). For anything involving secrets in the content, keep `--admission creator_only` and delete the files when done.
- **Quick terminal previews.** If the output is text and small, just paste it in chat.

## Troubleshooting

- **Port already in use** — the script picks a fresh free port each time, so this shouldn't happen. If it does, another process may have bound it between `getsockname` and `http.server` startup. Just re-run.
- **URL returns 502/404** — give the server ~0.5s after the script exits; the initial request sometimes races. Reload once.
- **User can't open the URL even with `creator_only`** — they need to be signed in to Gitpod in the same browser they're opening the URL from. The URL itself is gated on Gitpod auth, not on the port server.
