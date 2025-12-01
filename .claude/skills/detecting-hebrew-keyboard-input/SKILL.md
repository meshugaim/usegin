---
name: detecting-hebrew-keyboard-input
description: Detects when user input contains Hebrew characters that were likely meant to be English (wrong keyboard layout). Automatically converts and uses the intended text.
---

# Detecting Hebrew Keyboard Input

## When to Use

When user input contains Hebrew characters that don't make sense in context - likely typed with wrong keyboard layout active.

## Detection

Look for Hebrew Unicode range (U+0590–U+05FF) in text that should be English:
- Commands: "עןא צאשאוצ" (meant "git status")
- Questions: "יםו גם ן..." (meant "how do i...")

## Action

1. Detect Hebrew chars in unexpected context
2. Convert using CLI:
   ```bash
   echo "בםמאןמוק" | hebrew-to-english
   # → continue
   ```
3. Use converted text to understand intent
4. Respond as if user typed the English

## Example

User types: `עןא צאשאוצ`

Agent:
1. Detects Hebrew in command context
2. Runs: `echo "עןא צאשאוצ" | hebrew-to-english` → "git status"
3. Executes `git status` and shows result
