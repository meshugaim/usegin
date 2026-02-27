# liaison — Skill Lab

## Intent

The primary orchestration skill for implementation work. Liaison delegates all execution to sub-agents while providing context, scope, and workflow safeguarding.

The skill exists because agents given implementation tasks will do everything themselves — read, write, test, commit — consuming context and losing architectural perspective. Liaison enforces a delegation model where the main thread never executes, only orchestrates. Sub-agents get focused tasks with explicit DoD, and verification agents confirm completion.

Unlike build-orchestrate (which manages a full lifecycle across phase types), liaison is focused on **implementation**: breaking work into slices, delegating to workers, verifying, committing, pushing. It's often spawned *by* build-orchestrate as the implementation phase orchestrator.

Success means: slices completed sequentially, each verified against DoD, code committed and pushed by liaison (not workers), no integration bugs from divergent assumptions.

## Success Signals

When retroing a session that used this skill, a good session looks like:

- [ ] Liaison never wrote code, ran tests, or edited files directly
- [ ] Liaison never used Grep/Glob to explore code (delegated to agents)
- [ ] Work was broken into small sequential slices (not parallelized unless user requested)
- [ ] Each slice had explicit DoD (empirical + non-empirical criteria)
- [ ] Each slice had a verification agent after implementation
- [ ] Sub-agents were told "do NOT commit or push" — liaison handled commits
- [ ] Commits were small, frequent, mentioned Linear issue
- [ ] Sub-agent prompts included: error handling expectations, complete file list, affected test files
- [ ] For data-layer changes, liaison grepped consumers before delegating (consumer audit)
- [ ] Autonomy level was calibrated with user at start and re-calibrated at phase transitions
- [ ] Linear issues were started/closed as work progressed
- [ ] Feature toggles were separate slices using the `/feature-toggles` skill (not embedded)
- [ ] Retro was triggered proactively (after closing issue, after 5+ commits, after friction)
- [ ] Sub-agent prompts included the guardrails (orient before acting, recognize spinning, escalate over stubbornness)

## Known Limitations

- **Consumer audit is manual.** The skill says "liaison MUST grep for all consumers" but this is a rule the liaison has to remember, not something enforced. Easy to forget on small-seeming changes.
- **Sequential-only is slow.** The hard rule against parallelization (motivated by ENG-2002 retro) is correct but painful for large features. The parallel-with-contracts option exists but is complex.
- **Verification agents can be shallow.** "PASS" from a verifier doesn't mean the work is good — it means the verifier's checks passed. If the DoD was vague, the verification is vague.
- **No guidance on slice size.** "Small steps" is subjective. Agents sometimes create slices that are too large (touching 10+ files) or too small (single-line changes that don't need their own agent).
- **Retro scope creep.** The skill tells liaison to spawn retros proactively, but retros consume context and time. In practice, retros after every issue close may be too frequent.
- **The skill is long (~210 lines).** After context compaction, the agent may lose nuances like the consumer audit rule or the feature-toggle-as-separate-slice pattern.

## Retro Guide

When the `skill-retro` skill triggers a retro for liaison, follow this evaluation process:

**1. Check for role collapse**
Scan the session for liaison thread tool usage. Flag any use of Edit, Grep, Glob, or direct code manipulation by the liaison. The liaison should only use: Task (spawn agents), Read (to review agent summaries or check git status), Bash (for git operations — commit, push, status, diff), and text output.

**2. Check slice discipline**
Were slices sequential? Was each slice small and focused? Did each have explicit DoD before delegation? Were verification agents spawned after each slice?

**3. Check sub-agent prompt quality**
Did prompts include: error handling expectations, complete file list, affected test files, guardrails (orient/spinning/escalate)? For data-layer changes, was a consumer audit done before delegating?

**4. Check commit discipline**
Did the liaison commit (not sub-agents)? Were commits small and frequent? Did they mention Linear issues? Was code pushed regularly?

**5. Check workflow safeguarding**
Were Linear issues started/closed? Was autonomy calibrated with the user? Were feature toggles handled as separate slices?

**6. Check integration quality**
If multiple slices touched related code, were there integration issues? Did the sequential approach prevent them, or did issues slip through?

## Ideas / Notes

- Liaison is the most-used orchestration skill. It's spawned by build-orchestrate, by users directly, and by other workflows. Its quality has outsized impact.
- The sequential-by-default rule was added after the ENG-1624 Drive integration disaster (8 parallel slices, 1.5 days of integration bugs). ENG-2002 retro confirmed sequential was better. This is a hard-won lesson — resist pressure to parallelize.
- The "liaison commits, not agents" rule prevents agents getting stuck on push rejections and hook failures. It also gives the liaison a natural review point (git diff before committing).
- The consumer audit rule ("grep for all consumers before delegating data-layer changes") was learned from agents missing downstream consumers. Worth watching if this is actually followed.
- Should liaison have an Auto-Inject block like the director skills? It doesn't currently have one. The skill is loaded into the agent's context directly (unlike build-orchestrate where the director re-reads). May be worth adding if liaison sessions hit context compaction.

## Changelog

| Date | Change | Motivation |
|---|---|---|
| (pre-lab) | Sequential-by-default rule added | ENG-1624 parallel integration disaster, confirmed by ENG-2002 retro |
| (pre-lab) | "Liaison commits, not agents" rule | Agents getting stuck on push rejections and hook failures |
| (pre-lab) | Consumer audit rule for data-layer changes | Agents missing downstream consumers of changed APIs |
| (pre-lab) | Feature toggles as separate slices | Agents scoped to one context miss the cross-repo pipeline (ENG-?) |
| (pre-lab) | Context Guard (--context-guard) | Sessions hitting compaction without warning |
| 2026-02-27 | Restructured lab: split retros into individual files under `retros/` | Single-file lab structure doesn't scale as retros accumulate. |
