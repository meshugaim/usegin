---
name: ona-url
description: Build a vscode.gitpod.io URL for any path in the current Ona environment, so the human can open it in their browser — directly in the Ona VS Code-web UI. The opened tab is read-write — drag a file from the desktop into it and the file lands on this filesystem (drop-zone pattern). Use whenever you want the human to (a) drop a file from their machine for you to read (image, PDF, log, anything), (b) open a generated file in the editor, or (c) browse a directory you produced. Triggered by "give me a drop-zone", "I want to share a file with you", "open this in VS Code-web", "show me this path", "let me upload an image", or "/ona-url". Cheap alternative to serve-static when you don't need a custom HTTP server — Ona's own VS Code-web already handles uploads, edits, and directory listing for free. Do NOT use for: rendering HTML/dashboards in a browser (that needs an HTTP server — use serve-static), exposing a dev server (those have their own port flows), or anywhere outside an Ona/Gitpod env (the URL only works there).
---

# ona-url

Print a `https://vscode.gitpod.io/environment/<env-id><abs-path>` URL for any path in the current Ona env. Opening it in the human's browser pops the VS Code-web UI scoped to that path.

This is the cheap cousin of `serve-static`: that skill stands up an HTTP server and exposes a port; this skill borrows Ona's *built-in* VS Code-web, which already does file viewing, editing, directory listing, and drag-and-drop uploads. When you just need the human to look at a path or drop a file in, this is the right tool.

## The drop-zone pattern

Most common use: the human wants to share an image (or any file) with the agent but the agent is in a cloud env with no access to the human's local files. Two recipes — pick by whether you want to wait for the drop.

### Ask-when-done (simple)

1. `ona-url -p $CLAUDE_JOB_DIR/uploads` → prints a URL.
2. Hand the URL to the human.
3. Human opens it (VS Code-web tab scoped to `$CLAUDE_JOB_DIR/uploads/`).
4. Human drags the file from their desktop onto the file tree.
5. Human pings you ("done" / filename); you `Read $CLAUDE_JOB_DIR/uploads/<filename>`.

The `-p` flag mkdirs the dir first so step 1 doesn't fail on a fresh job.

### Auto-notify on drop (recommended for screenshots)

Use `-w` and wrap with the **Monitor** tool — you get notified the moment the human drops a file, no "done" ping needed.

1. Run `ona-url -w $CLAUDE_JOB_DIR/uploads` via the Monitor tool.
2. First notification = the URL. Post it to the human.
3. Subsequent notifications = filenames (one per drop). `Read` each, then stop the Monitor task.

`-w` implies `-p`. The watcher fires on `close_write` and `moved_to`, which covers desktop-drag uploads and atomic-move writes from VS Code-web's drop handler.

## Usage

```bash
ona-url [path]        # print URL for path (defaults to $PWD)
ona-url -p [path]     # mkdir -p path first (drop-zone use case)
ona-url -w [path]     # print URL, then watch dir; one stdout line per
                      # new file. Implies -p. Wrap with Monitor.
ona-url -h            # help
```

Output is a single URL on stdout (plus filenames after that in `-w` mode). Resolved to an absolute path under the hood.

## Examples

```bash
# Drop-zone in this job's scratch dir
ona-url -p "$CLAUDE_JOB_DIR/uploads"
# → https://vscode.gitpod.io/environment/<id>/home/vscode/.claude/jobs/<job>/uploads

# Same drop-zone, with auto-notify on drop (wrap in Monitor)
ona-url -w "$CLAUDE_JOB_DIR/uploads"
# stdout line 1: URL    ← post to human
# stdout line 2+: filenames as they land  ← Read and act

# Open a generated file in the editor
ona-url docs/scheduled-reports/email-buttons.review.html

# Browse a directory you produced
ona-url -p /tmp/my-export
```

## How env-id resolution works

The env-id (the long UUID in the URL) is NOT in any env var — checked exhaustively in 2026-05. The CLI calls `ona environment list --running-only --field id` (~500ms) and caches the result in `/tmp/ona-url-env-id` for the container's lifetime. If you have multiple running envs, it takes the first; in practice we only run one per devcontainer.

## When NOT to use

- **HTML pages / dashboards / served apps** — VS Code-web shows source, not rendered output. Use `serve-static` instead.
- **Outside Ona/Gitpod** — the URL pattern doesn't work elsewhere. The CLI errors out if `ona` is missing.
- **Stateful watchers / triggered actions** — `-w` is for "tell me when a file lands". If you need a server that watches and re-renders/processes on change, build one.

## Cross-references

- `serve-static` — HTTP-server cousin for rendered HTML and dashboards.
- `team-drive` / `team-gmail` — when the file already lives in a team system, prefer fetching it directly there.
