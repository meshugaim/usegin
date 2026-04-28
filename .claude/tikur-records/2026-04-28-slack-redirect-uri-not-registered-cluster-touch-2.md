# Tikur: Slack OAuth `redirect_uri did not match any configured URIs` — cluster recurrence of "probe external config"

**Date:** 2026-04-28
**Severity:** medium (recurrence × blast-radius — second incident in 24h with the same root; would have wasted ~3 minutes of Lihu's time + my context every time we trust an "I did" without probing)
**Status:** open (immediate fix in progress; system fix landing this turn)
**Category:** error at the per-incident level; **cluster-level: tikur-skill-self-tripwire violation** — yesterday's lekach landed as a memory entry, not as a hook or handbook section that fires at the moment the failure mode is in play.

## Cluster

This tikur consolidates two incidents and one lurking variant from the same 24h window, all sharing one mechanism — *trusting Lihu's verbal "I did" on external-Slack-app configuration strings without independent probing*:

| # | Source | Surface symptom | Tape |
|---|---|---|---|
| 1 | This run, ~16:00 UTC | Slack OAuth rejected `redirect_uri did not match any configured URIs. Passed URI: http://localhost:3000/api/slack/callback` | Browser screen Lihu pasted; my dev-server log confirms the URL my code sent matches what Slack rejected |
| 2 | This run, ~15:30 UTC | Asked Lihu about `commands` scope mismatch, accepted "did" without verification — happened to be true (no failure surfaced *yet*), but the same trust pattern | This session transcript; risk-of-failure equivalent to incident #1 |
| 3 | Yesterday's tikur (2026-04-27) | `stale-client-ids-in-browser-prompt` — same shape: trusted external IDs without probing | `.claude/tikur-records/2026-04-27-stale-client-ids-in-browser-prompt.md`; produced `feedback_preflight_external_identifiers_in_dispatched_prompts.md` |

**Cluster-search keyword:** `external config | slack app | redirect uri | scope mismatch | probe before claim`. Touches: 3 distinct (cluster threshold met). The cluster is not "Slack OAuth"; it is "we don't probe external-system configuration before claiming it's set."

## Speaking-order discipline

1. **Tape** (above): Slack's error message verbatim, my dev-server logs.
2. **UseGin reconstruction** (below).
3. **Lihu framing**: "no rush. /tikur + investigate." Floor-zero adequate — Lihu is asking *for* the post-mortem rather than blaming UseGin; framing-as-input rather than framing-as-conclusion.

## Timeline (this incident)

- ~14:30 UTC — Lihu finishes a Slack-admin pass, says "Lihu finished, check if you can see it." He's added scope (`commands`) Slack-side. I check Doppler for secrets (still missing), prompt him.
- ~14:35 UTC — Asked Lihu about the `commands` scope: "did you add `commands`, or do I drop?" He answers "he did" (one word). I accept. **First trust-without-probe of the run.** No failure surfaces *yet* (the scope is in fact granted; lucky).
- ~15:30 UTC — Wrote a "Tunnel B" map to Lihu listing what's registered Slack-side, citing his "I did" claims for redirect URL and Events URL. Did not probe either. **Second trust-without-probe.**
- ~16:00 UTC — Drove the OAuth init via playwright, captured the authorize URL, surfaced the URL to Lihu, asked him to drive the click in his real Chrome.
- ~16:05 UTC — Lihu pastes Slack's error: `redirect_uri did not match any configured URIs. Passed URI: http://localhost:3000/api/slack/callback`. **First trust-without-probe of the day surfaces the cost.**

**The 24h-prior tikur** (`2026-04-27-stale-client-ids-in-browser-prompt.md`) had already named this exact failure mode and produced a memory entry. The memory entry was not consulted at the moment of decision (during the tunnel-B mapping), nor when I accepted the verbal "I did" twice.

## Five whys

- **Why** did Slack reject the OAuth?
  - **A:** `http://localhost:3000/api/slack/callback` is not in the Slack app's registered redirect-URI list — yet I claimed in the "Tunnel B" map that it was.
    - **Why** did I claim it was registered?
      - **A:** Lihu told me "I did" earlier; I accepted without probing.
        - **Why** did I not probe?
          - **A:** Probing requires either a Slack-API call I don't think exists for this introspection, or asking Lihu to read me the exact string. Either felt like friction; the verbal "yes" felt sufficient.
            - **Why** did the verbal "yes" feel sufficient *after yesterday's tikur explicitly named this failure mode*?
              - **A:** ← *root cause, leverable.* **Yesterday's tikur landed the lekach as a `feedback_*.md` memory entry. Memory entries require me to *retrieve them at the right moment* (semantic search at decision time). The retrieval didn't fire because nothing in the moment-of-decision triggered the right keyword association.** The fix landed in the wrong layer — *should have been in `use-gin/SKILL.md` under a "Slack OAuth setup" or "external-system config" section that future Gins read when the topic is on screen.*

In parallel, the *content* root cause (separate from the process root cause):

- **Why** is the redirect URL not registered when Lihu claimed he added it?
  - **A:** Three plausible variants — (a) typo (e.g. `https://`, port `8001`, trailing `/`); (b) added to wrong app (Lihu may have multiple Slack apps for different envs); (c) added but to a different field (e.g. accidentally to "Allowed Domains" instead of "Redirect URLs").
    - **Why** can't I tell which?
      - **A:** I can't query api.slack.com's app config from outside the admin console. Only Lihu can read the live state.

## Cluster check (skill rule 4.5)

`feedback_preflight_external_identifiers_in_dispatched_prompts.md` already exists from yesterday's tikur. **The cluster is the finding.** This second-touch incident does not get a new memory entry — that would replicate the same failure (memory-too-deep retrieval). Instead, the lekach moves to **`use-gin/SKILL.md`** under a new "External-system config — probe before trust" section, where it is loaded into Gin's context whenever Gin reads the use-gin handbook (which it does on any "can Gin do X" / "is X set up" question).

This is the **same shape** as the lesson from z109 (partial tikur fix is unfixed) — yesterday's tikur committed the spec for the lekach but landed it in a layer that didn't fire at the right moment. The incident recurs.

## Root cause — cluster-level statement

**Two faces, both leverable:**

1. **Content:** Slack's app-config redirect-URI list does not include `http://localhost:3000/api/slack/callback`. Either typo, wrong app, or wrong field. Not knowable without Lihu reading the live state.
2. **Process:** When external-system configuration is asserted by a human collaborator ("I did it"), trust-without-probe is the default unless a hook or handbook entry fires at the moment of trust. Yesterday's tikur named this exact pattern; the lekach landed in a memory file that didn't get consulted; the failure recurred ~24h later.

The content root cause is what produces the symptom; the process root cause is why the prior tikur didn't help.

## Fixes

### Immediate (this turn)

1. Surface a diagnostic question to Lihu to identify which variant of the content root cause: ask him to read the exact strings registered on the Slack app's "OAuth & Permissions → Redirect URLs" list. Once known, either (a) my code adapts to use the registered URL, or (b) Lihu corrects the registered URL to match my code's expectation. This unblocks the OAuth flow.
2. The OAuth init in playwright is closed; no client-side state to clean up. Server-side: a stale `slack_oauth_state` cookie may live on Lihu's browser; expires in 10 minutes regardless. No persistent damage.

### System (this turn)

**Move the lekach from `feedback_*.md` (deep memory) to `.claude/skills/use-gin/SKILL.md` (handbook).** Add a section "External-system configuration — probe before trust" that names the pattern and gives concrete probes for the most common cases (Slack OAuth, Linear webhooks, Unified.to redirect URIs). The handbook is loaded whenever Gin reads use-gin (which the `use-gin` skill description explicitly trains for: "the FIRST place to check when asking 'can Gin do X?'"). This places the lekach where retrieval actually happens.

Also: add a mini-probe primitive. For Slack specifically, a probe is *exactly the OAuth init dance I just ran in playwright* — it surfaces the redirect-URI mismatch in seconds, before the user is involved. Document that "running the OAuth init via playwright IS the probe" — no new tooling needed, just a different first-action.

### Tripwire (how recurrence is detected)

Three layers, increasing strength:

1. **Use-gin handbook entry** (this turn): the lekach is in the file Gin reads when on this topic. Recurrence is harder because the entry is impossible to miss when consulting the handbook.
2. **Diagnostic-probe-as-first-action** (this turn, in handbook): the probe is the OAuth init; it fires *before* Lihu is asked to drive the click. Recurrence shows up as "I tried it and Slack rejected" *to me*, not to Lihu.
3. **Tikur-skill self-tripwire sharpening** (z109 already specced this; *that* fix has not landed either — it is the third-order recurrence of the same pattern). Adding to the next-session list, not this turn.

## Lekach — what each artifact gets

Same turn, no later (z002):

| Artifact | Change |
|---|---|
| **`.claude/skills/use-gin/SKILL.md`** | Add section "External-system configuration — probe before trust" with the lesson + Slack OAuth probe + cross-link to `feedback_preflight_external_identifiers_in_dispatched_prompts` and yesterday's tikur. |
| **`feedback_preflight_external_identifiers_in_dispatched_prompts.md`** | Edit to point to the use-gin handbook entry as the canonical source. The memory entry remains as a back-pointer; the handbook is the front-door. |
| **This record** | Records all of the above + the cluster-level reading. |

## Distilled question for Lihu

**Diagnostic blocker for the content root cause:**

Read the exact strings in your Slack app at api.slack.com → "Effi Spike" → "OAuth & Permissions" → "Redirect URLs". Paste them verbatim — case, scheme (`http`/`https`), trailing slashes, all of it. If `http://localhost:3000/api/slack/callback` is not on the list, one of three things happened: typo, wrong app, or accidentally added elsewhere (e.g. "Allowed Domains" rather than "Redirect URLs"). Once we know the exact string, the fix is one of (a) you correct the URL Slack-side (~30 sec), (b) my code adapts to whatever URL is registered (~30 sec).

## Threading

Threads ↑2026-04-27-stale-client-ids-in-browser-prompt · ↑z109 (tikur self-tripwire — same shape, partial-fix-unfixed) · ↑z040 (clusters emerge) · ~`feedback_preflight_external_identifiers_in_dispatched_prompts` · ~`use-gin` skill (system-fix landing here) · ~`.claude/skills/tikur` (rule 5/step 6 self-tripwire still un-sharpened per z109).
