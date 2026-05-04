---
title: Wes charter — `dx slack` admin-grade ops + post-install smoke
date: 2026-05-04
spawned_by: sub-Zisser (parent: 2026-05-04-slack-autonomous-ops-zisser.md)
spawn_target: Wes (`.claude/agents/wes.md`)
linear: open sub-issue under ENG-5409 named `dx slack: admin-grade ops + post-install smoke`
parent_charter: zisser/dispatched/2026-05-04-slack-autonomous-ops-zisser.md
---

## 1. Purpose (the *because*)

So that Zisser stops needing Lihu-clicks for every routine Slack
operation. After Lihu's one-time install of UseGin-Slack to the real
AskEffi workspace, every Slack op — channel create, invite, post,
bookmark, file upload, member resolve, DM — must run from `dx slack`
inside this devcontainer, no clicks. Lihu's anchor (2026-05-04):
*"give only the things you can't do on your own."*

## 2. Key tasks (outcomes, not steps)

1. **Expand `dx slack` surface** with the 11 subcommands in the parent
   charter's table (channel create/invite/join/archive/topic/purpose,
   bookmark add, channel members, user find, dm, files upload, react —
   verify react isn't already covered before adding).
2. **Ship `dx slack smoke`** — a single one-page-report command that
   gates "Zisser is operational in real AskEffi." Implements all 5
   checks in §2 of the parent charter; gated `--skip-live` when the
   real-workspace token swap hasn't landed.
3. **Doppler key hygiene + README**: document the canonical key table
   in `tools/dx/src/slack/README.md`. Propose (don't execute) the
   `ASKEFFI_SLACK_*` rename for the customer-facing keys as a follow-up
   Linear sub-issue.
4. **Channel-name registry** at `tools/dx/src/slack/registry.ts` —
   `ZISSER_CHANNELS = { outbox, alerts, log }` constants.
5. **(Stretch) `zisser slack post`** thin wrapper — only if 1–4 land
   cleanly with time left.

## 3. End state (concrete, testable)

- All new `dx slack <verb>` subcommands work against the live test
  workspace bot (token in env as `USEGIN_SLACK_BOT_TOKEN`, already
  verified — `auth.test` returns `team=askeffi T0AUGMX1XNZ`,
  `bot=useginslack U0B0414E92T`).
- Each new subcommand has: a unit test with a fake transport (matching
  existing `channel.test.ts` / `post.test.ts` shape), and an
  integration test gated behind `DX_SLACK_LIVE=1` (off by default in
  CI).
- `bun test ./tools/dx/` is green.
- `dx slack smoke --skip-live` runs cleanly today; `dx slack smoke`
  (no flag) runs end-to-end against real AskEffi after Lihu's swap.
- README updated; channel registry committed; Linear sub-issue opened
  via `plan create` and committed-back when work lands.

## 4. Doctrinal-pointer block (read FIRST, before any edits)

- `usegin/Gin.md` — umbrella spirit + 3 load-bearing principles.
- `usegin/zettel/principles/05-the-twelve-from-war-research.md` —
  full doctrine (Selbständigkeit, friction, etc.).
- `tools/dx/CLAUDE.md` — three-layer command convention (pure /
  builder / handler), output convention (human → stderr, JSON →
  stdout), `dxShouldOutputJson`.
- `tools/dx/src/slack/README.md` — what's already shipped, the setup
  steps Lihu has done.
- `tools/dx/src/slack/{config,client,channel,send,post,read,inbox,whoami,links}.ts`
  — the patterns you must clone (especially `channel.ts` for resolver
  reuse and `inbox.ts` for the most complex existing example).
- `tools/dx/src/slack/commands/whoami.ts` — the canonical command
  builder shape (Commander, exit codes 0/1/2, `--json` flag).
- `tools/dx/src/slack/post.test.ts` — the canonical test shape for
  fake-client unit tests.
- Slack API reference (use `mcp__context7` if doc lookups needed):
  - `conversations.create` / `.invite` / `.join` / `.archive` /
    `.setTopic` / `.setPurpose` / `.members`
  - `users.lookupByEmail`, `users.list`, `users.info`
  - `bookmarks.add`
  - `files.getUploadURLExternal` + `files.completeUploadExternal` (v2
    upload flow — **NOT** the deprecated `files.upload`)
  - `chat.postMessage`, `conversations.open`
  - `reactions.add`
- Parent charter `zisser/dispatched/2026-05-04-slack-autonomous-ops-zisser.md`
  for full deliverable list, scope edges, stop conditions.

## 5. Selbständigkeit clause (verbatim — do NOT soften)

> *You are obligated to deviate from the literal task if it stops
> serving the purpose.* (z023, IDF TO"L *rosh-gadol* — own the goal,
> not the words.) If the purpose can be served better by a different
> approach than the one in §2, take the better approach and report
> what you changed and why.

Concrete: if you find `reactions.add` is already shipped, skip it and
note in the return. If `files.uploadV2` ergonomics make a single
helper meaningless (each call site needs different flow), say so —
don't ship a fake helper. If a Slack scope is missing for a
subcommand, ship the code with a feature-detect that returns a
helpful `error: needs_scope_<name>` and add the scope to the
"Lihu-please-add-these" list in the README.

## 6. Decision-rights envelope

**You decide alone (proceed without asking):**
- Implementation shape (which file each new command lives in; how
  to factor shared resolvers like `users.lookupByEmail`).
- Test transport mock shape — match existing patterns.
- Whether to extend `channel.ts`'s resolver or build a `user.ts`
  parallel for user resolution. (Likely build a sibling — channel and
  user are different namespaces in Slack.)
- TDD ordering — pure-logic seams TDD'd; live integration tests
  manual-only behind `DX_SLACK_LIVE=1` (per memory:
  `feedback_tdd_split_for_spikes`).
- Commit cadence — one commit per subcommand landed (per memory:
  `feedback_commits_at_every_change`); push after every commit.

**Halt and surface to sub-Zisser:**
- Slack API rate-limited (Tier 2/3 hit) → halt + surface, no retry
  loop.
- Bot lacks a scope you can't work around → ship the rest, mark the
  affected subcommand `[needs-scope]` in README, surface in return.
- 3 same-root failures at one cycle → invoke `tikur` skill + halt.
- Anything that would touch prod DB, deploys, or
  `nextjs-app/app/api/slack/` (the customer-facing app) → halt, out
  of scope.

**Forbidden:**
- Touching `nextjs-app/app/api/slack/`, `python-services/`, deploys,
  or any Doppler config beyond reading.
- Marketplace listing work, retiring redundant apps.
- Force-push, push to staging/production, anything destructive.
- `admin.*` API calls (those need a `xoxp-` user token, not in
  scope).

## 7. Fresh-Haiku test

A fresh agent reading only this charter + the read-first list should be
able to:
- Identify the test workspace token is in `USEGIN_SLACK_BOT_TOKEN`
  (set in env, no Doppler call needed in this devcontainer).
- Locate the existing pattern by opening `tools/dx/src/slack/post.ts`
  + `post.test.ts` and recognize "this is the shape I clone."
- Open the Linear sub-issue via `plan create --parent ENG-5409`.
- Know to push commits to `main` (no PR; per memory:
  `feedback_no_pr_language`).
- Know to use the `Agent` tool / sub-agents for explore work, not
  inline reads (per memory: `feedback_prefer_subagents_for_explore`).

## Specific gotchas / context for Wes

1. **Bot is in `askeffi` workspace** — `dx slack whoami --json` already
   returns OK. Same name as the real workspace, so this MAY already
   be the real workspace. Lihu's swap (parent step A1–A7) may or may
   not have happened. Treat as "real-or-test, indistinguishable from
   bot's POV; smoke check is what disambiguates."
2. **Current scopes** (verified live):
   `chat:write, app_mentions:read, reactions:write, channels:read,
   channels:history, groups:read, groups:history, users:read`.
   **Missing scopes you'll need to feature-detect or surface for
   Lihu**: `channels:manage`, `groups:write`, `channels:join`,
   `users:read.email`, `bookmarks:write`, `files:write`, `im:write`.
3. **`reactions:write` IS already in scope** — verify whether
   `dx slack react` is already shipped before adding. (`tools/dx/src/slack/`
   has no `react.ts` per directory listing — but check
   `tools/dx/src/slack/commands/`.)
4. **JSON output convention**: `{ok, error?, ...}` with everything
   else nested. See `formatSendJson` for the exact pattern.
5. **Channel resolver reuse**: import `resolveChannel` from
   `./channel`. For users, build a parallel `./user.ts` resolver:
   accept `Uxxxxx` raw id, `@handle` (via `users.list` walk), or
   email (via `users.lookupByEmail`). Cache nothing — Slack's user
   list is small enough.
6. **`files.uploadV2`** — `@slack/web-api` ≥ 6.11 ships
   `client.files.uploadV2()` as a high-level helper that handles the
   `getUploadURLExternal` → PUT → `completeUploadExternal` dance.
   **Use that helper, not the raw 3-step API.** Verify via
   `mcp__context7` query if you need to be sure about the helper's
   shape.
7. **Smoke test channel name**: don't hardcode. Read from env var
   `DX_SLACK_SMOKE_CHANNEL` (default `#dev`). Document in README.
   When Lihu's swap lands, he sets that env var to whatever channel
   he invited the bot to.
8. **`team_id` for smoke**: the parent says "compare to expected
   value held in repo config." Hold this in
   `tools/dx/src/slack/registry.ts` alongside the channel registry,
   as `EXPECTED_REAL_TEAM_ID = "T0AUGMX1XNZ"` — that's the askeffi
   workspace team_id we already verified. If a future workspace
   swap happens, update the registry.
9. **No `m-stop`/`m-resume` needed** — this is one focused session;
   if you can't finish in one go, commit what you have, write a
   one-paragraph "where I left off" at the bottom of THIS charter
   file (below the divider) and stop.
10. **Open the Linear sub-issue early** (after step 1.1 of your
    own internal todo) — `plan create --parent ENG-5409 "dx slack: admin-grade ops + post-install smoke"`
    — and commit a reference to its ID in the README and in your
    commit messages.

## Stop conditions

(echoing the parent charter's §Stop conditions — do not redefine):
- Slack API rate-limited → halt + surface; no retry loop.
- Missing scope you can't feature-detect around → ship rest, mark
  `[needs-scope]`.
- 3 same-root failures at one cycle → tikur + halt.
- Touching prod DB / deploys / customer-facing Slack code → halt.

## Return shape

Return ≤15 lines to sub-Zisser via your final assistant message:

```
Linear: ENG-XXXX
Commits: <SHA1>, <SHA2>, ...
Subcommands shipped: <list> ; deferred: <list with reason>
Smoke output: `dx slack smoke --skip-live` exit code <N>; <line summary>
Smoke (live): not run / pending Lihu swap / passed
Open ↑s: <if any — ≤15-word questions or scope items needing Lihu>
Lihu's swap needs: <extra scopes? smoke channel name? team_id mismatch?>
```

Append the same return below the divider in THIS charter file before
your final message, so the audit trail persists.

---

(Wes appends below)

## Wes return — 2026-05-04

```
Linear: ENG-5760 (slice 3, In Progress) ; follow-up ENG-5761 (Doppler rename)
Commits (9 on main):
  765b2b074 registry + EXPECTED_REAL_TEAM_ID
  7d9144883 user resolver (id/email/handle)
  174f61002 channel admin ops (create/invite/join/archive/topic/purpose/members)
  e114519a3 channel bookmark add
  2ec2f1bfe user find + dm
  501c815eb files upload (uploadV2)
  a1f34275c react (reactions.add)
  0caeebdaf smoke (--skip-live)
  e66b0c7d8 README rewrite (scope table, Doppler key hygiene)
Subcommands shipped: channel create/invite/join/archive/topic/purpose/members,
                     channel bookmark add, user find, dm, files upload, react,
                     smoke (with --skip-live).
Deferred: stretch §5 (`zisser slack post`) — purpose already met by
          `dx slack post` + env `USEGIN_OUTBOX_CHANNEL=#zisser-out`. No
          standalone `zisser` CLI exists; building one is far beyond a
          "thin wrapper". Selbständigkeit clause invoked.
Smoke output: `dx slack smoke --skip-live` exit 0
  [ OK ] auth.test                 team=askeffi (T0AUGMX1XNZ), bot=useginslack (U0B0414E92T)
  [ OK ] team_id                   matches EXPECTED_REAL_TEAM_ID
  [WARN] channels.count            only 3 channels — looks like a test tenant
  [SKIP] smoke_channel.presence    --skip-live
  [SKIP] smoke_channel.round_trip  --skip-live
  [WARN] users.lookupByEmail       missing_scope (users:read.email not granted)
Smoke (live): pending Lihu's swap. Once live the same command without
              --skip-live runs all 6 checks; current scopes will block at
              users.lookupByEmail unless `users:read.email` is added.
Tests: 683 pass / 1 todo / 0 fail (whole `tools/dx/`); +192 of those are slack/.
Open ↑s: none — every decision in §6 was a clear call.
Lihu's swap needs:
  - Add scopes (per README "Lihu-please-add-these"):
    channels:manage, groups:write, channels:join, users:read.email,
    bookmarks:write, files:write, im:write
  - After swap, set Doppler `DX_SLACK_SMOKE_CHANNEL=#dev` (or whatever
    channel the bot is invited to) on usegin/dev; smoke defaults to #dev.
  - team_id check is anchored to `T0AUGMX1XNZ` (current bot's workspace,
    same name as real "askeffi"). If the real workspace's team_id differs
    update `EXPECTED_REAL_TEAM_ID` in `tools/dx/src/slack/registry.ts` in
    the same commit that lands the new bot token. Smoke will catch any
    drift.
```

### Selbständigkeit deviations (per §5)

1. **Skipped stretch deliverable §5** — `zisser slack post` thin wrapper.
   No `zisser` binary exists and no skeleton justifies one as a thin
   wrapper. The purpose ("Zisser posts to Slack in one line") is met
   today by `dx slack post "<msg>"` (defaults to outbox channel) plus
   `USEGIN_OUTBOX_CHANNEL=#zisser-out` in env. Recommended action when
   Lihu wants the verbatim wording: just set the env var.

2. **Single channel-admin commit batched 7 verbs.** §6 said "one commit
   per subcommand"; deviated for the seven channel verbs because they
   share one `channelOps.ts` module + one OpResult shape — splitting
   into 7 commits each touching the same file would have made the audit
   trail noisier than the work warranted. All other verbs (bookmark,
   user find, dm, files upload, react, smoke) are individually committed
   per the cadence rule.

3. **Channel registry name changed.** Charter §4 used `outbox: '#zisser-out'`
   verbatim. Kept that. (Not really a deviation, just noting it landed.)

