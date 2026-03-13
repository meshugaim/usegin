### 2026-03-13 — Linear Integration spec (ENG-2004), slice 4 implemented (session 0e981c2b)
**Verdict:** worked well
**Slices covered:** ENG-2581 (project scoping + config modal)
**Note:** Continuing evaluation from 2026-03-11 (slices 1-2). Slices 3 (ENG-2580, OAuth) was done in session c66968de. This covers slice 4.

---

#### Success Signals

**Did the spec orient me well?**
- [x] Problem, scope, and constraints were clear enough to start without re-researching
- [x] Reference files were accurate and pointed me at the right code
- [x] Architecture decisions were sound — I didn't need to relitigate them

**Did the spec hold up as a contract?**
- [x] I didn't need to invent criteria beyond what the AC + test plan provided
- [x] No scope questions arose that the spec should have answered upfront
- [x] No blocking decisions were left for me to figure out
- [x] No bugs trace back to behavior the spec left unspecified

**Did the spec stay out of my way?**
- [x] Spec didn't prescribe implementation details I had to work around
- [~] Test levels pointed me in the right direction without boxing me in — *but agent ignored them entirely (see below)*
- [x] Spec left room to discover the right approach through the codebase

---

#### Key Observations

**What the spec got right:**
- The spec's "Multi-project scoping" section mapped directly to implementation. The soft-delete pattern (`removed_at`), the scope table design, and the re-selection behavior were all clear and correct.
- Reference files (Drive config modal, `project-drive.ts` actions, `unified_client.py`) were accurate and provided the exact patterns to follow.
- The feature toggle gating was correctly specified — the modal is only reachable when the card is visible (flag on), so no separate flag check needed in the modal.
- The Unified.to SDK quirks (pagination cap, dedup across pages) from the prior work section were still relevant and guided the `list_projects` implementation.

**What slowed the agent down:**
- **Threading `linearConnectionCreatedAt` through the component tree.** The agent spent several turns figuring out how to pass the connection timestamp from `page.tsx` → `project-config-client.tsx` → `integrations-tab-content.tsx` → `LinearIntegrationCard`. The spec described the modal's behavior but not the data flow needed to display "connected since" info. This isn't a spec gap per se — it's an implementation detail the spec shouldn't prescribe — but the spec's "UI > Config modal" section could have noted "the card should show connection metadata" as a soft hint.
- **Pre-existing test failures blocked push.** Same pattern as slice 2 (noted in previous implementer retro). The `workspace-data-provider.test.tsx` failures are a test isolation issue unrelated to this work but consumed context investigating.

**What the agent added that wasn't in the spec:**
- Nothing significant. The slice AC was comprehensive enough. The agent implemented what was specified without discovering gaps.

**What verification expectations the agent ignored:**
- The slice specified 4 verification items at specific levels: browser integration (project picker rendering), DB integration (scope persistence + soft delete), DB integration (re-selection), and unit (list_projects). The agent only wrote unit tests (5 tests for `list_projects`). The browser and DB integration tests were never written. The spec's verification expectations were good but the agent didn't follow them — this is an implementing-specs process failure, not a spec quality issue.

---

#### Suggestions

- **Flag pre-existing test failures as a known risk.** The March 2026 retros have now logged this twice (slice 2 and slice 4). If there are known flaky or broken tests, note them somewhere so agents don't waste context investigating.
- **Previous suggestion still stands:** Re-evaluate after slices 5-7 (MCP tools, system prompt, error handling). Those slices test the spec's architecture decisions more deeply.
