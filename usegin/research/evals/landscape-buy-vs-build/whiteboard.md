# Whiteboard — Angle D: Landscape / Buy vs. Build

_Professor: Poll-D (Sonnet). Filed: 2026-04-27._

---

## Top — the click

**v0: Build minimal. ~300 lines of Python around `anthropic` SDK + JSON case files + judge calls + flat `runs/` folder. Do not adopt any framework yet.**

Load-bearing reason: every cloud-first option (Braintrust, LangSmith) locks prompt storage, experiment metadata, and scoring rubrics into their data model before we have even 20 real cases. That lock-in cost is unbounded upward; the build cost is capped at a weekend. The only framework that passes the "no lock-in, self-host free, Pythonic" bar is **Langfuse** (MIT, self-hosted) or **Inspect AI** (MIT, CLI-first), and both still require more setup wiring than our 300-line wrapper. Adopt one of those two at v1 if case count exceeds ~100 and we need a shared trace dashboard — Langfuse for trace/observability, Inspect AI if we want reproducible safety-style task suites.

**Anthropic's own public guidance** (from the "Demystifying Evals for AI Agents" post, 2025, <https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents>) explicitly says: start with 20–50 tasks drawn from real failures, and early changes have large effect sizes so small samples suffice. That is v0 in a sentence.

---

## Middle — the body

### 1. Tooling matrix

| Framework | License | Hosting | Agent-trace support | Python SDK | Lock-in cost | Notes |
|---|---|---|---|---|---|---|
| **Promptfoo** | MIT (CLI/core); Enterprise for prod server | Self-host OSS (SQLite, not prod-recommended) or managed SaaS | Yes — OTel spans, trajectory assertions, tool-path scoring | JS-native; Python via subprocess/provider script | Medium — YAML config format, dashboard separate | [Docs](https://www.promptfoo.dev/docs/enterprise/). Acquired by OpenAI 2025; road-map uncertain. |
| **Braintrust** | Proprietary | Cloud-only control plane; hybrid self-host = enterprise contract | Yes — `braintrust.auto_instrument()`, OTel-compatible | Good Python SDK | High — data model, prompt store, scoring rubrics all cloud-locked | [Pricing](https://www.braintrust.dev/pricing). No self-serve free self-host. |
| **LangSmith** | Proprietary | Self-host available (`langsmith>=0.3.15`); full product in cloud | Yes — `OpenAIAgentsTracingProcessor`, generic tracing | Good Python SDK | High — LangChain ecosystem gravity; annotation/prompt store locked | [Self-host docs](https://docs.langchain.com/langsmith/self-hosted). Enterprise license required for self-host. |
| **Langfuse** | MIT (core + evals since Jun 2025) | Self-host free; needs ClickHouse cluster ($200–800/mo infra) | Yes — trace SDK, OTel | Good Python SDK | Low — open data model, Postgres + ClickHouse export | [Open-source announcement](https://langfuse.com/changelog/2025-06-04-open-sourcing-langfuse). Best "buy later" option for trace dashboard. |
| **Inspect AI (UK AISI)** | MIT | CLI / local; no SaaS | Yes — multi-turn agent tasks, tool-call workflows, Docker sandbox | Python-native (`pip install inspect-ai`) | Low — file-based task definitions, VS Code viewer | [GitHub](https://github.com/UKGovernmentBEIS/inspect_ai). Used by Anthropic + DeepMind internally. |
| **deepeval** | MIT (core); Confident AI cloud optional | Self-host or cloud | Yes — `@observe` decorators, `ToolCorrectnessMetric`, `StepEfficiencyMetric`, `ArgumentCorrectnessMetric` | Python-native | Low-medium — decorator-based instrumentation ties you to their span model | [Docs](https://github.com/confident-ai/deepeval). Best Python-native agent metrics. |
| **MLflow (GenAI)** | Apache 2.0 | Self-host or Databricks cloud | Yes — `mlflow.anthropic.autolog()` traces Claude Agent SDK natively | Python-native, first-class | Low — Apache; local server trivial | [MLflow blog](https://mlflow.org/blog/mlflow-autolog-claude-agents-sdk). Zero-setup autolog for our exact SDK (`claude-agent-sdk`). |
| **openai/evals** | MIT | CLI / local | Limited — designed for chat completions, agent evals need extra wiring | Python | Low | [GitHub](https://github.com/openai/evals). Benchmark registry; not a product-eval workflow. |
| **Helicone** | MIT (proxy) | Self-host or cloud | Observability only; no eval primitives | Python proxy SDK | Medium — prompt logging locked in proxy format | Not an eval framework; observability only. |
| **Phoenix/Arize** | MIT (Phoenix) | Self-host free | Yes — OTel native, agent traces | Python | Low-medium — OTel standard | Good for observability-first teams. |
| **ragas** | MIT | Local | No — RAG-specific metrics only | Python | Low | Out of scope for agentic evals without RAG. |
| **TruLens** | MIT | Local | Partial | Python | Low | Less maintained, fewer agent-specific metrics than deepeval. |

**Headline gap:** None of the cloud-first options (Braintrust, LangSmith) self-host freely. The ones that do (Langfuse, Inspect AI, MLflow, deepeval) all require more wiring than warranted at v0 case counts.

---

### 2. Peer-org practice

**Anthropic / Claude Code**
- Published: ["Demystifying Evals for AI Agents"](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (2025). Key quotes:
  - "Distinguish a _task_ (test case + success criteria) from a _trial_ (one stochastic run)."
  - "Collect the full transcript/trace including tool calls separately from the outcome."
  - "Start with 20–50 simple tasks drawn from real failures; early changes have large effect sizes."
  - "LLM-as-judge graders should be closely calibrated with human experts."
  - Human graders set the gold standard but don't scale — use them to calibrate model judges, not as the primary scorer.
- Claude Code itself uses a 4-sub-agent eval pipeline (executor + judges) in its `skill-creator` eval mode. ([Tessl blog](https://tessl.io/blog/anthropic-brings-evals-to-skill-creator-heres-why-thats-a-big-deal/))
- Anthropic's internal teams use **Inspect AI** as their primary eval runner — it is listed as an adopted-by-Anthropic framework. ([Inspect AI site](https://inspect.aisi.org.uk/))

**Replit Agent 3**
- Built a custom REPL-based verification system where the agent self-tests: "When App Testing is on, the Agent periodically decides to test the application — clicks around the app, checks buttons, forms, APIs, data sources." Proprietary; no open framework. ([Replit blog](https://blog.replit.com/automated-self-testing))
- Key insight: they co-located the eval loop _inside_ the agent's execution loop, not as an external harness.

**Devin (Cognition)**
- Public signal: SWE-bench score (13.86% original; later higher with full env). Their eval is the benchmark itself — they use standardized coding benchmarks rather than a product-specific framework. No public details on internal evals. ([Trickle blog](https://trickle.so/blog/devin-ai-or-cursor))

**Cursor**
- No public eval methodology post. Cursor tracks real user behavior (focus share, switching rates, rolling engagement) rather than offline evals. ([Render blog](https://render.com/blog/ai-coding-agents-benchmark)) Insight: real-user behavioral signal is their primary quality signal, not offline benchmarks.

**Aider**
- No dedicated public eval framework post found. Uses SWE-bench as external benchmark. Internal regression: capability evals that pass graduate to a continuously-run regression suite. ([arxiv](https://www.arxiv.org/pdf/2510.18270))

**Continue / other OSS coding agents**
- No public eval methodology documentation found.

**Summary of peer-org pattern:** Anthropic is the only one with a published eval philosophy for agent products. The common thread across all: start with real failures, not synthetic. Judgment (human or model-as-judge) calibrated against gold cases. Benchmarks (SWE-bench) used for model selection, not product iteration.

---

### 3. The "wrap" middle ground — concrete pseudocode

This is what v0 actually looks like. ~300 lines, no framework dep:

```python
# usegin/evals/runner.py
import json, pathlib, datetime, anthropic
from typing import Any

CASES_DIR = pathlib.Path("cases/")
RUNS_DIR  = pathlib.Path("runs/")
client    = anthropic.Anthropic()

def load_cases(tag: str | None = None) -> list[dict]:
    cases = [json.loads(p.read_text()) for p in CASES_DIR.glob("*.json")]
    return [c for c in cases if tag is None or tag in c.get("tags", [])]

def run_agent(case: dict) -> dict:
    """Call the actual agent (Effi or Gin skill) and capture transcript."""
    # Thin wrapper over claude-agent-sdk or anthropic.messages.create
    messages = case["messages"]
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=messages,
        system=case.get("system", ""),
    )
    return {"output": response.content[0].text, "raw": response.model_dump()}

def judge(case: dict, output: dict) -> dict:
    """LLM-as-judge: isolated scorer per dimension."""
    rubric = case["rubric"]  # e.g. {"citation_present": "...", "no_hallucination": "..."}
    scores = {}
    for dim, criteria in rubric.items():
        r = client.messages.create(
            model="claude-haiku-4-5",  # cheap judge
            max_tokens=256,
            messages=[{
                "role": "user",
                "content": (
                    f"Criteria: {criteria}\n\n"
                    f"Agent output:\n{output['output']}\n\n"
                    "Score: PASS or FAIL. One word only."
                )
            }],
        )
        scores[dim] = r.content[0].text.strip()
    return scores

def run_suite(tag: str | None = None) -> pathlib.Path:
    cases = load_cases(tag)
    results = []
    for c in cases:
        out   = run_agent(c)
        score = judge(c, out)
        results.append({"case_id": c["id"], "output": out["output"], "scores": score})
    run_id  = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True)
    (run_dir / "results.json").write_text(json.dumps(results, indent=2))
    _write_summary(run_dir, results)
    return run_dir

def _write_summary(run_dir: pathlib.Path, results: list[dict]) -> None:
    total = len(results)
    by_dim: dict[str, Any] = {}
    for r in results:
        for dim, verdict in r["scores"].items():
            by_dim.setdefault(dim, {"PASS": 0, "FAIL": 0})[verdict] += 1
    summary = {"total": total, "by_dimension": by_dim}
    (run_dir / "summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    import sys
    tag = sys.argv[1] if len(sys.argv) > 1 else None
    path = run_suite(tag)
    print(f"Run written to {path}")
```

**Case file shape** (`cases/effi-citation-001.json`):
```json
{
  "id": "effi-citation-001",
  "tags": ["effi", "citation"],
  "messages": [{"role": "user", "content": "What is our refund policy?"}],
  "system": "...",
  "rubric": {
    "citation_present": "The output cites at least one source document by name.",
    "no_hallucination": "The output does not invent policy terms not in the context."
  }
}
```

**What this gives you:** reproducible run history in `runs/`, no vendor lock, no dashboard dep, trivially headless (Gin calls `uv run python runner.py effi` in a swarm), extends to Claude Agent SDK by swapping `run_agent`. Cost: two API calls per case per dimension — with `claude-haiku-4-5` as judge, ~$0.002/case/dimension.

---

### 4. When buy beats build (named thresholds)

| Signal | Threshold | Action |
|---|---|---|
| Case count grows | >100 active cases | Add Langfuse trace logging (MIT, self-host, low lock-in) |
| Team needs shared dashboard | Oria + Lihu both need to browse runs | Langfuse self-host OR read `runs/*.json` via a 50-line Bun static viewer |
| Want safety-style task suites with Docker sandbox | Building agent capability evals, not product evals | Adopt Inspect AI (MIT, Anthropic uses it internally) |
| Need automated CI scoring against PRs | PR gate required | Add MLflow autolog (Apache 2.0, `mlflow.anthropic.autolog()` = zero lines for Claude Agent SDK) |
| Want multi-dimensional agent-trace metrics (ToolCorrectness, StepEfficiency) | Agents have complex tool call chains worth measuring per-step | Adopt deepeval (MIT, Python-native) |

Do NOT adopt Braintrust or LangSmith until: (a) you need their shared prompt-store feature, AND (b) you have negotiated a data-residency clause, AND (c) you have >500 cases. Their lock-in cost exceeds value at our current scale.

---

## Bottom — the open ends

### Dilemmas (z026 shape)

**Dilemma 1 — Effi vs. Gin evals share a runner, not a case format.**
- Option A: One `runner.py` with a `surface` field (`"effi"` / `"gin"`). Simpler, less isolation.
- Option B: Two separate runners in `evals/effi/` and `evals/gin/`, sharing a `lib/judge.py`. More isolation, more files.
- Signal needed from angle A (v0-click) and angle F (subapp-shape).
- Price of A: test pollution if Effi and Gin rubrics diverge. Price of B: duplicated boilerplate.

**Dilemma 2 — MLflow autolog vs. hand-rolled transcript capture.**
- MLflow's `mlflow.anthropic.autolog()` gives zero-instrumentation trace capture for `claude-agent-sdk` — exactly our SDK. But it pulls in Databricks/MLflow ecosystem gravity.
- Versus: hand-rolling `with open(run_dir / "trace.jsonl", "a") as f: f.write(...)` gives zero dep but we lose the structured span model.
- The MLflow option is genuinely tempting at v0 if self-hosted MLflow adds no complexity. Risk: MLflow server adds infra complexity early. Recommend: hand-roll at v0, revisit at v1.

**Dilemma 3 — Judge model: Haiku vs. Sonnet for calibration.**
- Haiku is cheap (~$0.002/call) but calibration against human gold is unverified.
- Anthropic guidance: "closely calibrate with human experts." At v0 with 20–50 cases, one human calibration pass is feasible.
- Action for angle C (scoring-methods): specify the calibration protocol.

### Friction zettels

None filed — research proceeded cleanly from web search + context7. One friction noted: Inspect AI web search returned `unavailable` on first attempt; resolved by retry with broader query. No blocking friction warranted a zettel.

### Open vendor / hosting questions for angle A to resolve

- **Braintrust** has no self-serve pricing page; "contact sales" only. If budget exists, pricing range unknown. Skip for now.
- **LangSmith** self-host requires enterprise license — cost unknown. Skip for now.
- **Langfuse** self-host infra cost: $200–800/mo (ClickHouse). Relevant only at v1.
- **Data residency**: all Effi eval cases contain real user conversation excerpts. Any cloud-upload to Braintrust/LangSmith requires a DPA and data classification review. This is a blocking concern if we ever go cloud. Build-minimal sidesteps it entirely.

---

_Sources consulted:_
- [Anthropic: Demystifying Evals for AI Agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Inspect AI — UK AISI](https://inspect.aisi.org.uk/) | [GitHub](https://github.com/UKGovernmentBEIS/inspect_ai)
- [Promptfoo GitHub](https://github.com/promptfoo/promptfoo) | [Self-hosting](https://www.promptfoo.dev/docs/usage/self-hosting/)
- [Braintrust Pricing](https://www.braintrust.dev/pricing)
- [LangSmith Self-host](https://docs.langchain.com/langsmith/self-hosted)
- [Langfuse Open-sourcing (Jun 2025)](https://langfuse.com/changelog/2025-06-04-open-sourcing-langfuse)
- [deepeval agent metrics](https://github.com/confident-ai/deepeval/blob/main/docs/guides/guides-ai-agent-evaluation-metrics.mdx)
- [MLflow + Claude Agent SDK autolog](https://mlflow.org/blog/mlflow-autolog-claude-agents-sdk)
- [Replit self-testing blog](https://blog.replit.com/automated-self-testing)
- [openai/evals GitHub](https://github.com/openai/evals)
