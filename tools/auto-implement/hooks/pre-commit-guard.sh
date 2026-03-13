#!/usr/bin/env bash
#
# Auto-implement hook: pre-commit gate
#
# Installed to .git/hooks/pre-commit during auto-implement sessions.
# Two checks:
#   1. Commit size — reject if >8 staged files
#   2. TDD gate — reject if implementation files staged without test files
#      (skipped if the active Linear issue has `tdd:skip` label)
#
# Exit codes:
#   0 = allow commit
#   1 = reject commit
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MAX_STAGED_FILES=8
CONTEXT_FILE="/tmp/auto-impl-context.json"

# ---------------------------------------------------------------------------
# Gate 1: Commit size
# ---------------------------------------------------------------------------
staged_files=$(git diff --cached --name-only --diff-filter=ACMR)
staged_count=$(echo "$staged_files" | grep -c . || true)

if [ "$staged_count" -gt "$MAX_STAGED_FILES" ]; then
  echo "" >&2
  echo "⛔ BLOCKED: $staged_count staged files (max $MAX_STAGED_FILES)." >&2
  echo "" >&2
  echo "Commit smaller chunks. Split this into multiple commits." >&2
  echo "" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Gate 2: TDD — implementation files require test files
# ---------------------------------------------------------------------------

# Check for tdd:skip label on current issue
has_tdd_skip=false
if [ -f "$CONTEXT_FILE" ]; then
  issue_id=$(grep -o '"spec_id":"[^"]*"' "$CONTEXT_FILE" | head -1 | cut -d'"' -f4 || true)
  if [ -n "$issue_id" ]; then
    # Query Linear for labels — fail closed (if query fails, require tests)
    labels=$(plan show "$issue_id" --json 2>/dev/null | grep -o '"labels":\[[^]]*\]' || true)
    if echo "$labels" | grep -qi "tdd:skip"; then
      has_tdd_skip=true
    fi
  fi
fi

if [ "$has_tdd_skip" = true ]; then
  # TDD gate skipped for this issue
  exit 0
fi

# Implementation file patterns that require tests
# Matches: .ts/.tsx/.py files in logic paths
impl_files=""
while IFS= read -r file; do
  [ -z "$file" ] && continue

  # Skip test files themselves
  echo "$file" | grep -qE '\.(test|spec)\.(ts|tsx|py)$' && continue
  echo "$file" | grep -qE '^.*/tests/' && continue
  echo "$file" | grep -qE 'test_.*\.py$' && continue
  echo "$file" | grep -qE 'conftest\.py$' && continue

  # Skip non-logic files
  echo "$file" | grep -qE '\.(css|scss|md|json|yaml|yml|svg|png|jpg|ico)$' && continue
  echo "$file" | grep -qE '\.d\.ts$' && continue
  echo "$file" | grep -qE 'types\.ts$' && continue

  # Match logic paths in Next.js app
  if echo "$file" | grep -qE '^nextjs-app/app/(actions|api)/'; then
    impl_files="$impl_files$file"$'\n'
    continue
  fi
  # Components/logic in app directory (not route files which are thin wrappers)
  if echo "$file" | grep -qE '^nextjs-app/app/.*\.tsx?$' && echo "$file" | grep -qvE '(layout|page|loading|error|not-found)\.tsx$'; then
    impl_files="$impl_files$file"$'\n'
    continue
  fi
  # Lib modules
  if echo "$file" | grep -qE '^nextjs-app/(lib|hooks|components)/.*\.(ts|tsx)$'; then
    impl_files="$impl_files$file"$'\n'
    continue
  fi

  # Match logic paths in Python services
  if echo "$file" | grep -qE '^python-services/agent_api/.*\.py$'; then
    impl_files="$impl_files$file"$'\n'
    continue
  fi
done <<< "$staged_files"

# Remove trailing newline
impl_files=$(echo "$impl_files" | sed '/^$/d')

if [ -z "$impl_files" ]; then
  # No implementation files — allow (config, migrations, etc.)
  exit 0
fi

# Check if any test files are also staged
has_test_files=false
while IFS= read -r file; do
  [ -z "$file" ] && continue
  if echo "$file" | grep -qE '\.(test|spec)\.(ts|tsx)$'; then
    has_test_files=true
    break
  fi
  if echo "$file" | grep -qE 'test_.*\.py$'; then
    has_test_files=true
    break
  fi
done <<< "$staged_files"

if [ "$has_test_files" = false ]; then
  echo "" >&2
  echo "⛔ BLOCKED: Implementation files staged without tests." >&2
  echo "" >&2
  echo "Implementation files:" >&2
  echo "$impl_files" | sed 's/^/  /' >&2
  echo "" >&2
  echo "Write tests first (TDD), then commit tests + implementation together." >&2
  echo "If this slice doesn't need tests, add the 'tdd:skip' label to the Linear issue." >&2
  echo "" >&2
  exit 1
fi

exit 0
