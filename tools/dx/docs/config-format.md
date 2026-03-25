---
name: Config Format
handle: config-format
type: reference
context: Structure of .dx/config.json and .dx/config.local.json
---

The dx config lives in `.dx/config.json` with two top-level keys:

**features** — registered feature toggles:
  Each feature has `description`, `mechanism`, and `default` (boolean).

**users** — per-person overrides:
  Each user entry has `aliases` (array of strings for identity matching)
  and `overrides` (map of feature name to boolean).

Local overrides live in `.dx/config.local.json` (gitignored) with a single
`overrides` key. Local overrides take highest priority in the three-layer merge:
  default -> user-override -> local-override
