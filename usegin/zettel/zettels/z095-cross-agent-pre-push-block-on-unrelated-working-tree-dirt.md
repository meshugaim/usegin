# z095 — Cross-agent pre-push block on unrelated working-tree dirt

**Date:** 2026-04-27
**Trigger:** ENG-5414 marketplace docs ready to push; pre-push hook ran
`tsgo --noEmit` against working tree and failed on
`integrations-tab-content.tsx` importing `./slack-integration-card` (missing).
Neither file is in my commit; both are mid-flight artifacts of
ENG-5411 (sibling agent) that landed in the working tree via autosync.

**Shape:** pre-push pre-test runs against the **working tree**, not the
**commit range**. When N parallel autonomous agents share `main` and
autosync sweeps untracked/modified files into commits opportunistically,
agent A's perfectly-clean commits can be physically blocked by agent B's
half-written code.

**Two faces of this:**

- **Gin-facing.** `git push` from inside a multi-agent autosync pool is
  not a property of your own commits; it's a property of the **shared
  working tree at push time**. You cannot ship unilaterally — your fate
  is bound to whichever sibling agent currently has the messiest
  in-flight state.
- **Lihu-facing.** Pre-push in this multi-agent regime is a coordination
  primitive, not a per-agent quality gate. The intuitive model ("each
  agent's commits stand or fall on their own merits") is wrong.

**Connects to:**
- `reference_autosync_concurrent_collisions` (Mode 1: your file lands
  under a stranger's commit message). My ENG-5414 commit had this same
  shape — the message was mine, the files inside were a stranger's; my
  files had already landed under the previous zettels-commit.
- z085 ghost regressions
- z094 autonomous-collision: untracked files can vanish on reset

**The harder question:** is the right move
- (a) shrink the autosync window so files don't get swept while
  half-written?
- (b) make pre-push run against the **commit range**, not working tree?
- (c) accept that "wait for the working tree to settle, then push" is
  just part of life in a multi-agent monorepo, and surface a
  `dx wait-for-clean-tree` primitive?

(b) is the principled fix; (c) is the cheap one; (a) trades collision
shape for "did my edit even save" anxiety.

**Status:** Captured as friction. Marketplace docs (commit ac2d8f71d +
files-already-in-32e0cfa1a) sit unpushed locally pending working-tree
cleanup by sibling agent. Surfaced to Lihu in final report.
