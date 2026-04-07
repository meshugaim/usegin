---
title: Git churn and complexity analysis
handle: code-metrics
tags: [analysis, git, quality]
context: When investigating code hot spots
---

`code-metrics` shows git churn (how often files change) and complexity
metrics. Great for finding high-churn, high-complexity files that are
prime refactoring candidates.

Run `code-metrics --since 30d` to focus on recent activity.
