---
name: Adding Features
handle: adding-features
type: how-to
context: How to register a new dx feature toggle and gate it in code
---

To add a new feature toggle:

1. Register the feature in `.dx/config.json` under the `features` key:
   ```json
   "my-feature": {
     "description": "What this feature does",
     "mechanism": "How it is gated (e.g. hook, SDK check)",
     "default": true
   }
   ```

2. Gate the feature in code using the SDK:
   ```typescript
   import dx from "../../dx/sdk";
   if (dx.isEnabled("my-feature")) { /* ... */ }
   ```

3. Or gate in bash:
   ```bash
   if dx resolve my-feature --exit-code; then echo "on"; fi
   ```
