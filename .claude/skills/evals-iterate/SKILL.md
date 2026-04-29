---
name: evals-iterate
description: "Engaged when `dx evals iterate` runs. Locks framework/scorers, framework/judges, <corpus>/cases, <corpus>/dogs, <corpus>/baselines, and the original (non-sandbox) prompt path from worker edits. Workers must write to usegin/evals/sandbox/ instead. Mirrors tdd-execute's PreToolUse hook shape — same JSON-in / exit-code-out protocol."
triggers:
  - "/evals iterate"
  - "let claude iterate on the prompt"
  - "iterate the prompt against the dog"
hooks:
  PreToolUse:
    - matcher: "Write|Edit|MultiEdit|NotebookEdit"
      hooks:
        - type: command
          command: "bash .claude/skills/evals-iterate/hooks/pre-tool-use.sh"
---

# evals-iterate

Skill that hardens `dx evals iterate` against the Goodhart pressure it
creates. The Director is a Bun process, but mutation workers are headless
Claude sessions — and any agent operating inside an iterate run could in
principle "fix the eval" instead of fixing the prompt. The hook prevents that
structurally.

## What the hook locks

- `usegin/evals/framework/scorers/**` — structural scorer code
- `usegin/evals/framework/judges/**` — judge prompts (fork-on-edit, never
  in-place)
- `usegin/evals/<corpus>/cases/**` — eval cases
- `usegin/evals/<corpus>/dogs/**` — Definitions of Good
- `usegin/evals/<corpus>/baselines/**` — baseline pointers (Lihu-only)
- `usegin/evals/<corpus>/prompts/<name>.md` — the original (non-sandbox)
  prompt path. Workers MUST write to the sandbox copy under
  `usegin/evals/sandbox/<run-id>/...`.

## What the hook allows

- `usegin/evals/sandbox/**` — always. This is the worker scratch path.
- Anything outside `usegin/evals/**` — the hook is scoped to the eval substrate.

## Protocol

PreToolUse hook reads tool-call JSON from stdin (Claude Code hook protocol).
On a denied path, it emits `{hookSpecificOutput.permissionDecision: "deny"}`
to stdout with exit code 0 (the deny is the signal, not the exit code) —
matching the shape used by `.claude/skills/tdd-execute/hooks/gate-edit-by-phase.ts`.

Best-effort: malformed input → allow. The hook never crashes a tool call.

## v0 status

The hook is in place; iterate runs invoked through `dx evals iterate` will
exercise it. S6 will wire the skill into a real running session.

## Cross-references

- `usegin/evals/principles/04-dog-driven-iteration.md` — why this lock
  exists.
- `usegin/evals/principles/05-anti-goodhart.md` — the broader defense.
- `.claude/skills/tdd-execute/SKILL.md` — same hook shape, different paths.
