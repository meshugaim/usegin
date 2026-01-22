---
name: experiment
description: Run SDK experiments in the python-services sandbox. Triggered by "run experiment", "test SDK behavior", "experiment with", or when investigating Claude Agent SDK behavior.
---

# SDK Experiment Environment

Use this skill to test Claude Agent SDK behavior before making production changes.

## Location

```
python-services/experiments/
```

This directory is **gitignored** - safe to modify freely without affecting production.

## Running Experiments

From `python-services/`:

```bash
# Run any experiment script
uv run python experiments/<script_name>.py

# Main SDK experiment with multiple modes
uv run python experiments/sdk_experiment.py --mode=mock     # No SDK calls, instant
uv run python experiments/sdk_experiment.py --mode=real     # Actual SDK calls
uv run python experiments/sdk_experiment.py --mode=bad-key  # Test auth failures
uv run python experiments/sdk_experiment.py --mode=info     # Print exception types
uv run python experiments/sdk_experiment.py --mode=all      # Run everything
```

## Available Experiments

| File | Purpose |
|------|---------|
| `sdk_experiment.py` | Main experiment - mock/real/bad-key/info modes |
| `stream_timing_experiment.py` | Stream event timing analysis |
| `stream_event_ordering_experiment.py` | Event ordering tests |
| `partial_messages_experiment.py` | Partial message handling |
| `test_network_error.py` | Network error handling |
| `test_auth_fallback_*.py` | Auth fallback patterns |
| `test_billing_error.py` | Billing error handling |
| `test_max_turns_error.py` | Max turns exceeded errors |
| `test_max_budget_error.py` | Budget exceeded errors |
| `test_tool_error.py` | Tool execution errors |

## Reference Docs

- `experiments/README.md` - Full environment documentation
- `experiments/claude_sdk_error_mapping.md` - SDK error type reference
- `experiments/HANDOFF_AUTH_ERROR_HANDLING.md` - Auth error handling notes

## Creating New Experiments

1. Create a new `.py` file in `experiments/`
2. Import from SDK or production code as needed:
   ```python
   from claude_code_sdk import query, ClaudeCodeSDKError
   from agent_api.agent.message_processor import process_message
   ```
3. Run with `uv run python experiments/your_script.py`
4. Iterate freely - it's gitignored

## Key SDK Types

### AssistantMessage Fields
- `content: list[ContentBlock]` - Response content
- `model: str` - Model that generated response
- `error: Literal["authentication_failed", "billing_error", "rate_limit", "invalid_request", "server_error", "unknown"] | None`

### ResultMessage Fields
- `is_error: bool` - Whether an error occurred
- `duration_ms: int` - Total duration
- `total_cost_usd: float` - Request cost
- `usage: dict` - Token usage

### SDK Exceptions
- `ClaudeSDKError` - Base exception
- `CLIConnectionError` - Failed to connect
- `CLINotFoundError` - CLI not found
- `ProcessError` - CLI process failed (has `exit_code`, `stderr`)
- `CLIJSONDecodeError` - Invalid JSON from CLI
- `MessageParseError` - Failed to parse message

## Typical Workflow

1. **Explore** - Run existing experiments to understand current behavior
2. **Create** - Write new experiment in `experiments/`
3. **Test** - Verify behavior with mock and real SDK calls
4. **Apply** - Once verified, update production code in `agent_api/`
5. **Test** - Add proper tests in `tests/`

## Environment

Uses the same `.env` as python-services. Requires valid `ANTHROPIC_API_KEY` for real SDK calls.

## See Also

- [working-with-claude-agent-sdk skill](../working-with-claude-agent-sdk/SKILL.md) - SDK usage in production code
- `python-services/agent_api/agent/` - Production agent implementation
