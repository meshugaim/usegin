---
name: adding-vscode-extensions
description: This skill should be used when the user wants to add VS Code extensions to the project. Triggered by phrases like "add extension", "install VS Code extension", "add [extension name] to vscode", or "we need the [extension name] extension". Handles adding extensions to both workspace and devcontainer configs.
---

# Adding VS Code Extensions

## Overview

This skill helps add VS Code extensions to the project configuration, ensuring they're recommended for all developers working in the codebase. Extensions are added to both workspace and devcontainer configurations.

**Core principle:** Add extensions to both configs to ensure consistent developer experience across local and containerized environments.

## When to Use

Use this skill when the user wants to add a VS Code extension. Common trigger phrases include:

- "add [extension] extension"
- "install [extension] to vscode"
- "add [extension] to the project"
- "we need the [extension] extension"
- "can you add [extension]"

## Workflow

### Step 1: Identify the Extension ID

Determine the correct VS Code extension identifier:
- Format is typically `publisher.extension-name`
- If the user provides a full name or description, search for the correct ID
- Common extensions:
  - `ms-vsliveshare.vsliveshare` - Live Share
  - `dbaeumer.vscode-eslint` - ESLint
  - `esbenp.prettier-vscode` - Prettier
  - `ms-python.python` - Python
  - `bradlc.vscode-tailwindcss` - Tailwind CSS
  - `skellock.just` - Just (justfile support)

If uncertain about the extension ID, ask the user for clarification or search the VS Code marketplace.

### Step 2: Add to Workspace Configuration

Add the extension to `.vscode/extensions.json`:

```json
{
    "recommendations": [
        "existing.extension",
        "new.extension-id"
    ]
}
```

**Important:**
- Maintain alphabetical order (optional but nice)
- Keep proper JSON formatting
- Don't duplicate existing extensions

### Step 3: Add to Devcontainer Configuration

Add the same extension to `.devcontainer/devcontainer.json` in the `customizations.vscode.extensions` array:

```json
{
    "customizations": {
        "vscode": {
            "extensions": [
                "existing.extension",
                "new.extension-id"
            ]
        }
    }
}
```

**Important:**
- Maintain the same order as workspace config
- Ensure both configs stay in sync

### Step 4: Confirm Changes

Inform the user:
- Which extension(s) were added
- Which files were modified
- That the extensions will be recommended when developers open the workspace

## Best Practices

- **Always add to both configs:** Keep workspace and devcontainer in sync
- **Use exact extension IDs:** Don't guess - use the correct publisher.name format
- **Don't add too many:** Only add extensions that are truly needed for the project
- **Consider the team:** Add extensions that benefit the whole team, not personal preferences

## Common Extensions

Here are common extensions and their IDs:

**Language Support:**
- `ms-python.python` - Python language support
- `ms-python.vscode-pylance` - Python language server
- `golang.go` - Go language support
- `rust-lang.rust-analyzer` - Rust language support

**Frameworks & Tools:**
- `bradlc.vscode-tailwindcss` - Tailwind CSS IntelliSense
- `dbaeumer.vscode-eslint` - ESLint
- `esbenp.prettier-vscode` - Prettier code formatter
- `skellock.just` - Justfile support

**Collaboration:**
- `ms-vsliveshare.vsliveshare` - Live Share

**Testing:**
- `ms-playwright.playwright` - Playwright Test
- `hbenl.vscode-test-explorer` - Test Explorer

**DevOps:**
- `ms-azuretools.vscode-docker` - Docker
- `ms-kubernetes-tools.vscode-kubernetes-tools` - Kubernetes

## Example Usage

**User request:** "Add the Python extension to the project"

**Actions:**
1. Identify extension ID: `ms-python.python`
2. Add to `.vscode/extensions.json`
3. Add to `.devcontainer/devcontainer.json`
4. Confirm: "Added Python extension (`ms-python.python`) to both workspace and devcontainer configs"

**User request:** "We need Prettier and ESLint"

**Actions:**
1. Identify both extension IDs
2. Add both to `.vscode/extensions.json`
3. Add both to `.devcontainer/devcontainer.json`
4. Confirm which extensions were added

## Common Pitfalls

- ❌ Only adding to one config file
- ❌ Using incorrect extension IDs
- ❌ Duplicating existing extensions
- ❌ Adding personal preference extensions that don't benefit the team
- ✅ Adding to both workspace and devcontainer
- ✅ Verifying extension IDs
- ✅ Checking for duplicates first
- ✅ Adding team-beneficial extensions only
