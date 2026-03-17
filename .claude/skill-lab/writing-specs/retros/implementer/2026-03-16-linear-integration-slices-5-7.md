### 2026-03-16 — Linear Integration spec (ENG-2004), slices 5-7 implemented (session cd69b434)
**Verdict:** partially held up
**Slices covered:** ENG-2582, ENG-2583, ENG-2584 (MCP tools, system prompt, error handling)
**Note:** Final implementer retro for ENG-2004. Covers the MCP tool core, system prompt, and hardening slices. Previous retros: slices 1-2 (2026-03-11), slice 4 (2026-03-13).

---

#### Success Signals

**Did the spec orient me well?**
- [x] Problem, scope, and constraints were clear enough to start without re-researching
- [x] Reference files were accurate and pointed me at the right code
- [~] Architecture decisions were sound — *mostly*, but see below for the scoping model failure

**Did the spec hold up as a contract?**
- [x] I didn't need to invent criteria beyond what the AC + test plan provided
- [ ] **No scope questions arose that the spec should have answered upfront** — FAIL. The project-scoping model turned out to be fundamentally broken for the actual workspace (see below)
- [x] No blocking decisions were left for me to figure out
- [ ] **No bugs trace back to behavior the spec left unspecified** — FAIL. The scoping bug is a design-level failure, not implementation

**Did the spec stay out of my way?**
- [x] Spec didn't prescribe implementation details I had to work around
- [x] Test levels pointed me in the right direction without boxing me in
- [x] Spec left room to discover the right approach through the codebase

---

#### Key Observations

**What the spec got right:**

1. **Reference files were perfect.** The spec listed `data_browse_tool.py`, `unified_client.py`, `agent.py`, `effi_system_prompt.py`, `agent_factories.py`, and the experiment code at `experiments/unified-integration/lib/linear.py`. The implementing agent used every single one of these as reference. No dead references, no missing references.

2. **MCP tool design was precise.** Tool names, parameters, return format, context budget — all matched the existing patterns and required minimal design decisions during implementation. The agent ported from the experiment code exactly as the spec described.

3. **SDK quirks documentation saved time.** The "Context & Prior Work" section with the 4 quirks table (pagination cap, broken status filtering, priority normalization, project list dedup) and the Grow tier validation confirmation meant the implementer didn't need to rediscover these at runtime. All workarounds were ported as-is.

4. **AC coverage was comprehensive.** 25 criteria covering happy path, error cases, edge cases, and kill-switch verification. The verify-spec agent found 23/25 passing, 2 blocked only by live OAuth requirements (expected). No invented criteria were needed.

5. **Test levels were accurate.** Unit for tools and client methods, integration-DB for RLS, browser for UI flow — the implementer followed these and they were the right choices. 33 unit tests written, all at levels the spec suggested.

6. **Feature toggle strategy was correct.** Single `linear_browse` flag gating everything. Clean, enforceable, verified by AC-25. No partial-enablement confusion.

7. **Slice ordering was well-thought.** Spike → infrastructure → connection → tools → hardening. The implementer followed it exactly and never needed to backtrack or reorder.

**The critical spec failure: project-scoping model**

The spec's architecture section states: *"Project scoping is enforced at the application layer"* — tools filter by `remote_project_id` from `linear_project_scopes`. The entire scoping model (project picker, scope table, tool filtering) assumes users organize Linear issues into Linear projects.

**In the actual workspace, 0 out of 2,120 issues are assigned to any project.** All issues live at the team level. The project picker shows 1 project, but selecting it scopes Effi to zero tasks because no tasks have a `project_id`.

This was discovered during manual E2E verification (the user connected their real Linear account). An investigation agent confirmed:
- `list_task_projects` returns real Linear projects (not teams)
- All 2,120 tasks have `project_id: None`
- Unified.to has no `list_teams` endpoint
- Teams can be discovered from `group_ids` on tasks
- Querying without a `project_id` filter returns all tasks

**Root cause:** The spec validated the data model against the experiment code but never validated the **assumption that users organize work into Linear projects.** The experiment's `list_projects` call returned data, so the spec assumed projects were the right scoping unit. The spec should have asked: "Do users actually put issues in Linear projects, or do they just use teams?"

This gap resulted in a follow-up sub-issue to add team-level scoping. The fix is non-trivial: new DB column (`scope_type`), modified picker UI, modified tool filtering logic, team discovery from task `group_ids`.

**What the spec got wrong:**

1. **Assumed Linear projects == how users organize work.** This is the big one. The spec should have included a "scoping model" as a risk/unknown during the spike (slice 1) rather than treating it as settled architecture.

2. **No mention of teams as a scoping concept.** Linear has both projects and teams. The spec only discusses projects. A thorough spec would have noted: "Linear organizes work in teams (mandatory) and projects (optional). This integration scopes by project. If users don't use projects, they won't see their issues. Consider supporting team-level scoping as a future extension."

3. **Slice map status was stale.** The spec file still shows slices 3-7 as "In Progress" or "Pending" even though all are Done. This is a cosmetic issue — Linear was the source of truth — but future agents reading the spec file would be confused.

**What the agent added that wasn't in the spec:**

- Nothing significant for slices 5-6. The spec's AC was comprehensive.
- For slice 7 (error handling), the agent recognized that defensive patterns were already built into slices 5-6 and wrote verification tests instead of redundant code. Smart implementation choice, consistent with the spec's intent.

**What made implementation easier compared to earlier slices:**

- The experiment code provided a working reference for every SDK call. Porting from experiment → production is the ideal spec workflow: prove it works in isolation, then spec the production integration.
- The 1M context window meant the agent could hold the entire spec + all reference files + tests in context simultaneously. No re-reading, no handoffs, no lost context.

---

#### Spec-Level Verdict

**ENG-2004 is a good spec with one critical blind spot.** It excelled at reference documentation, AC coverage, test level guidance, and slice ordering. It failed at validating its core architectural assumption (project-based scoping) against real-world usage patterns.

The fix: specs that introduce scoping/filtering models should include a validation step in the spike slice. Not "does the API return data?" but "does the scoping concept match how users actually organize their work?" For integrations with external tools, this means checking the data model against a real account, not just the API documentation.

#### Suggestions

- **Add a "scoping model" section to the spec template for integrations.** When a spec introduces a scoping/filtering concept (which projects/folders/channels Effi can see), require the spec author to validate the concept against at least one real account before finalizing. "Does the scoping unit match how users organize work?" is the question.
- **Update the Grow tier validation spike to include scoping validation.** The spike (ENG-2578) validated SDK quirks but not the data model assumptions. Future integration spikes should include: "Query a real account. What entities exist? Do users actually use [the entity we plan to scope by]?"
- **Mark the spec file as complete.** The slice map in the .md file should be updated to reflect that all 7 slices are Done, plus note the team-scoping follow-up. Currently it shows stale statuses.
