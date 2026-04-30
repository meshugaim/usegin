---
match: \bpython3?\s+-c\b.*\bimport\s+json\b
prefer: Reach for `jq` first in shell pipelines — only use `python -c "import json"` when the transform genuinely needs Python.
---

# Why

`jq` is purpose-built for JSON in shell pipelines: shorter, faster to read, no quoting gymnastics, no `import` ceremony.

```bash
# Prefer
curl -s api/x | jq '.items[].name'

# Over
curl -s api/x | python3 -c 'import sys, json; print("\n".join(i["name"] for i in json.load(sys.stdin)["items"]))'
```

Use Python only when the JSON work is one step inside a larger Python computation.

Linked memory: `feedback_prefer_jq_over_python.md`.
