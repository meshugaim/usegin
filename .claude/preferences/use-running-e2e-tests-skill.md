---
match: \be2e\s+(run|up|build|down)\b
prefer: Use the `/running-e2e-tests` skill for setup steps and troubleshooting; read `tests/e2e/CLAUDE.md` for the full local e2e ritual.
---

# Why

The `e2e` wrapper is the right entry point, but the wrapper alone doesn't tell you about port conflicts, seed data prerequisites, or how to interpret a flaky failure. The skill captures the full ritual.

Origin: pre-existing `checkE2eSkillReminder` inline in `pre-bash.ts`, migrated 2026-04-30 (ENG-5515) when the wrapper-rules array became file-based.
