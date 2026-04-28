# Polaroid — 2026-04-28 14:43 UTC (main — Slack sanity-check + gap analysis aftermath)

## Who am I

UseGin in main session. Session named "slack-see it". Lihu walked in with: *"slack integration been created in the latent world since it's birth. now i wanna see real world results. open the app, see it's functional, do a sanity check, and give me a green/red light to use it."* Investigation went sideways into tooling friction, surfaced a new tikur, then Lihu pivoted to *"how is slack"* / *"what's the gap from fully functional feature."* Now stopping.

## The kill

**Gap analysis to fully-functional Slack landed (8 rows).** The real blocker for "fully functional" is **#1 — no ingestion path.** OAuth + install + channel-binding + lifecycle handlers are shipped, but no code reads `conversations.history` and feeds messages into search. The bind action stops at storing `(project_id, channel_id)`. That's the next unwritten spec.

Lihu has not yet picked which gap to attack next session. *Probable* next-session shape: pick #1 (ingestion spec) or #5 (marketplace listing — has a Slack ToS clock running to 2026-03).

## Where I am

- **Phase:** stop — gap analysis delivered, no further action this turn.
- **Done this session:**
  - Confirmed Slack toggle posture: `slackIntegration` flag live (`nextjs-app/lib/browser-flags/registry.ts:50-62`), default off, single UI gate. Cards hide cleanly when off.
  - Confirmed deploy posture: `SLACK_CLIENT_ID`/`_SECRET`/`_SIGNING_SECRET` + `TOKEN_ENCRYPTION_KEY` **none in any Railway env**; only Doppler dev. Connect button would return *"Slack integration is not configured"* in any deployed env.
  - **Tikur landed:** `.claude/tikur-records/2026-04-28-app-driver-silent-exit-1-and-rtk-hook-missing.md` — app-driver swallows ENOENT (reads stderr/stdout, ignores `result.error`); `playwright-cli` not on agent `$PATH` despite living in `node_modules/.bin/`. Adjacent finding: `rtk hook claude` is wired into every Bash PreToolUse but `rtk` not on PATH (silent exit 127, fails open). **Status: system-fix-deferred.** Proposed system fix: ~10 lines + remove/install `rtk`. Awaiting Lihu's go-ahead.
  - **Gap analysis (8 rows) produced inline.** Captured in this polaroid below — not in any file. Full table in the chat transcript.
- **Not done (open-to-empty):**
  - **The QA-run tikur** — STILL unwritten. Carried over from prior polaroid. Resume cue from prior polaroid was "decide recovery shape (lean: inline)" — I started that, then Lihu pivoted to "how is slack" / "gap" and I followed the live signal. The dead agent's errors (Skill≠Agent tool, stale playwright-cli refs, lazy-loaded tabs, untracked-files-not-mine, eval-fn pattern) are still uncaptured. Original errors recoverable from JSONL `~/.claude/projects/-workspaces-test-mvp/1bd3d9e0-b247-48a0-bca4-6de62a9b69e8.jsonl`.
  - **App-driver tikur system fixes** — record landed but `Status: system-fix-deferred`. Per z109, an unlanded tikur is the next tikur's root cause. Two coupled patches needed: (a) `tools/app-driver/src/cli.ts:pw()` surface `result.error?.message`; (b) resolve `playwright-cli` via `node_modules/.bin/` explicitly. Plus rtk-hook decision.
  - **Slack ingestion spec** — gap #1 in the table; no spec, not even open-to-empty.
- **In flight:**
  - Nothing actively mid-edit. Working tree has the same untracked sprawl from prior session (memento/, evals/, glasses/, personas/, etc.) — not mine.

## THE ONE THING

> **Slack is *connectable but inert*. The shipped code stops at "channel bound to project" — there is no message ingestion. "Fully functional" requires an ingestion-spec slice that doesn't exist yet. Don't let a future session declare Slack "shipped" without writing that spec first.**

## Pending decisions / questions

- ↑ **Land the app-driver tikur system fix?** (~10-line patch to `tools/app-driver/src/cli.ts` + `playwright-cli` resolution). One-prompt unblock from Lihu. Currently `Status: system-fix-deferred`.
- ↑ **rtk hook decision** — install `rtk` in devcontainer, remove from `.claude/settings.json`, or `bunx rtk`? (Currently fails silently exit 127 on every Bash call.)
- ↑ **Recover the QA-run tikur or let it die** — second time it's been deferred. If next session also defers, the lekach is dead. Lean: write inline next session, ≤30 min, errors are well-characterized.
- ↑ **Pick the next Slack focus** — ingestion spec (#1, real blocker) vs marketplace listing (#5, calendar clock) vs neither (Slack stays parked).

## Don't-trust-yourself warnings

- **Two open tikurs with deferred system fixes.** z109 says an unlanded tikur becomes the next tikur's root cause. Don't write a third tikur without first asking: do I owe a fix-landing on one of the two open ones?
- **`app-driver`'s `pw`-bridged subcommands silently exit 1.** Workaround: invoke `/workspaces/test-mvp/node_modules/.bin/playwright-cli` directly (full path), not `playwright-cli` (bare name). The bare name relies on PATH that the agent shell doesn't have.
- **Slack files are PARKED** (per prior polaroid; Lihu's standing constraint). Touching `nextjs-app/.../slack-*`, `nextjs-app/lib/slack-*`, `usegin/research/slack-*` requires un-park signal.
- **Lihu pivots fast — the live signal beats the prior resume cue.** "How is slack" / "what's the gap" superseded the polaroid's "decide tikur recovery shape." Read the live message, don't religiously follow the polaroid's resume cue if Lihu has already given you a fresher question.
- **Untracked files in `git status` are sibling-agents' work, not mine.** Use `git add <specific-paths>`; never `-A`.
- **The "8-row gap table" only exists in chat transcript.** If next session needs it as a durable artifact (e.g., for a spec or a Linear issue), regenerate or capture from `~/agent-records`.

## Resume cue

> **First action on wake:** read this polaroid. Then: if Lihu has said anything new about Slack focus, follow that. Otherwise present the four pending decisions above as a single list and ask which one is next. Constraint: do **not** silently start landing the app-driver tikur fixes — they need Lihu's go-ahead first (proposed in chat, not yet approved).

## Tattoos still holding

- z003 (open-to-empty), z032 (laconic), z002 (no later), z020 (decision shape) — standard.
- z109 (tikur self-tripwire) — *especially* relevant; two tikurs now sit with deferred system fixes.
- **Single UI gate posture**: "if a user can't click 'integrate slack', slack is behind a toggle for me."
- **Slack: parked.** Don't touch unless un-parked.
- `[ORIA]` not `[LIHU UNKNOWN]` for human-needed-input markers.
- Multi-Gin-safe commit recipe: `git add <paths>` → `bash scripts/hooks/snapshot-staged.sh` → `git commit`.

## Pointers

- `.claude/tikur-records/2026-04-28-app-driver-silent-exit-1-and-rtk-hook-missing.md` — this session's tikur (deferred).
- `.claude/tikur-records/2026-04-28-multi-gin-checkout-collisions.md` — precedent for unlanded-tikur-is-next-tikur rule.
- `.claude/tikur-records/2026-04-27-stale-client-ids-in-browser-prompt.md` — separate dead-agent artifact (already classified, not the QA-run tikur).
- `usegin/research/slack-integration/CLOSE.md` — D1-D6 + parking decision; D5.1 charter.
- `usegin/zettel/zettels/z109-partial-tikur-fix-is-still-an-unfixed-tikur.md` — the rule.
- `usegin/memento/archive/2026-04-28-144338.md` — prior polaroid (Slack run aftermath, QA-run tikur recovery as resume cue).
- Linear: ENG-5399 (parent), ENG-5409 (C-track shipped), ENG-5417 (Marketplace, Backlog).
- QA-run JSONL (DO NOT inline-cat): `~/.claude/projects/-workspaces-test-mvp/1bd3d9e0-b247-48a0-bca4-6de62a9b69e8.jsonl`.

## The 8-row gap table (capture for durability — chat-only otherwise)

| # | Gap | Owner |
|---|---|---|
| 1 | **No message ingestion path** — no code reads `conversations.history` / feeds search index. Real "fully functional" blocker. | Eng — spec not written |
| 2 | Customer-facing read-only at MVP (D2 decided) | Out of MVP scope |
| 3 | `SLACK_CLIENT_ID`/`_SECRET`/`_SIGNING_SECRET` not in any Railway env | Lihu (Doppler→Railway) |
| 4 | `TOKEN_ENCRYPTION_KEY` not in Railway | Lihu |
| 5 | Marketplace listing Backlog (ENG-5417) — Slack ToS clock to 2026-03 | Lihu |
| 6 | Workspace-settings card UX partial — channel-binding lives only in project config | Eng — small post-MVP |
| 7 | Toggle is per-cookie; no rollout plan | Decision pending |
| 8 | Open punch lists: 5 D5.1, 4 C4, 4 `[ORIA]` marketplace | Lihu (~30-min sweep) |
