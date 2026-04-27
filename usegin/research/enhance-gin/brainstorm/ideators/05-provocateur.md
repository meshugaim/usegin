# Ideator 05 — Provocateur

Premises being questioned: shared checkout, push-to-main, autosync-by-default, git-as-coordination, single-machine assumption, "agents work in parallel" itself.

## Ideas

- **One-agent-per-worktree.** Stop sharing the checkout entirely. Each spawn gets its own `git worktree` rooted at a stable path; autosync lives per-worktree; pre-push is per-worktree. "Multi-agent on shared tree" was never required — it was inherited.
- **One-agent-per-branch, never-touch-main.** Agents push to `agent/<id>/<topic>` branches; a single merger (Zisser or a tiny daemon) integrates to main. Push contention vanishes; attribution becomes free.
- **Rip out autosync entirely.** The 27-stash / 4-eaten-commit pathology *is* autosync. Replace with explicit `dx push` that the agent calls when its own commit is ready. Stop doing background git work the agent didn't ask for.
- **Read-only checkout + propose-via-PR.** The shared tree is `chmod -R a-w`. Agents work in scratch worktrees and submit machine-PRs into a queue. The queue serializes, and the storm becomes a line.
- **Agent-to-agent direct channel.** Instead of racing through git, agents publish "I'm about to touch X" / "I just touched X" on a tiny pub/sub (Redis, file, or DX socket). Coordination happens *before* the commit, not after the collision.
- **Zisser-as-write-gate.** All git mutations route through Zisser; agents never call `git commit` / `git push` directly. Zisser owns the tree, knows who's mid-flight, and refuses pushes that would block on stranger dirt.
- **Per-agent VM / firecracker / fork.** The unit of isolation is the machine, not the directory. Cheap microVM per spawn; sync via git remote, not shared FS. Devcontainer-per-agent.
- **Agents run on a fork of the repo.** Each Gin instance has its own GitHub fork, pushes there freely, and a daemon fast-forwards `main` from forks in priority order.
- **Pre-push runs in a clean ephemeral checkout, not the working tree.** The hook clones to `/tmp/precheck-$sha`, applies just the commit range, runs lint/test there. Working-tree dirt becomes physically invisible to push.
- **Rebase the commit onto a clean base before pushing.** `git push` from a synthesized clean tree — checkout the parent, cherry-pick *only* the agent's commits, run tests, push. Stranger WIP cannot block.
- **Stop linting the whole tree, ever.** The lint/test gate runs on `git diff --name-only` against the merge base. Whole-tree lint was a habit from solo dev — it doesn't survive multi-agent.
- **Make pushes optimistic + auto-retry.** Agent never sees a push failure; `dx push` enqueues, and a worker retries with rebase until clean. Failed pushes go to a `quarantine/` branch, not into reset HEAD~1 oblivion.
- **No shared `main` for agents at all.** Agents push to `gin/main`; a Zisser job fast-forwards `gin/main → main` only when CI on the agent's commit range is green and the human approves. Promotion is a separate event from "agent committed".
- **Append-only commit log, no resets ever.** Replace autosync with a primitive that *cannot* call `git reset` — push failures park the commit on a side branch and emit a Sentry/notification. Lost-work-by-autosync becomes physically impossible.
- **Agents use a CRDT-backed virtual filesystem on top of git.** Conflicts merge automatically in the CRDT layer; commits to git are projections. The "two agents touched the same file" race goes away.
- **What if the storm is the bug, not the load?** Cap parallel agents at 1 by default; require an explicit "I want to spawn N concurrent" handshake from Lihu. Multi-agent isn't free — make the cost visible at spawn time.
- **Spawn agents serially, not concurrently.** Queue spawns; only one agent has write access to the tree at a time. Slower; correct. Re-question: does Lihu actually need parallel agents, or did we just build for it?
- **Time-slice the tree.** Each agent gets a 10-minute exclusive lease on the working tree; the lease holder can commit+push freely; others read only. Lease-broker (Zisser) hands out turns.
- **Push-by-intent, not push-by-diff.** Agent declares "I want to ship the marketplace docs"; the broker assembles a clean commit from the agent's labeled changes only, regardless of what else is in the tree. Diff-by-label, not diff-by-WT.
- **Stop using git's working tree as a scratch space.** Agents write to `~/scratch/<agent>/` and the tooling stages files into a clean checkout only at commit time. The "working tree" stops being a shared resource.
- **Detect storm, escalate, refuse to commit.** When `git status` shows >5 files no agent here owns, the agent halts, files a `dx his` red rating, pings the human, and refuses to autosync until the storm clears. Make the cost of multi-agent visible to the human in real time.
- **Replace pre-push with post-push CI as the gate.** Push always succeeds locally; staging/main is a *queue*, not a branch; CI promotes commits forward only when green. We already do this for staging — do it for main too, between agents and humans.
- **Bring back the human as the merge oracle.** Agents commit to side branches; a UI shows Lihu the queue; he taps to merge. Not "Lihu is the bottleneck" — "the bottleneck is the integration moment, and only Lihu has the context to resolve real conflicts."
- **Question whether agents should share authorship with humans on `main`.** Two histories: `main-human` and `main-gin`, periodically reconciled. Pre-push between agents never blocks human pushes; cross-stream conflicts surface in a daily reconcile job.
- **Agents commit only via signed intent-objects.** `dx propose <description>` writes a JSON record of "I want to change these files this way"; a separate process applies it to git. The agent never touches `git` itself.
- **Make autosync a *read* primitive, not a write primitive.** Autosync pulls; commits/pushes are explicit. Most pathologies trace to background writes the agent didn't author.
- **What if the failure mode is the tooling itself?** Replace `git` with `jj` (Jujutsu) for agent operations — first-class concurrent branches, no detached-HEAD pathology, conflict-as-data not conflict-as-error. Out of scope says "no replacing git" but jj sits on top of git refs; might be in scope.
- **A shared `WIP.md` agents update before each commit.** Trivial, social: each agent writes "currently editing: integrations-tab-content.tsx" before the edit. Pre-push reads it; pushes that would lint a file under another agent's lock are deferred. Coordination via human-readable convention, not infrastructure.
- **Agents post their *plan* to a shared bus before starting.** Director sees overlap and serializes the conflicting agents. The provocation: solve concurrency at *spawn time*, not at *push time*.
- **Reframe: there is no "Gin's commit" — only "Gin's intent."** All the work to attribute, recover, and protect "Gin's commits" is fighting an ontology error. Treat git as a cache of intent, not the source of truth; Zisser holds the canonical intent log.
- **Kill the concept of "main" in the agent layer.** Agents work in a topic-graph (issue-per-topic, branch-per-topic, no shared trunk between agents). "Pre-push lints the working tree" is meaningless because there's no shared tree. Trunk-based dev was a human-team optimization — agents don't need it.
