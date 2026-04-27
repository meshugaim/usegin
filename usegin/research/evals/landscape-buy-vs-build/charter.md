# Charter — angle D: landscape-buy-vs-build

You are a professor of **the existing eval-tooling landscape and what fits our stack**. Read the following first, then carry out the mandate.

## Read first

- `/workspaces/test-mvp/usegin/research/evals/RESUME.md`
- `/workspaces/test-mvp/PRODUCT.md` (so you know what stack we're slotting into)
- `/workspaces/test-mvp/CLAUDE.md` (the philosophy — anti-hypothetical, anti-frameworky-when-five-lines-of-Python-do)
- Stack reality: `python-services/CLAUDE.md`, root `package.json`, root `pyproject.toml` or `uv` lockfile — what's already in.
- Anthropic SDK + ClaudeSDKClient: relevant memory `working-with-claude-agent-sdk` skill description; we already use it in `agent_api/` and headless-claude flows.
- Use **context7** (`mcp__context7__resolve-library-id` then `query-docs`) for any current-doc lookups on the tools below.
- Use **WebSearch** sparingly for "X eval framework 2026" / GitHub stars / latest blog posts on what production teams use today.

## Mandate

Survey the eval-tooling landscape, score each option against fit-with-our-stack, and produce a buy/build/wrap recommendation. Cover both general-purpose eval frameworks AND the practice of agent-products that have published their eval approach (Claude Code itself, Cursor, Aider, Continue, Devin, Replit Agents, Anthropic internal — what they've shared publicly).

## Scope

**In:**
- General-purpose frameworks: **promptfoo**, **braintrust**, **langsmith**, **langfuse**, **helicone**, **openai-evals**, **Anthropic SDK / Claude Agent SDK** built-ins, **Inspect AI** (UK AISI), **deepeval**, **ragas** (RAG-flavored), **TruLens**, **Phoenix/Arize**.
- For each: licensing, hosting model (cloud-only? self-host?), pricing posture, agent-trace support (vs. only chat-completion), Python-SDK quality, integration cost into our stack (Anthropic-SDK + Supabase + dogfooding).
- Peer-org practice: what have **Claude Code**, **Cursor**, **Aider**, **Continue**, **Devin**, **Replit Agents**, **Anthropic engineering teams** publicly said about how they eval their agents. Quote specifics.
- The "wrap" middle ground: build minimal Python around a vendor's primitive (e.g., wrap `anthropic` SDK + judge calls + JSON storage — five hundred lines, no dep).
- Lock-in cost per option (data-format lock, prompt-store lock, scoring-rubric lock, dashboard lock).

**Out:**
- The v0 spec (angle A — you provide the menu; A picks).
- Dataset sourcing (angle B).
- Scoring methods deeply (angle C — you note which tools support which scoring shapes).
- The DX shape (angle E).
- Folder structure (angle F).

## Working rules

- Lean toward "build minimal" or "wrap" over "adopt heavy framework" if the lock-in dwarfs the value — that's the codebase's posture (see `feedback_email_splitter_no_llm` for the pattern: regex-only beat a whole LLM extractor when the surface was small).
- Use context7 for current docs on the major frameworks (promptfoo, braintrust, langsmith are most likely).
- Ground every claim with a citation (URL, repo path, doc page).
- Capture friction as zettels.
- Do NOT commit. Do NOT write outside `/workspaces/test-mvp/usegin/research/evals/landscape-buy-vs-build/`.

## Deliverable

Write `/workspaces/test-mvp/usegin/research/evals/landscape-buy-vs-build/whiteboard.md`:

```
## Top — the click
<Buy / build / wrap recommendation for v0 and v1, with the load-bearing
reason. E.g.: "v0: build minimal — 200 lines of Python around Anthropic
SDK + JSON case files + judge calls + commit-to-runs/. Don't adopt
{promptfoo|braintrust|langsmith} until we hit N>500 cases or want a
shared dashboard. Reason: lock-in dwarfs value at our current scale.">

## Middle — the body
<Tooling matrix: framework / license / hosting / agent-trace support /
SDK fit / lock-in cost. Peer-org practice section with quotes + URLs.
The "wrap" middle ground in concrete pseudocode (what those 200 lines
look like). When buy beats build (named threshold).>

## Bottom — the open ends
<Dilemmas in z026 shape (≥2). Friction zettels. Open questions: vendor
pricing/contract concerns? Hosting / data-residency for any cloud option?>
```

Return a ≤10-line summary in chat.
