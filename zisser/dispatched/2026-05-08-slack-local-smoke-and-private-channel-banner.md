---
date: 2026-05-08
charter_for: Wes (general-purpose worker, dev-side)
caller: Zisser/FAB (session fab49aef, commanding Slack track)
status: in-flight
parent_session_id: fab49aef-2e6c-44af-9fd0-ec1ac5a66757
expected_duration: <2h
started_at: 2026-05-08T10:40:00Z
sector:
  paths_in:
    - nextjs-app/app/api/slack/**
    - nextjs-app/app/projects/[projectId]/config/slack-channel-picker-modal.tsx
    - nextjs-app/lib/services/slack/**
  paths_out:
    - nextjs-app/app/projects/[projectId]/config/slack-channel-picker-*
  external_systems: []                         # no Slack writes; reads only
  mutable_state:
    git_worktree: /workspaces/test-mvp         # main worktree
    dev_server_ports: [63000]                  # just agent-dev
neighbors:
  - 6dc82209 (Doppler agent — owns Doppler dashboard; do NOT touch effi/* or Doppler CLI writes)
  - 00fa670a (HandsOnAi-Copilot — unrelated; no overlap)
---

# Charter — Slack: local OAuth smoke + private-channel `/invite` banner

## Purpose

Two non-bypass moves on the Slack track that don't touch Doppler/Railway:

1. **Smoke**: confirm the OAuth round-trip works end-to-end against the
   `Slack integration for Effi` app (the dev creds already in `effi/dev`),
   so we have a known-good baseline before staging/prod secrets land.
2. **Banner**: in the channel-picker modal, when a customer selects a
   *private* Slack channel, show a banner: "Private channels need a
   one-time `/invite @effi` from someone in the channel — type that in
   Slack now." Without this, private-channel ingestion silently fails
   forever (synthesis flagged this).

## End state

Two commits on `main` (one per task), each pushed.

### Task 1 — Smoke (verification, no production-code commit)

- Start `just agent-dev` (port 63000). Confirm via `just agent-dev-status`.
- Use `playwright-cli` (interactive browser via `manual-testing-by-agent`
  skill) to:
  1. Sign in as a test user.
  2. Navigate to `/toggles`. Flip `slackIntegration` ON for this browser.
  3. Navigate to a project's Integrations tab.
  4. Click "Connect Slack" — verify redirect to Slack OAuth (not 500).
  5. If OAuth completes (workspace consent), confirm callback returns
     to project config page and the workspace install row exists in DB
     (`SELECT * FROM slack_installs LIMIT 5`).
  6. Open the channel-picker modal. Verify it lists channels.
  7. Bind one *public* test channel. Confirm `slack_channel_bindings`
     row.
  8. Post a test message in that Slack channel. Confirm a `data_items`
     row appears within ~10s.
- **No code change for this task.** Output: a brief findings block in
  this charter file (append, before the dispatched-status frontmatter
  flips to `returned`). If anything is broken, that's a finding —
  surface to FAB; do NOT silently work around.

### Task 2 — Private-channel `/invite` banner

- In `nextjs-app/app/projects/[projectId]/config/slack-channel-picker-modal.tsx`
  (and `slack-channel-picker-body.tsx` if separate), add a banner that
  appears WHEN the user selects (or hovers/focuses, your call — pick the
  least-invasive UX) a channel marked `is_private`.
- Banner text (verbatim): *"Private channels need a one-time `/invite
  @effi` from someone already in the channel — type that in Slack now."*
- The banner must be visible BEFORE the user clicks "Bind". It's
  pre-action friction, not post-action error.
- Use existing UI primitives (the codebase has `<Alert>` or shadcn
  `<Callout>`-equivalent — match prior style; do not import new
  dependencies).
- Add a unit test that asserts the banner renders for a private channel
  and does NOT render for a public one. Place per `nextjs-app/CLAUDE.md`
  conventions.
- Run `bun lint && bun test path/to/affected/file.test.tsx` before
  commit. Pre-push will run the full fast suite.

## Constraints

- **DO NOT** touch Doppler. **DO NOT** modify any `effi/*` config.
- **DO NOT** touch Railway.
- **DO NOT** commit anything to `nextjs-app/.env.local` if you create
  one for smoke; it should be already covered by `.gitignore`.
- **DO NOT** edit any file under `zisser/` except this charter (append
  findings).
- One commit per task; push after each (autosync handles the rebase).
- Per `feedback_parallel_agents_share_git_worktree`: there's another
  active session (Doppler agent, `6dc82209`) that may commit
  concurrently. If your push is rejected, rebase with `git pull
  --rebase origin main` and retry. Don't force-push.
- Stay laconic. No commentary in commit messages beyond the click.

## Deliverable

- Task 1 — appended findings block in this file naming what works /
  what's broken; no code commit.
- Task 2 — single commit on `main`, banner shipping.
- Final return to FAB: 5-line summary.

## Stop condition

Both tasks attempted, findings file updated, single banner commit on
main. If task 1 surfaces a bug big enough to block task 2, park task 2
and surface to FAB before continuing.

---

## Findings — Wes return (2026-05-08)

### Task 2 — Banner: shipped

- Commit `0d6dcc7f2 feat(slack): private-channel /invite reminder banner in picker`.
- File: `nextjs-app/app/projects/[projectId]/config/slack-channel-picker-modal.tsx` —
  `selectedChannel` memo + `showPrivateInviteBanner` flag, renders
  `<Alert variant="effi-info">` with verbatim charter copy and a
  `<code>` for `/invite @effi`. Banner sits between channel list and
  `<DialogFooter>`, so it appears BEFORE Bind is clicked. Alert primitive
  reused (`@/components/ui/alert`); no new deps.
- Test: `nextjs-app/tests/unit/components/slack-channel-picker-modal.test.tsx`
  with 4 cases — no-selection / public-selected (banner absent),
  private-selected (banner present + verbatim copy + `/invite @effi`
  token), pre-action invariant (banner up while Bind enabled and
  un-clicked). All 4 pass; sibling `slack-install-and-bind-modal.test.tsx`
  still passes (the body is shared via `SlackChannelPickerBody`).
- Pre-push gate ran full nextjs unit suite — green; pushed to `origin/main`.

### Task 1 — Smoke: blocked at boot, no code change

`just agent-dev` brought all three processes up (63000/58000/8969).
`GET /` returned `HTTP 500` with:

```
Error: Your project's URL and Key are required to create a Supabase client!
  at createClient (lib/supabase/server.ts:22:27)
```

Root cause is a Doppler-scope mismatch, *not* a code defect:

| What the charter assumed | What's actually true |
|---|---|
| `just agent-dev` injects `effi/dev` Doppler creds via the wrapper | `justfile` `agent-dev-web` runs plain `bun run dev` — no `doppler run` wrap |
| Container-level `doppler run` (`scripts/container.sh:202`) covers it | That wrap uses `DOPPLER_PROJECT=dev-env DOPPLER_CONFIG=dev`, *not* `effi/dev` |
| `effi/dev` has app secrets needed for boot | `effi/dev` is missing `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_*`. `doppler secrets --project effi --config dev --only-names` shows `SLACK_*`, `MAILGUN_*`, `UNIFIED_*`, `SUPABASE_DB_PASSWORD`, but no Supabase URL/anon-key |
| `nextjs-app/.env.local` exists | Absent |

So even with `doppler run --project effi --config dev -- bun run dev`,
boot would still 500 — Supabase URL/anon-key aren't in `effi/dev` yet.
Per the hard constraint ("NO Doppler / `effi/*` writes; agent
`6dc82209` owns that sector"), I did not add them.

### What FAB needs to decide

1. Should agent `6dc82209` (Doppler track) populate `effi/dev` with
   `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` +
   `SUPABASE_URL` + `SUPABASE_ANON_KEY` (point them at the local
   Supabase from `bunx supabase start`, or at staging Supabase) — and
   then patch `justfile`'s `agent-dev-web` to wrap `bun run dev` in
   `doppler run --project effi --config dev --`?
2. Or — for local-only smoke — should we drop a non-committed
   `nextjs-app/.env.local` with localhost Supabase pointers? (`.env.local`
   is `.gitignore`d.) That keeps Doppler out of the loop entirely for
   smoke. Simpler, but doesn't validate the staging-shaped boot path.

Either is FAB's call. I'm not picking — both touch the Doppler agent's
sector or imply a wrapper change with blast radius.

### Side note — autosync activity during this run

While Task-2 push was in `pre-push` (ran ~270s — full nextjs suite
because `nextjs-app/**` changed), git status surfaced concurrent
modifications to `zisser/dispatched/2026-05-08-ocw-container-and-gim-infra-slice-2.md`
and `zisser/plans/2026-05-08-doppler-and-slack-ground-down.md` and a
slew of new untracked `zisser/` files — those belong to Zisser/FAB and
parallel agents, not me. I staged only the two banner-related files by
explicit path (per `feedback_parallel_agents_share_git_worktree`), so
the commit is clean. Push went through on first try; no rebase needed.
