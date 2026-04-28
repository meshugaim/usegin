# Vibe-Coding SOTA — April 2026

R&D angle 4. What does the competitive frontier look like before we pitch
"Gin (built on Claude Code) is better than Claude Code itself, better than
Cursor, better than any vibe tool that exists"? Sources at the bottom.

---

## 1. One row per tool

### Cursor (Anysphere)
- **Who they are.** The default IDE for most agentic-coding shops. Cursor 3
  shipped April 2026 with an "agent-first interface" that pushes the IDE
  surface beneath an agent panel; Composer 2 (their proprietary frontier
  coding model) is the default, scoring 61.3 CursorBench at ~200 tok/s.
- **Best at.** Editor-native fluency + speed. Tab completion, inline edits,
  multi-pane parallel agents (Cursor 3.1, April 13 2026) running in git
  worktrees, with persistence across sessions.
- **Agent / persona model.** "Custom Agents" + "Custom Modes" + `.cursor/rules/`
  files (per-folder, per-language). Personas exist as a *user pattern*
  (community blog posts about "5 Cursor personas"), but Cursor itself ships
  a single Composer agent with Mode + Rules customization. No named cast.
- **Team / multi-agent.** Multiple agents in tiled panes, isolated worktrees,
  merging back when done. Each agent works on its own task — there is *no
  cross-agent dialogue*. They're parallel workers, not a team that talks.
- **Unique.** Composer 2 (own frontier coding model). Background Agents
  on Anysphere cloud that survive laptop close. Local→cloud handoff.
- **Refuses to do.** Cross-agent collaboration / debate. Agents don't talk
  to each other; the human is the integration point.

### Claude Code (Anthropic)
- **Who they are.** Upstream tool we run on. CLI-first, terminal-native.
  "Agent Teams" shipped Feb 2026, plus skills/plugins/marketplace.
- **Best at.** Composability. Sub-agents (own context window, isolated
  output), Skills (loadable specialized capabilities), Plugins (bundle of
  skills + MCP + commands + hooks + agents), and a marketplace at
  ~4,200 skills / 770 MCP servers / 2,500 marketplaces / 110k devs / month.
- **Agent / persona model.** Sub-agents are markdown files with
  Name + Color + Persona + Expertise. Personas are real (community
  convention), but they're per-sub-agent metadata, not a named house cast.
  Skills can be preloaded into a sub-agent at startup (don't inherit).
- **Team / multi-agent.** Agent Teams = multiple Claude instances pulling
  from a shared task list with claim-to-prevent-duplication semantics.
  Sequential sub-agent chaining is also a first-class pattern. Still:
  *task-list-based collaboration*, not dialogue.
- **Unique.** Skills + plugins ecosystem; hooks (deterministic harness);
  open-source SDK; works inside any wrapper (we built Gin on it).
- **Refuses to do.** Opinionated UI. Stays a terminal tool by design.

### Devin (Cognition)
- **Who they are.** The "first AI software engineer" framing. Autonomous
  ticket-to-PR. SWE-1.6 model trained April 2026 via RL on real dev envs.
  Cognition for Government (Feb 2026, FedRAMP High track for Windsurf).
- **Best at.** Long-horizon autonomous tickets — pulls from Linear/Jira/
  Slack, owns the loop end-to-end. Sandboxed shell + editor + browser.
- **Agent / persona model.** One agent. No personas. One identity: "Devin."
- **Team / multi-agent.** Not the pitch. You spin up multiple Devins, each
  on their own ticket, in parallel sandboxes — but they don't collaborate.
- **Unique.** The autonomous-engineer framing + sandbox-by-default + the
  Linear/Jira/Slack ticket-pull integration (this is the real moat).
- **Refuses to do.** Pair programming. Devin is not your pair; Devin is
  your async employee. Also still benchmarks low on raw resolve %
  (~13–15% real-world end-to-end per independent reports).

### Windsurf / Cascade (now Cognition-owned)
- **Who they are.** Codeium's IDE → acquired into Cognition's umbrella.
  Wave 13 (early 2026): parallel agents, Arena Mode, Plan Mode, Codemaps.
  SWE-1.5 / SWE-1.6 in-house models.
- **Best at.** First commercial IDE with simultaneous multi-agent execution
  across isolated worktrees (up to 5). Arena Mode = blind A/B of two
  models on the same task. Plan Mode = explicit planning before code.
- **Agent / persona model.** No named personas. Cascade is the agent;
  configuration is per-session.
- **Team / multi-agent.** Up to 5 parallel autonomous agents, each in its
  own worktree. Like Cursor — parallel, not dialogic.
- **Unique.** Arena Mode (model bake-off on real codebase). Plan Mode as
  a first-class phase. FedRAMP High path for federal customers.
- **Refuses to do.** Inter-agent collaboration / debate.

### GitHub Copilot (Workspace + Coding Agent)
- **Who they are.** Microsoft's full-stack play: VS Code agent mode +
  Copilot Workspace + cloud Coding Agent that turns issues into PRs in
  the background. April 2026: Claude Opus 4.7 GA on Copilot. Pro/Pro+/
  Student new signups *paused* in April because compute usage exploded.
- **Best at.** Distribution. It's *in* GitHub. The Coding Agent runs
  natively against issues with PR-first workflow.
- **Agent / persona model.** "Custom Agents" in VS Studio (specialized
  agents per task type). Plus you can pick which model/agent runs:
  Copilot, Claude (Anthropic), or OpenAI Codex. So there's a *roster of
  third-party agents*, but no named house personas.
- **Team / multi-agent.** Workspace's "system of sub-agents" iterating with
  the developer at every step is the public pitch. Mostly handoff between
  specialized agents, not group dialogue.
- **Unique.** Native GitHub integration (issues → PRs as the seam).
  Multi-vendor agent roster.
- **Refuses to do.** Heavy customization (compared to Cursor's rules /
  Claude Code's skills). It's the Microsoft default.

### OpenAI Codex (revived, 2025+)
- **Who they are.** Rust-based open-source CLI agent + a Codex Cloud track
  reachable via `codex cloud`. Default models: GPT-5.5 (most coding) and
  GPT-5.4 (native computer-use, 1M context exp).
- **Best at.** "Lightweight, terminal-native" positioning + Codex Cloud
  parallel best-of-N runs, where the cloud generates multiple solutions
  and you pick.
- **Agent / persona model.** No personas. AGENTS.md (the open spec they're
  pushing as a standard) carries project context.
- **Team / multi-agent.** Sub-agent workflows for parallelizing larger
  tasks; cloud worktrees. Best-of-N as a multi-attempt pattern is an
  interesting *lateral* shape — same task, multiple agents, pick winner.
- **Unique.** Best-of-N cloud runs (close to "council" semantics).
  Rust binary. Codex SDK integration with the Agents SDK.
- **Refuses to do.** Persona modeling. It's the engineering tool.

### Cline / Roo Code
- **Cline.** Open-source VS Code agent, model-agnostic, stepwise planning.
- **Roo Code.** Was the multi-mode fork (Architect / Code / Debug / Ask /
  Custom modes — explicit role switching with tool subsets). **Roo Code
  is being shut down May 15, 2026**; the team points users to Cline or
  to roomote.dev (their next project). So Roo's "modes-as-personas"
  pattern is exiting the market.
- **Best at.** Open source, BYO-key, transparent.
- **Persona/team.** Roo had the most explicit "named modes" pattern of
  any production tool (Architect, Code, Debug, Ask). It's the closest
  analog to our "named personas," and it's dying.

### Aider
- **Who they are.** Terminal pair programmer. Repo map (tree-sitter index
  across 100+ languages). Architect mode for high-level planning.
- **Best at.** Disciplined diff edits + tight git integration + repo-aware
  context.
- **Persona/team.** No native multi-agent. There's an open feature
  proposal (#4428) to add multi-agent support, *not yet shipped*.
  Third-party "Agency Agents" ships 112 personas as a layer over Aider /
  Cursor / Claude Code, but it's a community plugin, not Aider itself.

### Replit Agent 3
- **Who they are.** Full-cycle build → deploy → debug for non-developers
  more than for engineering teams. 200-minute autonomous runs, in-browser
  testing, self-healing loops.
- **Best at.** Browser-based testing-and-fixing loop. Provisions DBs.
  Verifies buttons + API calls itself. Builds *other agents* (Agent 3
  can author automations / sub-agents in natural language).
- **Persona/team.** No personas. One Agent. Internal sub-agent spawning
  is a feature, but the user-facing model is "tell Agent what to build."

### Sourcegraph Amp (formerly Cody)
- **Who they are.** Enterprise. Free/Pro tier killed in 2025; now
  contact-sales. Agentic multi-step edits + code-graph context across
  monorepos / multi-repo.
- **Best at.** Big-code retrieval. The code graph is the moat.
- **Persona/team.** Single agent. Code graph is the differentiator,
  not personas.

### Continue / Tabby / Sweep
- **Continue.** Open-source completion + chat extension. Pluggable.
- **Tabby.** Self-hosted, fine-tunable on private repos.
- **Sweep.** Specialized: small GitHub issues → PRs autonomously.
- **Persona/team.** None of them ship named personas or team semantics.
  Supporting cast: useful if you have specific constraints (self-host,
  budget, Sweep-shaped work).

### Anthropic Petri (2.0, 2026)
- **Important — Petri is NOT a coding tool.** It's an open-source
  *alignment-audit* framework: an automated agent that probes a target
  model with simulated multi-turn conversations and tools, scoring
  behavior. v2 (early 2026) added eval-awareness mitigations + scenarios
  like multi-agent collusion, conflict-of-interest, exfil-via-helpful-only-
  model. So Petri is the only public Anthropic "multi-agent platform" —
  but it's for *safety auditing*, not for shipping code.
- **Adjacent.** Anthropic shipped *Managed Agents* on Claude (April 2026)
  — a managed runtime that separates agent logic from orchestration /
  sandboxing / state / credentials. This is the actual Anthropic-hosted
  agent-platform play. It's runtime, not personas.

### Frameworks (not tools, but worth noting)
- **CrewAI.** Role-based API — agents have role, goal, backstory. The
  framework where "named personas + named teams" is most native.
- **MetaGPT.** SOP-driven simulated software company: PM, Architect,
  Engineer, QA roles with predefined handoff artifacts.
- **AutoGen / AG2.** GroupChat coordination — agents *debate* through
  multi-turn dialogue, with a selector picking who speaks next.
- **LangGraph.** Graph-of-agents control flow, more general.

These are SDKs, not vibe-coding tools. But they tell us: the named-persona,
debate-style team pattern is *fully understood at the framework layer* —
just not surfaced in any commercial vibe-coding product.

---

## 2. Frontier-leaders + axis

Three tools genuinely lead, on three different axes. There's no single
king of vibe-coding.

1. **Cursor — leader on speed + IDE fluency.** Composer 2 + agent-first IDE
   + parallel-pane multi-agent + cloud handoff. If "vibe-coding" means
   "an agent at your fingertips inside the editor," Cursor 3 is the bar.
2. **Devin — leader on autonomous ticket-to-PR.** No one else owns the
   full async loop with the same conviction (sandbox + ticket pull +
   long-horizon RL training). The benchmarks are still mediocre, but
   the *product shape* is the most coherent autonomous-employee pitch.
3. **Claude Code (+ ecosystem) — leader on composability.** Skills,
   plugins, hooks, sub-agents, marketplace. The most extensible substrate;
   that's exactly why we built Gin on it.

Honorable mentions:
- **Windsurf** — Arena Mode (blind A/B) is a unique competitive shape.
- **Replit Agent 3** — testing-loop autonomy + non-dev audience is its own
  axis we don't compete on.
- **Sourcegraph Amp** — wins on monorepo code-graph context if that's
  your bottleneck.

---

## 3. Whitespace — what nobody's doing yet

This is where Gin's pitch lives. Cross-checking every tool above:

a. **A named cast of personas with stable identities the user knows.**
   Closest: Roo Code's modes (dying May 2026). Cursor "personas" is a
   community pattern, not product. Claude Code sub-agents are markdown
   metadata, not a recognizable cast. CrewAI has named roles but it's a
   framework, not a vibe tool. **Nobody ships a named, opinionated,
   recognizable cast in a vibe-coding product.** This is whitespace.

b. **Agents that talk to each other (debate / council / dialogue).**
   Every commercial vibe tool does *parallel isolated agents* (Cursor,
   Windsurf, Codex Cloud, Claude Code Agent Teams). The dialogic pattern
   exists in AutoGen / MetaGPT at the framework layer but isn't in any
   shipping vibe product. **Whitespace.**

c. **Best-of-N / council voting on a single task.** Codex Cloud's
   best-of-N is the closest production analog, but it's a flat vote, not
   a deliberation. **Whitespace for "n agents argue, one synthesizes."**

d. **Persona telemetry / reflection ("how did this persona perform on
   this kind of work?").** No tool surfaces this. We have `dx his` —
   nobody else does session-vibe ratings, let alone per-persona.

e. **A persona system that's transparent + user-editable + shared
   across a human team.** Cursor rules and Claude Code sub-agents
   approach this, but they're per-developer config, not "the team's
   shared cast of named experts." Whitespace.

f. **Personas as the orchestration unit (vs. tasks or files).** Today's
   tools orchestrate by task ("agent for this PR") or by mode ("Architect
   mode now"). Nobody orchestrates by *who's at the table*. Whitespace.

---

## 4. Honest Gin-pitch axes

Things we can defensibly claim *if we ship the persona+team system*.
No claim that doesn't survive a cold read of section 1.

- **Better than Claude Code itself, on opinionation.** Claude Code is the
  substrate. We add a named cast + named teams + session-vibe telemetry
  + zettel + cross-env continuity + tikur post-mortem culture. Honest pitch:
  *"Claude Code is a great instrument; Gin is a tuned ensemble built
  on it."*

- **Better than Cursor, on team shape.** Cursor leads on IDE fluency + raw
  speed. We do not claim to beat Composer 2 at editing. We claim:
  *"Cursor gives you one fast agent at your fingertips. Gin gives you a
  cast that knows each other and reviews each other's work."* That's
  true today and stays true even as Cursor 3.x evolves.

- **Better than any vibe tool on the cross-tool axes.** Specifically:
  named-cast + dialogic team + persona telemetry + zettel-as-shared-2nd-
  brain. No commercial vibe tool ships any of those four. Each one is
  individually defensible (sec. 3a, 3b, 3d, plus our existing
  zettel/his/tikur stack).

- **Honest weak spots to name in the same breath:**
  - We do not have our own frontier coding model (Composer, SWE-1.6).
  - We are not a polished IDE. Cursor's editor is better.
  - We do not have ticket-to-PR sandbox autonomy at Devin's scope.
  - We are smaller-scale than the GitHub Coding Agent's distribution.
  Saying these out loud makes the persona+team claim land harder.

The shape of the pitch: *"On the axes the frontier already won — model
quality, IDE polish, distribution — we're standing on Anthropic's
shoulders. On the axes nobody's solved yet — named cast, agent dialogue,
persona telemetry, shared 2nd brain — we're the only ones doing it."*

---

## 5. Steal list — what they do well that we should adopt

- **Cursor's parallel agent panes (3.1).** The persisted-across-sessions
  tiled view is a UX win. Our equivalent should be a multi-pane view of
  named-personas-in-flight, not just generic "agent N."
- **Cursor's local→cloud handoff.** "This is taking 30 minutes — push it
  to a sandbox" is a real workflow. Worth porting onto Gin (we already
  have agent-records + cross-env). Bind it explicitly.
- **Windsurf Arena Mode.** Two models on the same task, blind A/B. We
  could trivially do *two personas on the same task, blind A/B,* and
  make that a first-class workflow ("send this to the council").
- **Windsurf Plan Mode.** Explicit "plan before code" phase. We already
  have this implicitly via tdd-impl-plan; making it a named UX would
  make Gin friendlier for newcomers.
- **MetaGPT's SOPs.** Predefined hand-off artifacts between roles. Our
  closest analog is the build-orchestrate / build-liaison whiteboard —
  formalizing the persona-to-persona handoff contract is a steal.
- **AutoGen GroupChat selector.** "Who speaks next" as an explicit
  function. When we ship dialogue, this is the right primitive — not
  free-for-all, not strict round-robin.
- **CrewAI's role/goal/backstory triple.** Three-line persona spec is
  enough. We over-engineer; their template is laconic and works.
- **Codex Cloud best-of-N.** A "send the same task to the team and pick
  the winner" mode is cheap to add and surprising in practice.
- **Claude Code skills marketplace.** We're already on this substrate.
  Bind: package each Gin persona + its skill loadout as an installable
  plugin so other Claude Code users can adopt one persona at a time.
- **Devin's ticket-pull integration.** Linear/Jira/Slack as the seam is
  the right pattern. We have Linear; we should formalize "a persona
  watches this label and pulls work."
- **Roo Code's mode-as-tool-subset.** Each mode activates only the tools
  it needs. We should make sure each persona's tool surface is scoped,
  not full-power-by-default.

---

## 6. Sources

- [Cursor 2.0 announcement](https://cursor.com/blog/2-0)
- [Cursor 3 — Agent-first interface (InfoQ, April 2026)](https://www.infoq.com/news/2026/04/cursor-3-agent-first-interface/)
- [Cursor changelog](https://cursor.com/changelog)
- [Cursor Composer 2 review (TokenMix, 2026)](https://tokenmix.ai/blog/cursor-composer-2-review-benchmark-2026)
- [Cursor Background Agents guide (2026)](https://ameany.io/cursor-background-agents/)
- [Cursor Customizing Agents](https://cursor.com/learn/customizing-agents)
- [Cursor "5 personas" community piece](https://medium.com/@johnmunn/5-cursor-personas-your-whole-team-should-be-using-not-just-devs-a4c21c84b46b)
- [Claude Code sub-agents docs](https://code.claude.com/docs/en/sub-agents)
- [Claude Code plugins docs](https://code.claude.com/docs/en/plugins)
- [Claude Skills Marketplace overview (BrightCoding, April 2026)](https://www.blog.brightcoding.dev/2026/04/26/claude-skills-marketplace-the-essential-plugin-hub-for-developers)
- [Claude Code hooks/subagents/skills guide (ofox.ai, 2026)](https://ofox.ai/blog/claude-code-hooks-subagents-skills-complete-guide-2026/)
- [Claude Code Agent Teams (MindStudio)](https://www.mindstudio.ai/blog/claude-code-agent-teams-parallel-collaboration)
- [Cognition / Devin home](https://cognition.ai/)
- [Devin AI review 2026 (AIAgentSquare)](https://aiagentsquare.com/agents/devin.html)
- [Devin SWE-Bench review](https://www.openaitoolshub.org/en/blog/devin-ai-review)
- [Devin vs OpenHands vs SWE-agent (ToolHalla, 2026)](https://toolhalla.ai/blog/devin-vs-openhands-vs-swe-agent-2026)
- [Windsurf Cascade docs](https://docs.windsurf.com/windsurf/cascade/cascade)
- [Windsurf Wave 13 — parallel agents + Arena Mode](https://aiautomationglobal.com/blog/windsurf-wave-13-parallel-agents-arena-mode-ai-ide-2026)
- [Windsurf review 2026 (vibecoding.app)](https://vibecoding.app/blog/windsurf-review)
- [GitHub Copilot 2026 guide (NxCode)](https://www.nxcode.io/resources/news/github-copilot-complete-guide-2026-features-pricing-agents)
- [GitHub Copilot custom agents (Microsoft Learn)](https://learn.microsoft.com/en-us/visualstudio/ide/copilot-specialized-agents?view=visualstudio)
- [GitHub Copilot cloud agent docs](https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent)
- [GitHub Weekly — Copilot infra limits, April 2026](https://htek.dev/articles/github-weekly-2026-04-21/)
- [VS Code multi-agent dev blog (Feb 2026)](https://code.visualstudio.com/blogs/2026/02/05/multi-agent-development)
- [Codex CLI](https://developers.openai.com/codex/cli)
- [Codex CLI features](https://developers.openai.com/codex/cli/features)
- [Codex changelog](https://developers.openai.com/codex/changelog)
- [Codex models (GPT-5.4 / 5.5)](https://developers.openai.com/codex/models)
- [Roo Code vs Cline (Qodo, 2026)](https://www.qodo.ai/blog/roo-code-vs-cline/)
- [Roo Code vs Cline (Morph, 2026)](https://www.morphllm.com/comparisons/roo-code-vs-cline)
- [Roo Code GitHub](https://github.com/RooCodeInc/Roo-Code)
- [Aider docs](https://aider.chat/docs/)
- [Aider multi-agent feature request #4428](https://github.com/aider-ai/aider/issues/4428)
- [Agency Agents — 112 personas layer](https://yuv.ai/blog/agency-agents)
- [Replit Agent 3 announcement](https://blog.replit.com/introducing-agent-3-our-most-autonomous-agent-yet)
- [Replit Agent 3 review (LeaveIt2AI, 2026)](https://leaveit2ai.com/ai-tools/code-development/replit-agent-v3)
- [Sourcegraph Amp](https://sourcegraph.com/amp)
- [Amp practical guide (Medium)](https://medium.com/@focusfaithfirst/sourcegraph-amp-a-practical-guide-for-leaders-who-care-about-speed-safety-and-control-65681f0cf2c6)
- [Petri 2.0 — Anthropic alignment](https://alignment.anthropic.com/2026/petri-v2/)
- [Petri original (alignment.anthropic.com)](https://alignment.anthropic.com/2025/petri/)
- [Anthropic Managed Agents (InfoQ, April 2026)](https://www.infoq.com/news/2026/04/anthropic-managed-agents/)
- [Best multi-agent frameworks 2026 (GurusUp)](https://gurusup.com/blog/best-multi-agent-frameworks-2026)
- [Code Agent Orchestra — Addy Osmani](https://addyosmani.com/blog/code-agent-orchestra/)
- [MetaGPT GitHub](https://github.com/FoundationAgents/MetaGPT)
- [CrewAI vs LangGraph vs AutoGen vs OpenAgents (2026)](https://openagents.org/blog/posts/2026-02-23-open-source-ai-agent-frameworks-compared)
- [Persona-based AI development (Human Who Codes)](https://humanwhocodes.com/blog/2025/06/persona-based-approach-ai-assisted-programming/)
- [Anthropic 2026 Agentic Coding Trends Report (PDF)](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf?hsLang=en)

---

*Posture: laconic. Investigated all 11+ tools requested + the framework
layer (CrewAI / MetaGPT / AutoGen) because the named-persona-and-team
pattern lives there, not in any commercial vibe tool. The whitespace
finding is the load-bearing one — section 3 is the reason this angle
exists.*
