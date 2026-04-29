#!/usr/bin/env bash
#
# evals-iterate PreToolUse hook (S5).
#
# Locks the eval substrate against worker edits. Mirrors the shape of
# .claude/skills/tdd-execute/hooks/gate-edit-by-phase.ts:
#
#   - Read tool-call JSON from stdin.
#   - If tool is Edit|Write|MultiEdit|NotebookEdit AND the target path matches
#     a locked glob, emit a deny JSON to stdout (exit 0).
#   - Otherwise: silent exit 0 (allow).
#
# Best-effort: malformed input → allow. Never block a legitimate tool call
# because of a hook bug.

set -u

# Env-gate (Ron #12): the hook is a no-op outside iterate runs. The Director
# (`dx evals iterate`) sets EVALS_ITERATE_RUN_ID before spawning workers;
# without it, this hook MUST allow all edits or it bricks every Edit/Write
# call across the whole session.
if [ -z "${EVALS_ITERATE_RUN_ID:-}" ]; then
  exit 0
fi

# Read full stdin.
input="$(cat || true)"
if [ -z "$input" ]; then
  exit 0
fi

# Pluck tool_name and tool_input.file_path with a tiny regex.
# We avoid jq because hook scripts must be portable; the JSON shape is
# stable enough that a pair of greps suffices.
tool_name="$(printf '%s' "$input" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')"
case "$tool_name" in
  Edit|Write|MultiEdit|NotebookEdit) ;;
  *) exit 0 ;;
esac

file_path="$(printf '%s' "$input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')"
if [ -z "$file_path" ]; then
  exit 0
fi

# Sandbox is always allowed.
case "$file_path" in
  *"/usegin/evals/sandbox/"*|"usegin/evals/sandbox/"*)
    exit 0
    ;;
esac

# Locked patterns. Each line: a glob fragment we look for as a substring.
# We use case statements (POSIX) instead of [[ =~ regex for portability.
deny_reason=""
case "$file_path" in
  *"/usegin/evals/framework/scorers/"*|"usegin/evals/framework/scorers/"*)
    deny_reason="usegin/evals/framework/scorers/** is locked during iterate runs (workers cannot edit scorer code)."
    ;;
  *"/usegin/evals/framework/judges/"*|"usegin/evals/framework/judges/"*)
    deny_reason="usegin/evals/framework/judges/** is locked (judges fork-on-edit; never in-place)."
    ;;
esac

# Per-corpus paths (effi, gin)
if [ -z "$deny_reason" ]; then
  for corpus in effi gin; do
    case "$file_path" in
      *"/usegin/evals/${corpus}/cases/"*|"usegin/evals/${corpus}/cases/"*)
        deny_reason="usegin/evals/${corpus}/cases/** is locked during iterate runs (workers cannot edit eval cases)."
        break
        ;;
      *"/usegin/evals/${corpus}/dogs/"*|"usegin/evals/${corpus}/dogs/"*)
        deny_reason="usegin/evals/${corpus}/dogs/** is locked during iterate runs (workers cannot edit DoGs)."
        break
        ;;
      *"/usegin/evals/${corpus}/baselines/"*|"usegin/evals/${corpus}/baselines/"*)
        deny_reason="usegin/evals/${corpus}/baselines/** is locked (baseline bumps are Lihu-only)."
        break
        ;;
    esac

    # Original prompt: usegin/evals/<corpus>/prompts/<name>.md (NOT sandbox).
    # The sandbox case is handled above; this branch only fires for the
    # in-corpus prompt path.
    case "$file_path" in
      *"/usegin/evals/${corpus}/prompts/"*.md|"usegin/evals/${corpus}/prompts/"*.md)
        deny_reason="usegin/evals/${corpus}/prompts/<name>.md is locked during iterate runs — write to usegin/evals/sandbox/<run-id>/... instead."
        break
        ;;
    esac
  done
fi

if [ -n "$deny_reason" ]; then
  # Emit Channel B (JSON) deny — same shape tdd-execute uses.
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":%s}}\n' \
    "\"$(printf '%s' "$deny_reason" | sed 's/\\/\\\\/g; s/"/\\"/g')\""
  exit 0
fi

exit 0
