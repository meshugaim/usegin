# Sources — Oria

Primary-source evidence anchoring `../../oria.md`. Quotes verbatim from
session JSONLs in `~/agent-records/oria-masas/` and from git history
(real-human-Oria commits under `oria.masas.ai@gmail.com`, distinct from
the `oria-ai` autonomous-Gin proxy).

## Identity disambiguation (load-bearing)

Two distinct git authors share the "oria" name in this repo:

| Author | Email | What |
|---|---|---|
| `oria masas` / `orya meses` | `oria.masas.ai@gmail.com` | **Real human Oria.** Devcontainer fixes, integration test seed isolation, GFS upload tuning, public-routes allowlist, ESLint test-mock-hygiene. |
| `oria masas` (different) | `oria-ai@users.noreply.github.com` | **Autonomous-Gin proxy.** Lihu (or any agent) committing under the Oria handle for routing reasons (see `f5cadebeb|slack: rename [LIHU UNKNOWN] → [ORIA]`). Many Slack-research / evals / zisser-doctrine commits route here. NOT the human Oria. |

The persona file describes the **human Oria**. Sessions under
`~/agent-records/oria-masas/` are his interactive work.

## Session excerpts

### S1 — `oria-masas/2026-04-01/...txt` — SharePoint exclusion design
Long interrogation session about scope/exclusion semantics for
SharePoint files/folders/sites.

> "let's make sure we know what we want to happen when we de-check"
>
> "exclude = call the exclusion endpoint, that mark exclusion, and
> call the sync-delete endpoint / b - exclude, dont delete"
>
> "no — everything (also site) is 'call the de-scope endpoint (that
> descope this and all it's childs, and call the exclusin endpoint
> for all file chileds)"
>
> "i want an 'exclude file' endpoint that serves both single file
> and batch/loop descope (the descope is calling the exclude file
> for all files)"
>
> "anything to clarify?"
>
> "re-include — how does our app handle re-include?"
>
> "great. write spec to it and do it tdd with /liaison (not build
> liasion just liasion)"

Anchors: equation-style intent specs ("X = call Y, that does Z"),
single-responsibility-per-endpoint bias, "anything to clarify?" as
a check-before-shipping posture, terse approval ("great") + skill
directive.

### S2 — `oria-masas/2026-04-01/...` — Frontend complexity interrogation
Sub-thread of the same session.

> "folder still ommited?"
>
> "how can a user uncheck a folder taht was never checked"
>
> "help me understand why we had to write and delete code for that —
> i thought that check class an endpoint, that porpogate down and
> call the backgroundTask that also request sync, and uncheck also
> has 1 endpoint it calls, that propogate down, and call 'exlcude'
> endpoint that calld the request deleiton / it should be simple and
> idempodentic, but explain whay it need to know or care of the
> previous state of things?"
>
> "i dont understand what is that graph id we are talking about, and
> why we cant resolve the tree from the scope table that holds all
> the parent child relaitons"
>
> "but — file exclusion is calling the exclusion endpoint. nothing
> to change about scope / folder/lib/site — call the scope, it
> self-resolve the tree and the descoping, and need to figure out
> all the files to call exclusion for them (this might be more
> complex - but doable?)"
>
> "**why the froneted does this? our logic wasnt clear and you felt
> like the frontend need to do more things? explaon how we ended up
> here (must be a reason cause it isnt a shortcut — it's adding
> complexity for a reason i want to understand)**"
>
> "why the frontend can't simply pass the 'our side id' for
> exclusion? obviously it's something we has if we wanna exclude
> it.. ?"

Anchors: the *why-the-frontend-does-this* hallmark question; typos
preserved at speed (idempodentic, porpogate, froneted, explaon,
relaitons, ommited, deleiton); the simple-and-idempotent demand;
distrust-state-coupled-flows.

### S3 — `oria-masas/2026-04-17/064120-...4c9bf960...txt` — e2e drive-webhook wiring
Probing existing test wiring before authorizing changes:

> "check all the linear issues and sessions about drive webhook
> tests. there should be 2 e2e tests, one without real unified, one
> with. / a. see it? / b. what the current state of those tests?"
>
> "t1 - is running in ci?"
>
> "wire it into the e2e action, and let's see what we need to have
> t2 running nightly"

Anchors: numbered-question intake; checks-before-authorizing-changes;
"and let's see what" — incremental commitment.

## Commits — real human Oria

```
fe54d33ac feat: add Spotlight sidecar to local dev servers
07f3e2b99 fix(devcontainer): auto-detect URL mode instead of hardcoding codespaces
1721bd7cd feat(lint): add ESLint rule for integration test seed isolation (ENG-2660)
295975ce4 refactor(test): migrate integration tests from seed data to createTestWorld
3adb416ed feat(lint): add ESLint rules for test mock hygiene
171d31234 refactor(test): centralize mock.restore() in setup.ts, remove per-file calls
42969a2ab feat(gfs): reduce upload timeout to 2min with tiered polling intervals
987a4fc93 fix(gfs): add logging for dedup path, callback persist, and state check lookup
1c90b7576 fix(gfs): log initial upload response when doc ID not available pre-poll
619e774e0 feat(atuin): split history into personal (arrow up) and all (arrow left)
```

Pattern: infra/test/dev-env quality-of-life — distinct register from
both Lihu's doctrine commits and Nitsan's CLI-tooling commits.

## Zettel cross-refs

z088 (pour-and-process Oria too) — Lihu wrote a parallel zettel for
Oria's pour style after authoring z087 for himself.

## Open question for next refresh

Did not deeply sample 2026-04-08 through 2026-04-15 sessions — there are
~10 days of Oria sessions under `oria-masas/2026-04/` that this pass
only sampled the bookends of. Recommended: re-mine for failure-mode
specifics and a delight-trigger sample (none captured this pass).
