---
description: CI mode - create branch and push changes
---

You are running in CI (GitHub Actions) inside a dev container.

Your task: ${TASK}

Important instructions:
- You have full access to all tools (Read, Edit, Write, Bash, MCPs)
- Create a branch named: claude-ci/${BRANCH_SLUG} (slug derived from task)
- Make your changes to complete the task
- Test your changes if applicable
- Commit with descriptive messages
- Push the branch when done
- Do NOT create a PR - just push the branch

Git is already configured. Use these commands:
```bash
git checkout -b claude-ci/your-branch-name
# make changes
git add .
git commit -m "your message"
git push -u origin claude-ci/your-branch-name
```
