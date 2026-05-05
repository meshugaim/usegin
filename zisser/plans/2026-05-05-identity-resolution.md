---
plan: identity resolution — single SoT for "who's at the keyboard"
authored_by: Zisser sub-agent
date: 2026-05-05
charter: zisser/dispatched/2026-05-05-identity-confusion-rootcause-zisser.md
status: proposal — needs Oria
---

# Identity resolution — one SoT for live-user across envs/humans/agents

## Situation

Three humans (Oria, Lihu, Nitsan) work this monorepo from at least three
env types (local devcontainer, GitHub Codespaces, Ona/Gitpod). Multiple
agents (Zisser/Gin/Mark/Wes/Ron/Sam/Poll/Yohai/Companion) get spawned by
each. The repo has identity infrastructure (`dx identify`, a SessionStart
banner hook, root `CLAUDE.md` "Live user" section, a team-shared memory
warning), but it **doesn't actually resolve a name in this env**, and most
agent prompts hardcode "Lihu" anyway.

The trigger: this session, parent Zisser treated input as Lihu for ~6
turns despite `userEmail = oria@askeffi.ai` in the system context.
Proximate fix landed (`.claude/agents/zisser.md` got a "Live user"
section). But the cluster runs deeper — and matches the spawn-prompt rule
in the justfile recipe + 100+ Lihu-name occurrences across skills,
zisser/, and personas.

## Cluster found (≥3 touches per area = real finding)

| Area | Touches |
|---|---|
| `dx identify` returns `null` for non-Nitsan humans in this env (only `nitsan` is in `.dx/config.json users`); the SessionStart banner therefore stays silent for Oria + Lihu | identify.ts L196–214 + .dx/config.json + identify-live-user.sh L19 |
| `_persona zisser` justfile recipe hardcodes `"Then wait for input from Lihu."`; other personas don't | justfile L5–10 |
| Skills hardcode "Lihu" as the speaker: brown(17), parking-question(11), morning-brief(11), tikur(9), rnd(9), zettel-capture(6), close(6), m-resume(4) etc. — 16 skill files total | rg counts above |
| `zisser/` itself binds Lihu in 14 files: zisser.md(19), 6 principles, README, persona, CLAUDE.md(7), agents.md(7), tools.md(2), routing.md(2) | rg counts above |
| `.claude/hooks/banner-needs-from-lihu.sh` is a SessionStart hook with "from Lihu" baked into the file name + banner text | settings.json L85,106,131,156 |
| All 7 persona agent files (mark/poll/ron/sam/wes/yohai/zisser) point at `oria-crazy-world/ground/personas/<name>.md` as SoT — that path doesn't exist in this env (Codespaces has no clone of the world repo) | ls; Codespaces post-create runs `just bootstrap-world` but it requires GH access to AskEffi/oria-crazy-world |
| Past attempts to record per-human identity in memory leaked across humans → tikur'd into `reference_memory_is_team_shared.md` and `feedback_email_from_git_user.md` | memory ls + commit history |
| Sessions touching "identif": 35 of 112 transcripts — recurring confusion, not a one-off | rg count |

## Current-state inventory

### Env signals available (this env: GitHub Codespaces)

```
USER=vscode                 ← machine user, never a person
whoami=vscode
GITHUB_USER=oria-ai         ← codespace owner GitHub login
gitUserName=oria masas      ← from gh-derived gitconfig
gitUserEmail=oria-ai@users.noreply.github.com  ← noreply, no askeffi.ai mapping
CODESPACES=true
CODESPACE_NAME=turbo-broccoli-…
CLOUDENV_ENVIRONMENT_ID=…   ← also present (Codespaces internal)
GITPOD_*                    ← absent
```

`dx identify` returns `{"user": null, signals: [...]}` — none of these
match any user-key or alias in `.dx/config.json` (which only knows
`nitsan`). The banner hook reads `.user` → empty → `exit 0` silently.
The agent then has **no live-user context** unless `userEmail` happens
to be in the system frontmatter (it sometimes is, sometimes isn't,
inconsistent across spawn types).

### Env signal matrix (cross-env)

| Signal | Local devcontainer | Codespaces | Ona/Gitpod | Notes |
|---|---|---|---|---|
| `USER` / `whoami` | `vscode` | `vscode` | `gitpod` (or env-id) | Never a person |
| `gitUserName` | from `git-identity.sh` (gh-derived) | same | same | First-token lowercase = first name |
| `gitUserEmail` | `<login>@users.noreply.github.com` | same | same | Useless for askeffi mapping |
| `GITHUB_USER` | absent | `oria-ai` / `lihu-effi` / `nitsan-avni` | absent | Codespaces only — login string |
| `CODESPACES` | unset | `true` | unset | |
| `CODESPACE_NAME` | unset | random-words | unset | |
| `CLOUDENV_ENVIRONMENT_ID` | unset | **present** (Codespaces) | present (Ona) | Both cloud envs set this |
| `GITPOD_*` | unset | unset | present | Ona-distinguishing |
| `DX_USER` | usually unset | unset | unset | Highest-precedence override (designed but unused) |

### Agent persona SoT chain — broken in two places

The agent files (`/workspaces/test-mvp/.claude/agents/<name>.md`) point
at `oria-crazy-world/ground/personas/<name>.md` as the canonical soul
file. That repo is cloned by `just bootstrap-world` (post-create.sh).
But:

1. `oria-crazy-world/` doesn't exist in this Codespaces env — the GH
   token may not have access to the private `AskEffi/oria-crazy-world`
   repo, or bootstrap silently failed. The `usegin/` previous home
   (`usegin/oria-crazy-space/personas/`) was deleted in commit
   `64e0ceaa3` ("ocw: gentle separation — personas live in OCW now"),
   leaving a one-line README that says "moved to oria-crazy-world".
2. `zisser/persona.md` openly notes this gap ("oria-crazy-world doesn't
   exist on disk in this working tree as of 2026-04-29 — Phase 4
   migration never landed in git. Until that path is real, this file is
   the SOT.").

So every persona-spawn reads instructions like "first read
`/workspaces/test-mvp/oria-crazy-world/ground/personas/<name>.md` — your
identity" and finds nothing. They proceed on the agent-file inline
prose, which itself binds names (Mark/Wes/Ron/Sam/Poll/Yohai = role
names; Zisser is the only one tied to a human-name "Lihu's chief-of-staff").

### "Live user" infrastructure today

| Component | What it does | Status |
|---|---|---|
| `.claude/hooks/identify-live-user.sh` | SessionStart hook calling `dx identify --json`; banners `LIVE USER: <name>` if `.user` resolves | Wired to startup/resume/clear/compact in settings.json. Silent when user unresolved. |
| `dx identify` (`tools/dx/src/commands/identify.ts`) | Collects signals, runs `autoDetectUser` against `.dx/config.json` users + aliases | Returns `{"user": null}` for Oria + Lihu in Codespaces (config only knows nitsan; gitUserEmail is noreply.github.com prefix, not in any aliases) |
| `.dx/config.json` users[] | `nitsan` only; `aliases: ["Nitsan Avni", "nitsan-ona"]` | Missing oria + lihu entries |
| Root `CLAUDE.md` "Live user" section | Tells the agent: SoT = `dx identify` banner; in-chat signals override | Correctly pointed; agent must actually read it |
| `.claude/agents/zisser.md` "Live user" section | Patched this session: SessionStart banner > `userEmail` > in-chat signals > "you" | Correct; one of one (the other 7 agent files have nothing) |
| `.claude/hooks/banner-needs-from-lihu.sh` | Reads `oria-crazy-world/ground/oria-crazy-space/_NEEDS-FROM-LIHU.md`; banners pending items | Silent in this env (file path missing). File-name/banner-text bind "Lihu" |
| `.devcontainer/git-identity.sh` | Sets git config from `gh api user --jq '.name'` | Works; emails are `noreply.github.com`, not `@askeffi.ai` |
| Memory `reference_memory_is_team_shared.md` | Warns: never write per-human identity to memory; SoT is in-chat signals | Correct rule, well-tikur'd |
| Memory `feedback_email_from_git_user.md` | When CLI needs `<name>@askeffi.ai`, derive from `git config user.name` first token lowercase | Correct heuristic; only works when git user is the actual person, not when it's a shared/wrong git-user |

### Hardcoded "Lihu" surface (not exhaustive but the load-bearing places)

- **Justfile `_persona` recipe** — zisser branch: `"Then wait for input from Lihu."` All other personas: generic `"wait for input."`
- **`zisser/zisser.md`** (19 mentions): identity definition opens with "Lihu's chief-of-staff. The friend who walks beside him."
- **`zisser/CLAUDE.md`** (7): "You are Lihu's chief-of-staff" + "Every Lihu input runs through this:"
- **`zisser/principles/01–06`** + `zisser/persona.md` — Lihu in voice/principle/example
- **`zisser/agents.md`** (7), `routing.md` (2), `tools.md` (2)
- **Skills** (16 files, ≥1 mention each): brown(17, by design — Brown protocol *is* "Lihu the relay"), parking-question(11, `!question` invoked by Lihu), morning-brief(11, "when Lihu opens a session"), tikur(9), rnd(9), zettel-capture(6, "what Lihu needs from this"), close(6, "what got named for Lihu"), m-resume(4), m-stop(2), prioritize(3), charter(3, "save Lihu the friction"), use-gin(2), brainstorm(2), evals-iterate(1), dogfooding-effi(1), app-sanity-test(1)
- **`.claude/agents/zisser.md`** (9): description + body bind Lihu
- **Hook + file**: `.claude/hooks/banner-needs-from-lihu.sh` + `oria-crazy-world/ground/oria-crazy-space/_NEEDS-FROM-LIHU.md`
- **Top-level `usegin/`**: values.md(6), things-we-grow.md(5), README.md(5), inbox-pending.md(5), CLAUDE.md(1)
- **Root `CLAUDE.md`**: 1 mention (correct, plain-language: "Use people's actual names — Lihu, Oria, Nitsan")

## Proposed resolution

**ONE policy, three layers (infra → mechanism → prose).**

### Layer 1 — Infrastructure: make `dx identify` actually resolve

The single source of truth is `dx identify`. For it to be load-bearing,
it has to return a real name in every env for every human.

**A. Populate `.dx/config.json users[]` with all three.**

Add `oria` and `lihu` alongside the existing `nitsan`, with aliases
covering every signal each will produce in every env:

```json
"users": {
  "oria": {
    "aliases": [
      "oria masas",            // gitUserName from gh
      "oria-ai",               // GITHUB_USER (Codespaces) + login prefix
      "oria-ai@users.noreply.github.com",
      "oria"                   // bare USER override
    ],
    "overrides": {}
  },
  "lihu": {
    "aliases": [
      "Lihu Ben Yosef",        // confirm — gitUserName from gh
      "lihu-effi",             // GITHUB_USER (Codespaces) — confirm exact handle
      "lihu",
      "lihu@askeffi.ai"        // if ever set as gitUserEmail in non-Codespaces
    ],
    "overrides": {}
  },
  "nitsan": { "aliases": ["Nitsan Avni", "nitsan-ona"], "overrides": { "ci-watcher": false } }
}
```

(Exact GH logins: needs Oria — see "Needs Oria" §.)

**B. Add `gitUserEmail` prefix-matching for `noreply.github.com`.**

`identify.ts` already extracts the prefix before `@` for emails — good.
For `oria-ai@users.noreply.github.com` it tries to match `oria-ai`,
which lands once we add it as an alias. (No code change required if
aliases are populated; calling out that this works.)

**C. Add a one-line `--write-cache` flag (or use `dx identify --as` proactively in `post-create.sh`).**

For new devcontainers/Codespaces, the post-create can call
`dx identify --as <login-mapped-name>` once at the end of bootstrap to
ensure aliases are fresh — but only when the auto-detect is unambiguous.

### Layer 2 — Mechanism: make every spawn read the SoT

The SessionStart banner already fires for the main session. **Sub-agents
spawned via `Agent`/`Task`/skill don't get a SessionStart hook fire** —
they inherit the parent's system context but don't replay the hook chain.
That's why the parent's banner doesn't reach the sub-Zisser; the
sub-Zisser sees only the system prompt the parent injected.

**D. Every persona-launching skill prompt must include the live-user resolution snippet.**

Same shape as the patch already in `.claude/agents/zisser.md`:

```
## Live user — who's actually in the chat

Before binding any decision to a named human, check in this order:
1. The `LIVE USER:` SessionStart banner (if present in context).
2. `userEmail` field in the `claudeMd` system context.
3. In-chat signals: signature, language, topic, "I'm <name>".
4. When still unsure: second-person ("you").

Skill prompts mentioning "Lihu" by name are defaults, not constraints.
Override on any signal pointing to a different speaker.
```

This snippet goes in: all 7 other `.claude/agents/*.md` files
(mark/wes/ron/sam/poll/yohai/companion) — same shape. **(Files exist;
just append the section.)**

**E. The justfile `_persona zisser` recipe drops "from Lihu".**

Change `"Then wait for input from Lihu."` → `"Then wait for input from
the live user (check the LIVE USER banner / userEmail / in-chat signals
before binding a name; never default to Lihu)."`. Or simpler: drop the
zisser branch entirely and use the generic `"wait for input."` like the
other personas.

**F. Charter shape — every charter file gets a `speaker:` field.**

When parent Zisser dispatches a charter (`zisser/dispatched/<…>.md`),
the YAML frontmatter records `speaker: oria` (or lihu/nitsan). Sub-agents
read that. Already implicit in many recent charters; make it required.

### Layer 3 — Prose: stop hardcoding "Lihu" where the speaker is variable

Two flavors:

- **Replace with role/role+plural:** "Lihu pours" → "the speaker pours"
  (or "you pour"). "what Lihu needs" → "what the human-side reader needs".
  "when Lihu opens a session" → "when the live user opens a session".
- **Keep when load-bearing to Lihu specifically:** Brown protocol's
  "Lihu is the relay" stays — that's a Lihu-specific working pattern,
  not a default speaker assumption. Same for any narrative about
  Lihu's specific working style if it's *about* Lihu, not *addressing* him.

**Files that change in this pass (Layer 3):**

| File | Lihu count | Change shape |
|---|---|---|
| `zisser/zisser.md` | 19 | Open: "the chief-of-staff; primary speaker is Lihu but the whole team invokes Zisser. Read live-user signals before binding." Replace remaining Lihu-as-speaker with "the speaker" / "you" |
| `zisser/CLAUDE.md` | 7 | "Every input runs through this" (drop "Lihu input"); rest similar |
| `zisser/principles/01–06` (40 total) | n/a | Each principle keeps Lihu where the *teaching example* is Lihu-specific (e.g. "Lihu pours, you receive" — that's a real protocol with Lihu); add a line at top that says other speakers route the same way |
| `zisser/persona.md` (8) | n/a | Keep "Voice — what I've learned about Lihu" since this IS the section about Lihu specifically; add a parallel "Voice — what I've learned about Oria" + "…about Nitsan" as open-to-empty |
| `zisser/agents.md`, `routing.md`, `tools.md` | 11 total | Drop or genericize "Lihu" where it means "the speaker"; keep where it's about Lihu's actual workflow |
| `.claude/agents/zisser.md` description + body | 9 | Already has "Live user" section. Description still says "Lihu's chief-of-staff" — recommend: "Chief-of-staff agent (primary: Lihu; available to whole team)." |
| `.claude/skills/{morning-brief,parking-question,charter,close,zettel-capture,m-resume,m-stop,brainstorm,prioritize,rnd,tikur,use-gin}/SKILL.md` | 65 total | Genericize speaker references; KEEP where it's about Lihu-specific protocol (z087 pour-and-process is genuinely Lihu's; z088 mentions Oria too) |
| `.claude/skills/brown/SKILL.md` | 17 | KEEP — Brown protocol *is* about Lihu as relay |
| `.claude/skills/dogfooding-effi/SKILL.md`, `app-sanity-test/SKILL.md`, `evals-iterate/SKILL.md` | 3 | Spot check + genericize |
| `.claude/hooks/banner-needs-from-lihu.sh` + `_NEEDS-FROM-LIHU.md` | n/a | Rename → `banner-needs-from-human.sh` + `_NEEDS-FROM-HUMAN.md`. Update settings.json + the OCW path. The file is "things only a human can do" not "things only Lihu can do" |
| `usegin/values.md`, `things-we-grow.md`, `README.md`, `inbox-pending.md` | 21 | Spot check; usegin has more legitimate "Lihu" since these are Lihu's notes, but `things-we-grow.md` for the team should be plural |

## Migration steps (when Oria approves)

1. **Layer 1 first** — populate `.dx/config.json users[]` for oria + lihu.
   Confirm `dx identify` returns the right name in each env (probe all
   three). One commit. *Needs Oria: GH login handles for confirmation.*
2. **Banner hardening** — add a non-silent fallback to identify-live-user.sh
   so when `dx identify` can't resolve, the banner *still* prints
   `LIVE USER: unknown` + the raw signals + "trust in-chat signals".
   Currently the banner is silent on miss → agent never sees a prompt to
   check elsewhere.
3. **Layer 2 — mechanism.** Append the "Live user" snippet to the 7
   other `.claude/agents/*.md` files. Drop "from Lihu" from the justfile
   `_persona zisser` recipe. Add `speaker:` field convention to charter
   shape (skill `charter/SKILL.md` + the agent files). One commit per
   sub-step.
4. **Rename `banner-needs-from-lihu.sh` → `banner-needs-from-human.sh`**;
   update settings.json + the file path. Same with `_NEEDS-FROM-LIHU.md`
   in OCW (separate repo commit).
5. **Layer 3 — prose.** Sweep `zisser/`, then skills, then `usegin/`,
   genericizing Lihu where it means "the speaker" and keeping it where it
   is Lihu-specific. One commit per area (zisser, skills, usegin) so
   diffs are reviewable.
6. **Add OCW persona-bootstrap fallback.** When `oria-crazy-world/` is
   absent (e.g. Codespaces token can't read the repo, or fresh container
   pre-bootstrap), agent files should detect that and fall back to inline
   guidance instead of pointing at a missing path. One way: agent files
   check the path exists; if not, emit a one-line warning in their
   read-first list. Cleaner: keep an inline-fallback block at the top of
   each agent file ("If `oria-crazy-world/...` doesn't exist, your soul
   is the description above; proceed.").

## Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Aliases drift as humans get new GH accounts | A new login = silent unresolved | Make `dx identify --as <name>` more discoverable; banner-on-miss prompts user to run it |
| Genericizing Lihu loses signal where Lihu's voice IS the teaching | Principles like z087 / z088 are *about* Lihu's working pattern | Keep Lihu where the example IS Lihu; only genericize speaker-defaults |
| Memory team-share could re-leak | Past `user_lihu_identity.md` got inherited cross-env | Reinforce `reference_memory_is_team_shared.md`; the policy here doesn't change — *banner* is the SoT, *not* memory |
| `oria-crazy-world` access is per-GH-token | Codespaces post-create runs `bootstrap-world`; if token can't read AskEffi/oria-crazy-world, it silently fails | Either: make all team GH PATs have access; OR: make personas inline-resilient (Layer 2 §F); OR: `bootstrap-world` should hard-error and surface in `_NEEDS-FROM-HUMAN.md` |
| Zisser identity ("Lihu's chief-of-staff") is foundational | Renaming Zisser's primary binding is out of scope per charter | Don't rename; just add "primary speaker is Lihu, but invoked by whole team" framing |

## Acceptance criteria

A fresh sub-agent in a fresh env (Codespaces/Ona/local), spawned by any
of the three humans, will:

1. See `LIVE USER: <name>` in the SessionStart banner — name resolved
   from `dx identify`. (If unresolved, banner says `LIVE USER: unknown`
   + signals + "check in-chat".)
2. If the agent is a persona spawn, see a "Live user" section in its
   agent file telling it not to default to Lihu.
3. Find `speaker:` in any charter it was dispatched from.
4. Find no `_persona` recipe baking a name.
5. When reading skills (morning-brief, charter, close, m-resume etc.),
   not see "Lihu" wherever the meaning is "the speaker" — only where the
   meaning is "Lihu specifically".
6. Find OCW persona pointers either resolvable, or with an inline
   fallback making the agent file self-contained.

## Needs Oria

(One-line items; nothing here is a fork on the *direction* — only on
specifics this sub-Zisser doesn't have.)

1. **Confirm GH logins for the alias map.** What's Lihu's GH login?
   Is `oria-ai` your only GH account, or do you also use a personal one?
   What's Nitsan's beyond `nitsan-ona`? — needed for `.dx/config.json`.
2. **Should `dx identify` know Brown / external collaborators too?**
   Lean: no — Brown protocol is invocation-time, not a dx-level identity.
3. **Rename `banner-needs-from-lihu.sh` → `banner-needs-from-human.sh`?**
   Lean: yes (the file is genuinely "human-side pending", not Lihu-only).
   Confirm before renaming.
4. **OCW access from Codespaces.** Should the GH PAT for Codespaces
   gain `AskEffi/oria-crazy-world` read, or should personas become
   inline-resilient? Lean: inline-resilient is the safer fallback either
   way (defense in depth).
5. **Zisser's primary binding to Lihu — keep it?** Lean: yes; Zisser
   started as Lihu's chief-of-staff, that's load-bearing. Just add
   "available to whole team" framing where the *speaker* defaults
   ambiguously.
6. **One commit per layer/area, or one big sweep?** Lean: one per area
   (4–6 commits), so each is reviewable and revertable.

## Files that would change (so execution is tight)

```
.dx/config.json                                          [Layer 1]
.claude/hooks/identify-live-user.sh                      [Layer 2 — banner-on-miss]
.claude/hooks/banner-needs-from-lihu.sh → -from-human.sh [rename + settings.json update]
.claude/settings.json                                    [hook-path update]
.claude/agents/{mark,wes,ron,sam,poll,yohai,companion}.md [add Live user section]
.claude/agents/zisser.md                                 [refine description]
justfile (recipe: _persona zisser branch)                [drop "from Lihu"]
.claude/skills/charter/SKILL.md                          [add speaker: field]

zisser/zisser.md                                         [Layer 3 prose]
zisser/CLAUDE.md
zisser/principles/01-walk-beside.md
zisser/principles/02-place-for-everything.md
zisser/principles/03-orchestrate-not-execute.md
zisser/principles/04-loop-back.md
zisser/principles/05-act-and-ask-simultaneously.md
zisser/principles/06-soul-and-learning.md
zisser/persona.md                                        [add Oria + Nitsan voice sections]
zisser/agents.md
zisser/routing.md
zisser/tools.md
zisser/README.md

.claude/skills/morning-brief/SKILL.md
.claude/skills/parking-question/SKILL.md
.claude/skills/charter/SKILL.md
.claude/skills/close/SKILL.md
.claude/skills/zettel-capture/SKILL.md
.claude/skills/m-resume/SKILL.md
.claude/skills/m-stop/SKILL.md
.claude/skills/brainstorm/SKILL.md
.claude/skills/prioritize/SKILL.md
.claude/skills/rnd/SKILL.md
.claude/skills/tikur/SKILL.md
.claude/skills/use-gin/SKILL.md
.claude/skills/dogfooding-effi/SKILL.md
.claude/skills/app-sanity-test/SKILL.md
.claude/skills/evals-iterate/SKILL.md

usegin/values.md                                         [spot review only — usegin owns these]
usegin/things-we-grow.md
usegin/README.md
usegin/inbox-pending.md
usegin/CLAUDE.md

oria-crazy-world/ground/oria-crazy-space/_NEEDS-FROM-LIHU.md → _NEEDS-FROM-HUMAN.md  [separate repo]
```

NOT touched by this plan (per charter constraints):
- `.dx/config.json` — proposal only; Oria approves the alias content
- Persona files in `oria-crazy-world/` — separate repo, Oria approves
- Zisser-the-name rename / chief-of-staff framing — out of scope
