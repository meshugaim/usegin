---
name: adding-vscode-extensions
description: This skill should be used when the user wants to add VS Code extensions to the project. Triggered by phrases like "add extension", "install VS Code extension", "add [extension name] to vscode", or "we need the [extension name] extension". Handles adding extensions to both workspace and devcontainer configs.
---

# Adding VS Code Extensions

When adding extensions, update BOTH files:

1. **`.vscode/extensions.json`** - in the `recommendations` array
2. **`.devcontainer/devcontainer.json`** - in the `customizations.vscode.extensions` array

Extension IDs are in `publisher.extension-name` format (e.g., `ms-python.python`, `dbaeumer.vscode-eslint`).

Keep both files in sync - same extensions, same order.
