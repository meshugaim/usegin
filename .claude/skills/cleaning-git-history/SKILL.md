---
name: cleaning-git-history
description: This skill should be used when the user needs to remove sensitive data (API keys, secrets, credentials) from git history. Triggered by phrases like "remove from git history", "clean git history", "secret in git", or "API key was committed".
---

# Cleaning Git History

Remove sensitive data that was accidentally committed to git history.

## When to Use

Triggered by: "remove [secret] from git history", "API key was committed", "clean git history"

## Workflow

### 1. Assess & Ask
- Check when the secret was committed (recent = safer)
- Ask: rewrite history or rotate secret instead?
- For old commits or shared repos, recommend rotation over rewriting

### 2. Fix Current File
Replace hardcoded secret with placeholder (e.g., `${API_KEY}`), commit the fix

### 3. Clean History
```bash
# Install git-filter-repo
curl -o git-filter-repo https://raw.githubusercontent.com/newren/git-filter-repo/main/git-filter-repo
chmod +x git-filter-repo

# Create replacement file
echo "actual-secret==>REDACTED" > expressions.txt

# Rewrite history
python3 ./git-filter-repo --replace-text expressions.txt --force
```

### 4. Verify & Push
```bash
# Verify secret is gone
git log --all -p -- path/to/file | grep "secret" || echo "Clean!"

# Re-add remote and force push
git remote add origin <repo-url>
git push --force origin main

# Cleanup
rm -f expressions.txt git-filter-repo
```

## Important

- ⚠️ Requires force push - warn user if commits aren't from today
- ⚠️ Secret is still compromised - must rotate it anyway
- ✅ Prefer secret rotation over history rewriting when possible
