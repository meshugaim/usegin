---
name: updating-automations-yaml
description: This skill should be used when the user wants to update Gitpod automations. Triggered by phrases like "update automations", "apply automations", "reload automations.yaml", or "changes to automations".
---

# Updating Gitpod Automations

Apply changes from `automations.yaml` to the current Gitpod environment.

## Format

Tasks must be an **object**, not an array:

```yaml
tasks:
  task-name:
    command: |
      echo "Your commands here"
    triggeredBy:
      - postDevcontainerStart
```

## Commands

```bash
# Validate before applying
gp automations validate automations.yaml

# Apply changes to current environment
gp automations update automations.yaml --set-on-environment
```

## Common Events

- `postDevcontainerStart` - After devcontainer starts
- `postEnvironmentStart` - After environment starts
- `preEnvironmentStop` - Before environment stops

Use `gp automations --help` for full CLI reference.
