---
name: Identity
handle: identity
type: explanation
context: How dx resolves the current user from environment signals
---

dx resolves the current user from environment signals in this order:

1. `$DX_USER` — explicit override (highest priority)
2. `$GITHUB_USER` — GitHub username
3. `$USER` — OS username
4. `whoami` — system command output
5. `git config user.name` — git user name
6. `git config user.email` — email prefix (before @)

Each signal is matched against user keys and aliases in config.json
(case-insensitive). Use `dx identify` to see which signals are active
and `dx whoami` to see the resolved identity.
