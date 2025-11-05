---
name: working-with-claude-agent-sdk
description: Use this skill when working with code that uses the Anthropic Claude Agent SDK. Triggered by phrases like "use the SDK", "ClaudeSDKClient", "claude_agent_sdk", or when working in agent_api code.
---

# Working with Claude Agent SDK

When working with code that uses `claude_agent_sdk`, always reference the SDK source code cloned at `.ignored/anthropic/claude-agent-sdk-python/` for accurate implementation details.

**Key info:**
- SDK source (for reference): `.ignored/anthropic/claude-agent-sdk-python/`
- Our code using SDK: `python-services/agent_api/`
- Main client class: `ClaudeSDKClient`

**Always check the SDK source** to understand:
- Method signatures and parameters
- Return types and data structures
- How features actually work
- Available options and configuration

Use the local clone as grounding truth instead of guessing SDK behavior.
