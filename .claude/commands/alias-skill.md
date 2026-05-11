---
description: How to alias a skill — a 5-line stub `SKILL.md` whose description says "alias for /<real-skill>". Shown via the commit that added `/wt`.
---

# Aliasing a skill

Drop a `SKILL.md` with empty body; the `description` line tells future-you (Claude) to call the real skill:

!`git show e072fa0b784f5b79e9fbca932c7ade3cdf71225b`

That's it. No symlink, no redirect logic — the harness lists the alias by name, the description routes the call.
