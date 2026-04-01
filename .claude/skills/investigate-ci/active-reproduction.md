# Active Reproduction in CI

When the failure smells like infra/environment (credentials, secrets, CI-only behavior), don't just read logs — **reproduce it actively**.

## The debug-runner workflow

`.github/workflows/debug-runner.yml` is a lightweight workflow-dispatch that sets up the Python environment with CI secrets and runs either an arbitrary shell command or a Claude SDK prompt. It completes in ~30 seconds (setup only, no Supabase/Next.js).

### Examples

```bash
# Test if OAuth credentials work in CI
gh workflow run debug-runner.yml -f prompt="Say hi" -f auth_mode=oauth

# Test API key auth
gh workflow run debug-runner.yml -f prompt="Say hi" -f auth_mode=api_key

# Run a specific integration test with CI secrets
gh workflow run debug-runner.yml -f command='uv run pytest tests/integration/claude/test_auth_switching.py -v -k test_oauth'

# Check what env vars are available
gh workflow run debug-runner.yml -f command='env | grep -E "CLAUDE|ANTHROPIC|APP_" | sed "s/=.*/=***/"'
```

### Watching results

```bash
# Wait for it to finish
gh run list --workflow=debug-runner.yml --limit 2

# Read the output
gh run view <run-id> --log | grep -E "(Auth:|Response:|SUCCESS|FAIL|Error)"
```

## When to build a custom workflow

If the debug-runner doesn't cover your case (e.g., needs Supabase, Next.js, or browser), consider creating a temporary workflow-dispatch workflow tailored to the issue. Read `debug-runner.yml` for the pattern — it's minimal and easy to extend.

## Real example

The e2e `admin-auth-switching` tests were failing with `"Unexpected log in Python API: retrying with"`. Logs showed the agent was retrying auth, but didn't say *why*. Two debug-runner dispatches revealed:

- **OAuth**: worked fine, got a response
- **API key**: `"Credit balance is too low"` — the `APP_ANTHROPIC_API_KEY` account was out of credits

Root cause found in under 2 minutes, no code changes needed.
