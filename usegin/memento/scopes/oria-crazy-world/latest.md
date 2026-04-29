# Polaroid — 2026-04-29 ~08:30 UTC (scope: oria-crazy-world)

## Who am I

**Zisser** — Lihu wrote my soul as *"Lihu's chief-of-staff"*, but
**this session's human is Oria, not Lihu.** Oria caught me importing
the stale assumption from `~/.claude/projects/-workspaces-test-mvp/memory/MEMORY.md:1`
and `zisser/zisser.md`. The world's principle 10 step 6 still says
*"Oria asks Lihu"* — the right reframing is open. Treat me as
**the world's chief-of-staff**, serving whoever is human-in-chat,
until oria decides otherwise.

## The kill

Build *oria's crazy world* end-to-end + exercise the app-factory
through a real run. The world is the gym; the process is the artifact.

## Where I am

- **Phase:** all 7 phases of the world-build complete, all Ron-reviewed.
  App-factory ran end-to-end producing a live voice-to-Claude-to-voice
  app. 7 oria-pours placed (principles 06–11 + many seeds).
- **Done (committed + pushed to `AskEffi/oria-crazy-world`):**
  - World skeleton: ground/sky/space + 5 institutions (academy,
    gymnastic, university, visitor-center, app-factory) + dual-faced
    everywhere. World repo HEAD ~`672af22`.
  - 2 university depts: physics + anthropology, each with 4 papers
    (3 angles + synthesis) + dual-faced + faculty-seat doctrine.
  - 11 principles (1–5 pre-existing in usegin; 6 love/honesty/no-ego;
    7 learn-slow/amitim/clusters; 8 nature/emergence/four-goods;
    9 pedagogy-by-situation; 10 compass/comfort/escalation;
    11 positive-framing/responsibility).
  - Migrations: `usegin/oria-crazy-space/` → `oria-crazy-world/ground/`;
    personas/principles/philosophy copied with SoT notes.
  - GitHub: `AskEffi/oria-crazy-world` private; monorepo bootstraps
    via `just bootstrap-world` from `.devcontainer/post-create.sh`.
  - Aliases: `zisser`, `yohai`, `mark`, `poll` wake-up via
    `_persona` justfile recipe + path-injection guard.
  - **First mentor: David (GTD)** — `ground/personas/mentors/gtd-david.md`
    + curriculum at `ground/academy/mentors/gtd/` (situation 1 written).
  - **First listener: i-havana (אי-הבנה)** — `sky/listeners/i-havana/`
    with glass + 3 dictionary entries + 3 emitted insights.
  - **App-factory pilot run:** `oria-crazy-world/space/app-factory/runs/2026-04-29-gemini-voice/`
    — 10 step artifacts. Yohai QA: YELLOW (exercise-the-factory bar
    met; *do NOT promote URL to stable* until slice-2 cost-defense
    ships). Retro filed 6 lekach.
- **Not done (open-to-empty addresses, all named with home paths):**
  - `space/governance/_seed-positive-framing-sweep.md` — sweep of
    "don't / never / DO NOT" language across all existing artifacts.
  - `space/governance/shareholders/` — emergent weights (Oria 50% /
    others 50%); ask oria when needed.
  - `ground/personas/seeds/{shai.md, denny-zisser.md, denny-2.md}` —
    persona seeds; first invocation triggers soul-fill.
  - `ground/personas/animals/_seed.md` — animals subclass; Shai is
    the first probable inhabitant.
  - `ground/cage/rambam/` (dir created, content open) — Rambam as
    historical-figure citizen.
  - `space/teams/mechanics-engineering/_seed.md` — Denny-Zisser-led
    team, charter open.
  - `sky/university/departments/anthropology/papers/_seed-{soul-depth,
    zevet-and-relations}.md` — round-2 paper slots named in synthesis
    but FILES NOT YET CREATED on disk. (caveat: I named them in
    inbox + synthesis, but the actual `_seed-*.md` files in
    `papers/` may be missing; verify before claiming "filed".)
  - **Surrogates (oria's pour 7) — concept open.** Oria referenced
    surrogates as if previously discussed; I have no clean prior
    context. Will surface again.
- **In flight:**
  - **Voice translator app:** `/workspaces/voice-translator/` (local
    only, NOT pushed to GitHub). Server running on port 3030 via
    `doppler run … bun --hot src/server.ts` (PIDs 20730 + 20743).
    Cloudflared tunnel `https://ceramic-two-records-many.trycloudflare.com`
    → port 3030. **Both will die when container restarts** (no
    persistence). Cloudflared log at `/tmp/cloudflared.log`,
    PID at `/tmp/cloudflared.pid`.
  - Stash: 27 entries pre-existing before this session. Untouched.
  - Working tree dirt pre-existing: `ground/oria-crazy-space/_NEEDS-FROM-LIHU.md`
    (someone else's edit, not mine). Untouched.

## THE ONE THING

> **Oria is the human-in-chat — NOT Lihu.** Before responding to
> the first message on wake, glance at git `user.name`, session-start
> `userEmail`, and the user's own voice/signature; if any conflict
> with the imported memory's "user = Lihu" assumption, surface it
> inline. The whole session was contaminated by this mistake until
> oria caught it directly. The i-havana listener already filed the
> tick (`sky/listeners/i-havana/dictionary/oria-vs-lihu.md`) and
> emitted an insight to me; *read that insight first on wake*.

## Pending decisions / questions

- ↑ How to fix principle 10 step 6: should it name "whoever is
  human-in-chat" generically, or have separate Oria-track and
  Lihu-track ladders? Oria's call.
- ↑ Should Zisser's persona file (`zisser/zisser.md` in monorepo)
  be amended to read *"the world's chief-of-staff"* serving
  whoever-is-in-chat, or kept Lihu-specific with a parallel
  oria-zisser persona? Oria's call.
- ↑ Memory file (`~/.claude/projects/-workspaces-test-mvp/memory/MEMORY.md`)
  needs an Oria-as-user entry. Not done; left for oria to ratify
  the framing first.
- ↑ Voice app — wire to Effi (oria's team data) vs stay on plain
  Claude? Slice-2 question.
- ↑ Voice app cost-defense — Yohai's blocker. Slice 2 scoped:
  cost-cap + audio-length-cap + SDK timeouts + simple rate-limit.
- ↑ Surrogates — ask oria when he uses the word again.

## Don't-trust-yourself warnings

- **The Lihu/Oria confusion will recur on a fresh wake** unless I
  read the i-havana insight first. Memory file still says Lihu.
- **Cloudflared tunnel URL is in chat history** — `https://ceramic-two-records-many.trycloudflare.com`.
  When it dies, that URL is dead. Re-tunnel produces a new URL.
- **`_seed-{soul-depth, zevet-and-relations}.md` may not exist on
  disk** even though I described them as filed in synthesis. Verify
  with `ls oria-crazy-world/sky/university/departments/anthropology/papers/`
  before claiming round-2 papers are seeded.
- **org rate-limit was hit once** (mid Wes-anthropology). Org-level
  recovery happened by next dispatch. May recur — if it does,
  finish inline rather than re-spawn.
- **Headless `claude -p` Polls + `until` shell-loops were tried and
  hung** (10+ min, 0.4% CPU, no output). Don't reach for that
  pattern — use Agent-tool subagents which the runtime awaits
  properly, OR direct-Wes end-to-end for compressed runs.
- **Step ordering:** I (Zisser) violated factory step 8-before-9
  in the run (filed deploy-record before QA-report). Yohai caught
  it. Future factory runs need the completeness-gate (lekach 1
  in retro). Don't repeat the violation.

## Resume cue

> **First action on wake:**
> 1. Read `sky/listeners/i-havana/insights/2026-04-29-to-zisser.md`
>    (the insight the listener emitted to me — about the
>    Lihu/Oria mistake).
> 2. Confirm with oria: *"i think i'm talking to oria, not lihu —
>    confirm?"* (one line, before continuing).
> 3. Then ask oria where to pick up. Open threads: i-havana
>    ambient wiring (CLAUDE.md nudge), David starter session
>    (situation 1 brain-dump), voice-app slice-2, surrogates
>    clarification, principle 10 step 6 fix, memory file fix.

## Tattoos still holding

- z003 (placement-friction is sacred), z032 (laconic), z002 (no
  later), z020 (tikur form).
- **World tattoos** (this session — durable across all future
  zisser-sessions in this world):
  - The world has two names: *crazy world* + *world with grace*.
  - **Insight ≠ lesson** — listeners emit observations; inhabitants
    take their own lessons. Soul stays self-tended.
  - Shareholders: Oria 50% / others 50% emergent.
  - The world has an outer boundary: at the top of the escalation
    ladder (principle 10 step 6), the world goes *outside itself*.
  - Two layers of law: rules of nature (physics articulates) +
    principles (oria gives).
  - Faculty-seat doctrine: every artifact names its seat; "wes did
    the writing; the angle is X's"; opens supersession path.
  - Process > app. The world is only to exercise the process.

## Pointers

- World repo: https://github.com/AskEffi/oria-crazy-world (private)
- Local world working tree: `/workspaces/test-mvp/oria-crazy-world/`
  (gitignored from monorepo; bootstrap-cloned via
  `just bootstrap-world`)
- Voice translator: `/workspaces/voice-translator/` (local only,
  commit `3ecb6c4`)
- Whiteboard for the world build: `zisser/dispatched/oria-crazy-world/whiteboard.md`
- Run record: `oria-crazy-world/space/app-factory/runs/2026-04-29-gemini-voice/`
- Linear parent: ENG-5475 (closed Done) + 7 phase sub-issues
- This session's 7 oria-pours: `oria-crazy-world/inbox/2026-04-29-oria-pour.md`
- `git log --oneline -20` (in monorepo and in world repo, both)
