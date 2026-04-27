# Refiner 02 — Cluster B (autosync never resets) + Cluster H (recovery as one command)

**Slice:** i06–i10, i35–i37 (8 ideas)
**Refiner:** 02
**Date:** 2026-04-27

## Per-idea refinements

---

### i06 (refined)

**Title (refined, ≤10 words):** Autosync never resets — push failure surfaces, never destroys

**One-line:** Remove every `git reset HEAD~1` (and any `--hard`/`--mixed` form) from autosync code paths; on push failure surface the error, leave the commit in place, and let the human or a separate dx command decide.

**Why:** This 2026-04-27 session had 4 commits eaten by autosync's `reset HEAD~1` on push-rejection — reflog showed `HEAD@{...}: reset: moving to HEAD~1` four times. The reset itself is the loss vector. Deleting that single call removes the entire class of "autosync ate my work." All other ideas in this cluster (i07/i08/i09/i10) make the survived-commit *recoverable or progressable*; i06 alone makes it survive.

**Cost-to-try:** small (find the call site, delete it, replace with `console.error` + nonzero exit; <1 day)

**Reversibility:** easy (single-commit revert if surfaced errors prove unworkable)

**Prerequisites:** none — works alone. Strictly improved by pairing with i07 (orphan-park) or i20 (`dx ship` wrapper).

**Blast radius:** dev-loop (autosync hook only — production code untouched)

**Refiner notes:** This is the load-bearing 5/5 idea of the entire pool alongside i01. Every ideator independently named "stop resetting" — that level of convergence promotes it from "pick" to "do this regardless of what else we pick" (memory: `feedback_multi_reviewer_convergence`). All other Cluster B ideas (i07–i10) presuppose i06 — they describe what to do *instead of* resetting. If i06 ships and nothing else in B does, the loss vector is closed; if i07–i10 ship without i06, the reset still races them.

---

### i07 (refined)

**Title (refined, ≤10 words):** On push failure, park commit on `gin/orphan/<sha>` side-branch

**One-line:** When `git push origin main` is rejected, push the same commit to a server-side ref `refs/heads/gin/orphan/<short-sha>` instead, so the commit survives on the remote and is greppable from any env.

**Why:** Local-only survival (i06's "leave it alone") is fragile — the local checkout can be wiped, the dev container can rebuild, another agent can reset over it. Remote side-branch park makes the commit durable across machines and discoverable via `git ls-remote origin 'refs/heads/gin/orphan/*'`. Cheap: one extra `git push` line. Aligns with memory `reference_autosync_concurrent_collisions` — verifying origin/main contents stops being the recovery contract; the commit is *somewhere* on origin, always.

**Cost-to-try:** small (single `git push origin HEAD:refs/heads/gin/orphan/$(git rev-parse --short HEAD)` line in the autosync error path)

**Reversibility:** easy (revert; abandoned orphan refs are harmless and can be GC'd)

**Prerequisites:** i06 (don't reset). Harmonizes with i20 (`dx ship` wrapper as the central place to encode this) and i37 (hash-chain naming → orphan-branch naming converge).

**Blast radius:** dev-loop + creates new server-side refs under `refs/heads/gin/orphan/*` (no impact on `main`, `staging`, `production`).

**Refiner notes:** Naming question: `gin/orphan/<sha>` (matches brainstorm) vs `gin/abandoned/<sha>` (ideator-02) vs `gin/quarantine/<sha>` (ideator-05). All semantically equivalent; pick at spec time. Refs/heads vs refs/gin/* tradeoff: `refs/heads/` is universally browsable in `gh`/web UI; `refs/gin/*` keeps the namespace clean but is invisible to most tools. Lean toward `refs/heads/gin/orphan/*` for findability.

---

### i08 (refined)

**Title (refined, ≤10 words):** Tombstone-and-revive — every reset writes `refs/gin/tombstones/<sha>` first

**One-line:** Wrap any code path that destroys a commit (reset, branch-D, etc.) in a tombstone-write: create `refs/gin/tombstones/<sha>` pointing at the doomed commit; refuse the destructive op if the tombstone-write fails. `dx revive <prefix>` lists tombstones and one-command-restores.

**Why:** Defense-in-depth atop i06. Even if some future code path (or human typo) calls `git reset` directly, the tombstone wrapper catches it. Soft-delete pattern — commits are never lost, only marked inactive. `dx revive` turns "investigation" into "menu pick" (overlaps with i35's frame; tombstones are a structured subset of reflog).

**Cost-to-try:** medium (1-3 days — needs the wrapper, the `dx revive` command, the listing UI, and integration tests with reflog interplay)

**Reversibility:** easy (the tombstones are write-only refs; remove the wrapper to revert)

**Prerequisites:** i06 (don't reset by default). i35 (`dx recover`) — tombstones become a structured input to the recovery menu, sharpening i35's signal-to-noise vs raw reflog.

**Blast radius:** dev-loop + telemetry (the tombstone refs are observable telemetry of how often we try to destroy work).

**Refiner notes:** Tombstone-and-revive is *the* well-known soft-delete pattern (databases, file systems, message queues). 2/5 convergence undersells it because only ideator-02 used the literal word; ideator-04's "blame-free reset" is the same pattern. Strong overlap with i35 — if i35 ships, tombstones become its primary index and reflog becomes the fallback.

---

### i09 (refined)

**Title (refined, ≤10 words):** CAS push loop — read, rebase, retry; never reset

**One-line:** Replace push-fail-then-reset with a compare-and-swap loop: read `origin/main` SHA, ensure HEAD is on top of it (rebase if not), `git push --force-with-lease=origin/main:<seen-sha>`; on lease-fail re-read and retry up to N times.

**Why:** CAS is the universal primitive for safe concurrent updates. The push-rejection that motivates `reset HEAD~1` is itself a CAS failure; the right response is "retry the CAS," not "throw away the work." Bounded retry with backoff handles the multi-agent storm naturally — eventually a window opens.

**Cost-to-try:** medium (1-3 days — CAS loop, rebase logic, retry/backoff, ensuring rebase doesn't pick up stranger files mid-loop)

**Reversibility:** hard (changes the central push semantic; rolling back means re-introducing reset-on-fail, which is exactly what we're killing)

**Prerequisites:** i06 (no reset). i16/i17 (stage only authored files) — without them, the rebase step can sweep stranger files into the retried commit and we've reproduced Mode-1 collision inside the CAS loop.

**Blast radius:** dev-loop. `--force-with-lease=origin/main:<seen-sha>` is safe (it's a guarded force, not raw `--force`), but every push now becomes a force-with-lease; that warrants explicit human approval per CLAUDE.md ("NEVER force-push to any branch") — needs a carve-out or a renamed guarded primitive.

**Refiner notes:** The CLAUDE.md "NEVER force-push" rule was written when the only force-push is the dangerous kind. `--force-with-lease=origin/main:<sha>` is structurally a CAS, not a force. Spec time should clarify and codify the carve-out — otherwise i09 collides with the doctrine. Pairs naturally with i20 (`dx ship` is the place this lives).

---

### i10 (refined)

**Title (refined, ≤10 words):** Last-words log — dump diff before any destructive op

**One-line:** Before any destructive git op (reset, branch-D, force-push, gc), dump `git diff <doomed>~1 <doomed>` and the doomed commit's metadata to `~/.dx/last-words/<sha>.diff`; survives even if reflog GC's the commit.

**Why:** Belt-and-suspenders for reflog. Reflog is fragile — it expires, it's repo-local (not synced across envs), it's noisy. A friendly path with one diff per doomed-sha is grep-able, scp-able, and human-readable. Cheap insurance even after i06/i07/i08 ship — defenses compose.

**Cost-to-try:** small (file-write hook in the destructive-op wrapper; <1 day)

**Reversibility:** easy (delete the wrapper; `~/.dx/last-words/` is harmless)

**Prerequisites:** i06 makes the destructive ops rare; i08 makes them tombstoned. i10 is the on-disk human-friendly view that survives both.

**Blast radius:** dev-loop only. Disk usage grows linearly with destructive-op count — needs a retention policy at spec time (rotate after 30 days? cap at 100MB?).

**Refiner notes:** Single-source from ideator-03 — pairs the structural fix (i06–i08) with the observability frame (Cluster I). Strongest as a complement, weakest as a standalone (because i06 already kills the loss vector — last-words then has nothing to record).

---

### i35 (refined)

**Title (refined, ≤10 words):** `dx recover` — menu of last-N reflog/tombstone entries with diffstat

**One-line:** `dx recover` (alias `dx unreset`) lists the last N reflog entries and tombstone refs with diffstat + commit message + timestamp, prompts "restore which?", and cherry-picks the chosen commit back onto HEAD.

**Why:** All four lost commits this session were in reflog the whole time — investigation, not infrastructure, was the bottleneck. Turning recovery into a menu pick collapses minutes-of-detective-work into seconds-of-arrow-keys. `feedback_verifier_query_external_state` analog: when the question is "what state exists?" the answer should be a query result, not a reasoning chain.

**Cost-to-try:** small (parse `git reflog` + tombstone refs, format with diffstat, interactive picker; <1 day)

**Reversibility:** easy (it's a read-mostly tool that ends in `git cherry-pick`; user can abort)

**Prerequisites:** none for v0 (reflog alone). Sharper with i08 (tombstones) feeding it structured entries. Sharper with i36 (commit-eats DB) feeding it cross-session history. Sharper with i10 (last-words) for diff-content view.

**Blast radius:** dev-loop only — purely a recovery surface, doesn't change push or commit behavior.

**Refiner notes:** 4/5 convergent — every ideator independently said "recovery should be one command, not a tutorial." The implementation is uncontroversial; the design choice is which sources feed the menu (reflog only, or reflog ∪ tombstones ∪ commit-eats ∪ orphan-branches). Recommend: ship v0 with reflog-only, expand sources as i08/i36/i07 land. Aligns with `feedback_grep_jsonl_directly` posture — give the human the raw findability surface, don't make them ask.

---

### i36 (refined)

**Title (refined, ≤10 words):** `dx commit-eats` — SQLite log of every silent reset, with recover

**One-line:** SQLite-backed log under `~/.dx/commit-eats.db` with one row per autosync reset/destructive op (sha, message, timestamp, sid, reason); `dx commit-eats list` shows them; `dx commit-eats recover <id>` cherry-picks the commit back; counter exposed via `dx storm-status`.

**Why:** Lossy events become durable telemetry. Humans see the cumulative cost of the storm in numbers, not anecdotes. Aligns with z086 (process-over-outcome) and the dx-app session-vibe telemetry pattern (memory: `project_dx_app_session_vibe`) — make the cost legible.

**Cost-to-try:** medium (1-3 days — SQLite schema, write hook in destructive-op path, list/show/recover commands, status-line wiring)

**Reversibility:** easy (the DB is local + additive; remove the writer to revert)

**Prerequisites:** i06 ideally (so the eat-rate trends to zero post-deploy and the counter becomes a regression detector). i35 (recovery already exists) — i36 is best framed as i35 + persistence + telemetry. i39 (R/A/G storm gauge) consumes the counter.

**Blast radius:** telemetry + dev-loop. The DB is local; if we ever sync it across envs (memory: `reference_agent_records`) it becomes corpus-adjacent, but v0 is local.

**Refiner notes:** Single-source from ideator-03 — strongest as a complement to i35, not a replacement. Where i35 says "give me a menu," i36 says "give me a counter and a history." Together they're "recovery as a first-class surface." The counter is the load-bearing piece for retros and team digests (i43).

---

### i37 (refined)

**Title (refined, ≤10 words):** Hash-chain stash naming — `gin/<sid>/<parent-sha>/<intent-hash>`

**One-line:** Replace opaque numeric stashes with structured names `gin/<sid>/<parent-sha>/<intent-hash>` so stashes (and orphan-branches per i07) form a deterministic chain walkable by `dx unstash`.

**Why:** This session climbed to 27 stashes — opaque, ungreppable, indistinguishable. Structured naming makes them findable by sid, by parent-sha, or by intent. Idempotent: re-stashing the same intent on the same parent produces the same name (no duplicates).

**Cost-to-try:** small (rename pattern in stash creation + a `dx unstash` walker; <1 day)

**Reversibility:** easy (old-style stashes coexist; unstash walker can read both formats)

**Prerequisites:** none for v0. Converges naturally with i07 (orphan-branches share the same naming scheme) and i19 (per-agent sid trailer — same sid).

**Blast radius:** dev-loop only.

**Refiner notes:** Single-source from ideator-02 but cleanly composes with i07's orphan branches — both want the same naming scheme. At spec time, decide whether stashes-and-orphans share one namespace (`gin/<sid>/<parent-sha>/<intent-hash>` for both) or stay separate. Recommend: one namespace, distinguished by ref type (`refs/stash/...` vs `refs/heads/gin/...`).

---

## Cross-slice notes

### Cross-slice duplicates / overlaps

- **i06 ↔ i20 (Cluster E):** i06 ("never reset") is the *behavior*; i20 (`dx ship` wrapper) is the *home* for that behavior. Not duplicates — i20 is where i06 lives in code. Recommend: ship i06 *as a property of* i20 if i20 is in the prioritize cut.
- **i07 ↔ i27 (Cluster F):** i07 ("on push fail, park orphan") and i27 ("storm-mode side-branch by default") differ only in *trigger*. i07 fires reactively (push rejected); i27 fires proactively (storm-level ≥ 2). They compose: i27 reduces how often i07 has to fire.
- **i08 ↔ i32 (Cluster G):** i32 ("Gin doesn't reset Gin" hook) is a *convention* version of i08's *infrastructure* tombstone. i32 blocks the reset; i08 makes the reset survivable. Different layers of the same goal.
- **i09 ↔ i20 (Cluster E):** i09 (CAS) is a candidate *implementation* for i20's push semantic. Not duplicates — i20 is the wrapper, i09 is the algorithm inside it.
- **i35 ↔ i08:** i35 (recovery menu) and i08 (tombstones) are independent but synergistic — tombstones give i35's menu structured entries instead of raw reflog noise.
- **i36 ↔ i43 (Cluster I):** i36 (commit-eats DB) is the data source for i43 (periodic team digest). Compose, don't merge.
- **i37 ↔ i07:** i37 (hash-chain naming) is the naming scheme for i07's orphan branches. Compose at spec time.

### Conflicts

- **i06 vs autosync's current contract:** i06 *is* the conflict — current autosync says "fall back to reset on push-fail"; i06 says "never." This is the intentional break. Resolved by deciding i06 wins.
- **i09 vs CLAUDE.md "NEVER force-push":** `--force-with-lease` is a guarded CAS, not a destructive force. CLAUDE.md doctrine needs a carve-out or i09 is doctrinally blocked. Surface to prioritize.

### Gap-fills

None added by refiner-02. The slice (Cluster B + Cluster H) is dense and well-covered; every category I'd want (prevent / structure / observe / recover / restore) has at least one idea. The gap I considered ("idempotent autosync — same input → same output, no commit if no new authored files") sits naturally in Cluster D (i16/i17) and refiner-03's territory.

### Friction zettels

None captured this turn. The slice's framing was clear, `From:` references all resolved, no contradictions surfaced beyond i09 ↔ doctrine (handed to prioritize).

## Open questions for orchestrator

1. **i09 doctrinal carve-out:** does `--force-with-lease=origin/main:<sha>` count as a "force-push" under the CLAUDE.md "NEVER force-push" rule? Spec-time decision; flagging early because it's a doctrinal gate for i09.
2. **Orphan-branch namespace:** `refs/heads/gin/orphan/*` (browsable in gh) vs `refs/gin/*` (clean but invisible). Affects i07 and i37 jointly.
3. **i08/i35/i36 sequencing:** all three are recovery-surface ideas. Recommend prioritize treats them as a *bundle* (ship i35 v0 first reflog-only, then i36 SQLite, then i08 tombstones as the structured input) rather than three independent line items.
