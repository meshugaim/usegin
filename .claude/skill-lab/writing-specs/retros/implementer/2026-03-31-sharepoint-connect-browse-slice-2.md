### 2026-03-31 — SharePoint connect + browse (ENG-4159, slice 2 of ENG-3886)
**Verdict:** worked well
**Key observations:**

**1. What did I have to figure out that the spec should have told me?**
- **Orphan parentId in delta tree.** The delta endpoint returns `parentReference.id` for every item. When the root folder is filtered out (has `"root"` key), root-level items still have a parentId pointing to the removed root. The spec said "filter out the root item (root=True)" but didn't warn about the orphan parent references this creates. This was the only bug in the implementation — caught during manual review, not by tests. A one-line note in the spec ("root-level items will have parentId pointing to the filtered root — remap to library node") would have prevented the issue entirely.
- **Provider filter fix needed in existing Drive code.** The user's task prompt mentioned this, but it wasn't in the ENG-4159 spec itself. The spec's "Depends on: ENG-4158" section could have noted that the existing Drive queries assume single-provider and need updating. This was proactively identified during planning, but if a different agent had picked up the spec cold, they might have missed it.

**2. What did the spec get wrong?**
- Nothing materially wrong. Architecture decisions (callback pattern, server actions, Python browse endpoints) all survived implementation unchanged.
- The spec suggested "API endpoints: GET /api/sharepoint/{project_id}/sites" etc. — these ended up being exactly right.

**3. What criteria did I add?**
- **Feature toggle.** The user added this requirement after reading the spec ("the integration UI component needs to be hidden behind a feature toggle"). Not a spec gap per se — it was a user requirement that came during the session. But the spec could have anticipated it: every other integration card (Fathom) is behind a toggle.
- **Provider filter fix.** Added as part of Step 2 — the spec didn't include this defensive measure.

**4. What bugs came from spec gaps?**
- The orphan parentId bug (described above). Root cause: spec described delta filtering but not its side effect on tree assembly.

**5. What did the spec prescribe that I had to ignore?**
- Nothing. The spec was appropriately high-level in implementation details — it pointed at patterns to follow (Drive callback, Drive server actions) without prescribing exact code.
- The experiment code references were excellent — every pattern in the experiment was directly portable.

**6. What did the spec get right?**
- **Experiment code as the source of truth.** The spec said "port from experiment's _graph()/_graph_url()" with exact line references. This made the Graph passthrough implementation trivial — proven patterns, not design from scratch.
- **Unified.to query param quirk.** Called out explicitly in the spec: "Query params MUST use Unified.to's query parameter, NOT URL query string (causes 401)." This single line saved potentially hours of debugging.
- **Reference files with line numbers.** The spec listed every key file with specific function/line references. The liaison could construct detailed worker prompts without additional exploration.
- **Seam contracts.** The spec's "Provides to: ENG-NEXT (slice 3)" section made it clear what this slice needed to deliver as an interface contract. The scope picker component was designed with this in mind.
- **"No sync, no downloads" scope boundary.** Repeated multiple times, preventing scope creep. Every worker prompt inherited this constraint.
- **Delta for tree loading.** The spec chose delta over per-folder Children queries — this was the right call. One API call returns the entire library tree.

**Summary:**
The spec was strong. Reference files, experiment code pointers, and the Unified.to quirk callout were the highest-value elements. The one gap (orphan parentId after root filtering) was subtle enough that it's hard to fault the spec — but it's the kind of integration-level detail that a "Gotchas" section could capture. Future SharePoint slices should add a "Known quirks" section for API behaviors that affect downstream code.
