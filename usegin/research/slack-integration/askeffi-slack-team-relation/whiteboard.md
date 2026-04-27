## Top — the click

**They collapse. Angle E disappears as a separate build.** "AskEffi-Slack for the team" *is* angle C (the customer 1-channel↔1-project integration) installed on the team's own AskEffi tenant — the same code path, the same DB rows, the same OAuth, the same sync workers. Every distinction we considered (scope, RLS, auth, write-back) is either non-existent in our model, already a non-feature today (Drive, Fathom, Linear, SharePoint are all 1-project scoped — Slack would inherit that shape), or a *separate* product question that is not specific to the team being the tenant. The only thing left over is *one* genuine non-overlap: a Gin-mediated team R/W surface, and that's already its own angle (D, UseGin-Slack). Recommend dropping E from the round and routing its leftover energy into D.

## Middle — the body

### Side-by-side: customer (C) vs team-on-our-tenant (would-be E)

| Dimension | C — customer surface | E — team on our own tenant | Verdict |
|---|---|---|---|
| **Tenant** | A customer workspace | The AskEffi Workspace (`f757a1a3-…`) | Same column value, different UUID. Code-identical. |
| **Project scope** | 1 channel ↔ 1 project | 1 channel ↔ 1 project | Identical. Drive/Fathom/Linear are also 1-project-scoped today (`linear_integration.project_id REFERENCES projects(id)`). The team would *use* it the same way — "AskEffi App (really)" is a single project. |
| **Ingestion shape** | Channel msgs → data items → indexed | Same | Identical. |
| **Backfill** | Per-channel historical pull | Same | Identical. |
| **Write-back / Effi posts in Slack** | Open product question (the customer want this?) | Open product question (do *we* want this?) | The question exists in BOTH worlds. It's not a team-vs-customer distinction; it's a feature-shape distinction (read-only vs bidirectional). Belongs in C, not E. |
| **Auth** | Bot OAuth on customer's Slack workspace | Bot OAuth on AskEffi's Slack workspace | Same OAuth flow. The team having "admin access" to its own Slack is a property of the *Slack tenant*, not of our integration. The integration sees what the bot scopes let it see — same as for a customer admin connecting their own workspace. |
| **RLS / access tier** | Internal vs external; Slack content default-internal until labeled | Per `project_zettel_no_privacy.md`, dev-team UseGin/Zettel is fully shared — but that's the *Zettel sub-app*, not AskEffi's RLS. The team's AskEffi project still uses normal AskEffi RLS. | The team-zettel "no privacy" rule is specific to `usegin/zettel/` (a separate sub-app). It does NOT propagate to AskEffi data items. The team using AskEffi *is* a customer of AskEffi w.r.t. RLS. |
| **DB schema** | `slack_integration` table, `project_id FK` | Same row, with `project_id = 1bf0f507-…` | Literally one row in the same table. |
| **Code path** | `/api/slack/callback`, sync worker, etc. | Same | Identical. |
| **Surface for "all team Slack searchable across all team projects"** | N/A — customers have one channel per project | Hypothetically nice ("workspace-wide ingest") but **not how AskEffi is shaped**. Workspace doesn't have data items. Data items belong to projects. | This *would* be a distinct E if we wanted it. But it requires re-architecting AskEffi's data model (workspace-level data items), which is a much bigger product change than "add Slack." Not in scope of a Slack-integration round. |

### Where the framing came from, and why it dissolves

The user's framing put #3 (AskEffi-Slack-for-the-team) side-by-side with #1 (customer-channel-binding) because intuitively they *feel* different — "us" vs "them." But once you check the four candidate distinctions:

1. **Different scope (team-wide vs per-channel)** — would require workspace-level data items. Not a Slack question, not in this round.
2. **Different ingestion (cross-project search)** — same as 1, requires data-model change.
3. **Different write-back (Effi posts replies)** — exists symmetrically for customers. Not E-specific.
4. **Different auth (admin)** — admin status lives in Slack, not in our integration. We see what bot scopes give us either way.
5. **Different RLS (no privacy)** — only true for `usegin/zettel/`, not for AskEffi data items. Team's AskEffi project follows AskEffi RLS like any other.

All five collapse. None survives as a distinguishing axis.

### What the team *will* do that customers won't — and where it actually lives

The genuinely team-specific Slack-shaped wants are:

- **Gin reads/writes Slack on our behalf** — "Gin, post in #engineering that staging deployed." That's **angle D (UseGin-Slack)**. Different actor (Gin, not Effi), different mediation pattern (CLI/skill, not connector sync), different write semantics (commands, not chat replies).
- **Cross-project knowledge from Slack** ("what did Lihu say in #design last Tuesday across all projects") — not solvable by today's per-project Slack integration regardless of who the tenant is. Either we accept the per-project limit (and the team uses one big project, like we do with "AskEffi App (really)" today), or we change AskEffi's data model. The latter is out of scope.
- **Frictionless dogfooding** ("install once, free, no rate-limit fear") — operational, not architectural. If the customer integration costs us per-team installation, that's a billing/ops detail, not a separate code path.

Everything left in the "team-flavored" pile is either D's or operational, not a build.

### Cost of either choice

**Collapse (recommended):** Drop angle E. Round goes from 8 → 7 angles for synthesis. C's whiteboard inherits the team-as-customer perspective as a *dogfooding section* (one paragraph: "the team installs this on its own tenant the same way; that's how we'll use it; no separate code"). Zero ongoing cost, one less artifact to maintain.

**Keep them as two:** Forces angle C and a (would-be) angle E to invent differences to justify themselves. Likely outcomes: duplicate sections in two whiteboards, eventual confusion in synthesis ("which whiteboard owns the dogfooding bit?"), and an implicit invitation to over-engineer team-only paths that customers won't get. Cost: complexity tax on synthesis + reasoning, with no compensating distinct artifact in code.

### Diff vs Drive/Fathom/Linear precedent

The precedent is unambiguous. None of Drive, Fathom, Linear, or SharePoint has a "team-flavored" twin integration. The team uses Drive on its own AskEffi project the same way customers do — same OAuth callback (`/api/drive/callback`), same `drive_integration` row, same sync worker. The "team-uses-Effi-on-its-own-tenant" pattern *is* the dogfooding-effi skill, and that skill already presumes the team is a customer at the integration boundary. Slack would slot in identically.

The only place this pattern *did* surface a real wrinkle is Fathom — `project_fathom_per_recorder_scoping.md` — and that wrinkle is *the same wrinkle for customers and for the team* (per-recorder OAuth ≠ team coverage). Confirms the symmetry: team-as-customer hits the same edge cases customers do.

## Bottom — the open ends

### Dilemma 1 — Where does the "Effi posts replies in Slack" question live?

**Decision needed:** With angle E collapsed, where does the read-only-vs-bidirectional question (Effi answering questions in #channel) live in the synthesis?

**Options:**
- **A.** Keep it strictly inside angle C as a sub-decision of the customer surface. Team inherits whatever C decides.
- **B.** Lift it to SYNTHESIS.md as a cross-cutting product decision, since the team's adoption pressure on the answer may differ from the customer's (the team will scream sooner if Effi can't answer in Slack).
- **C.** Split: read-only in C (customer); team gets bidirectional via D's Gin-mediated path (Gin types Effi's answer into Slack), explicitly *not* via the Effi connector.

**Gin's lean:** **C.** The team's "Effi-answers-in-Slack" want is naturally satisfied by Gin (already Slack-aware in D, already Effi-aware via dogfooding-effi). Customers get a clean, scoped, read-only Slack ingest. Bidirectional-via-Effi-bot becomes a *future* customer feature, not MVP.

**Why:** keeps C scoped, defers a hard product question (when does Effi reply unprompted?), and exploits D's existing Gin-mediation surface. Two birds.

**Price:** Customers don't get bidirectional Effi-in-Slack at MVP. They have to wait, or use Slack→email→Effi loops.

**Risk:** A flagship customer asks for bidirectional and we lose the deal because we deferred.

**For you to weigh:** sales/customer-impact judgment + how loudly the team will demand it before D ships.

### Dilemma 2 — Should the team's Slack actually live in *one* AskEffi project, or N?

**Decision needed:** Today the team uses one big AskEffi project ("AskEffi App (really)"). Slack-per-project means each Slack channel becomes a project? Or one Slack workspace = one project, with all channels piling into it?

**Options:**
- **A.** Strict: 1 channel ↔ 1 project. Team would create N projects (one per important Slack channel). Painful.
- **B.** Loose: 1 Slack workspace ↔ 1 project. All channels' messages flow into one project's data items, channel name becomes metadata. Conflicts with C's "per-channel binding" framing.
- **C.** Hybrid: per-channel binding is the unit, but a single project can hold *multiple* channel bindings. ("AskEffi App (really)" gets bound to #engineering AND #design AND #product.)

**Gin's lean:** **C.** Multi-channel-per-project. Doesn't break C's binding model (binding is still 1 channel ↔ 1 project on the channel side); just lifts the unique constraint on the project side. Lets the team bind 5 channels to one project; lets a customer bind 1 channel to 1 project; same code.

**Why:** preserves the C model, accommodates real team usage, and is a *strict superset* of strict 1↔1. Costs almost nothing in schema (drop a UNIQUE on `project_id` in `slack_integration` — keep one on `channel_id` if Slack channels can only feed one project at a time).

**Price:** UI slightly more complex (project page lists N channel bindings instead of 0 or 1).

**Risk:** Customers see multi-channel UX and expect cross-channel merging logic that we haven't built; or RLS gets harder when one project pulls from several channels with potentially different access semantics.

**For you to weigh:** UX taste — does "a project's Slack" feel like one channel or many? And whether the team's likely usage (many channels, one project) is a representative customer pattern or a quirk.

### Friction zettels (none filed)

No new friction surfaced during this charter execution. The framing question dissolved cleanly on inspection — the four/five candidate distinctions all map to either non-distinctions or to other angles. Did not invoke `dx zettel add`.

### Gaps

- I did not check whether Slack's OAuth scope model has team-vs-non-team asymmetries (e.g., `admin.*` scopes that only an admin can grant). If yes, the team's install would let us access more (Slack-admin-only data) than a customer's typical install. That's still not a separate *build* — it's a per-install scope question. Flagging for angle B (slack-direct-platform) and angle H (auth-identity-cardinality).
- I did not validate "the team will scream for Effi-replies-in-Slack" against actual team behavior. That would be an effi-session-audit follow-up, not in scope here.
