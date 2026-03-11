### 2026-03-11 — Linear Integration spec (ENG-2004), slices 1-2 implemented (session f35a8b4f)

**Verdict:** worked well
**Slices covered:** ENG-2578 (Grow tier spike), ENG-2579 (DB schema + RLS + feature flag)
**Note:** Partial evaluation — 2 of 7 slices implemented. Remaining slices (OAuth, MCP tools, system prompt, error handling) will test the spec further.

---

#### Success Signals

**Did the spec orient me well?**
- [x] Problem, scope, and constraints were clear enough to start without re-researching
- [x] Reference files were accurate and pointed me at the right code
- [x] Architecture decisions were sound — I didn't need to relitigate them

**Did the spec hold up as a contract?**
- [x] I didn't need to invent criteria beyond what the AC + test plan provided — *mostly; RLS test matrix was derived from the Drive pattern reference, which was sufficient*
- [~] No scope questions arose that the spec should have answered upfront — *minor: spec said "add to CHAT_TOOLS" but didn't detail the entry shape (cookie name convention, backendFlag field)*
- [x] No blocking decisions were left for me to figure out
- [~] No bugs trace back to behavior the spec left unspecified — *push failed due to hardcoded flag counts in unrelated tests; spec could have flagged this downstream impact*

**Did the spec stay out of my way?**
- [x] Spec didn't prescribe implementation details I had to work around
- [x] Test levels pointed me in the right direction without boxing me in
- [x] Spec left room to discover the right approach through the codebase

---

#### Key Observations

**What the spec got right:**
- Reference files were excellent. Every file existed and was relevant. The agent oriented by reading exactly what the spec pointed to — no hunting.
- Prior work section (experiment outcomes, SDK quirks table, "what we tried") was comprehensive. Zero re-research needed.
- Spike-first ordering was correct. Confirmed all 4 quirks still apply on Grow tier, validating the spec's assumptions before building on them.
- Schema design matched implementation almost exactly. The migration the agent wrote was a direct translation of the spec's table definitions.
- Soft delete decision was well-reasoned. The spec explicitly noted Drive's hard-delete gap (ENG-2029) and chose soft delete for Linear — clean implementation, no friction.
- Feature toggle section was clear and actionable. Single flag, clear on/off behavior table, correct placement in CHAT_TOOLS.
- The spec is one of the best in the codebase (noted in the lab's Ideas section from the March 2026 audit). This retro confirms it holds up during implementation.

**What slowed the agent down:**
- Adding `linearBrowse` to the CHAT_TOOLS registry broke 3 hardcoded test expectations (`chat-config-client.test.ts` count 7->8, `admin-chat.test.tsx`). The agent discovered this only when the push hook failed, after the handoff was already written. This led to out-of-scope post-handoff work. The spec's verification expectations for the feature flag slice didn't mention updating existing test counts — a minor gap but one that caused real friction.
- The spec said `linear_browse` goes in `CHAT_TOOLS` but didn't describe the registry entry format. The agent resolved this quickly by reading the registry, but a code snippet or reference to an existing entry would have saved one exploration step.

**What the agent added that wasn't in the spec:**
- 20 specific RLS test cases. The spec said "Follow the Drive RLS test pattern" — the agent derived the full matrix (owner CRUD x2 tables, non-owner blocked, external blocked, partial unique index enforcement, soft-delete row visibility). The spec's verification expectations were guidance-level, not prescriptive, which is the right level.
- Fix for downstream test count expectations — not in any AC or verification section.

---

#### Suggestions

- **Flag downstream test impacts in verification expectations.** When a spec adds an entry to a registry (CHAT_TOOLS, BROWSER_FLAGS), note that existing tests with hardcoded counts may need updating. This is a pattern — it'll recur for any new flag. A single line like "Check for hardcoded flag counts in existing tests" in the verification expectations would prevent surprise push failures.
- **Consider a "registry entry example" pattern.** When the spec says "add X to registry Y," a one-line example of an existing entry (or a pointer like "follow the `driveSearch` entry format") removes a grep step for the implementer.
- **Re-evaluate after slices 3-5.** The spec's real test is the OAuth flow, MCP tools, and system prompt slices — those are where architecture decisions and API contracts get stress-tested. This retro should be extended after those slices land.
