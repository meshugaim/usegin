# Source

Upstream: https://github.com/Ashutos1997/claude-design-auditor-skill
Pinned commit: dce1b2d43b5e5acc9d5ede31dc6713af8d61d1dd
Imported: 2026-05-15
Imported by: lihu (session 8b83a644)

Manifest: this folder is a vendored copy of the upstream repo's `SKILL.md` + `references/` + `README.md` (renamed `UPSTREAM_README.md`). No upstream code beyond those files was imported.

To refresh:
```bash
git clone --depth=1 https://github.com/Ashutos1997/claude-design-auditor-skill /tmp/ds
NEW_SHA=$(cd /tmp/ds && git rev-parse HEAD)
cp /tmp/ds/SKILL.md .claude/skills/design-auditor/
cp -r /tmp/ds/references .claude/skills/design-auditor/
cp /tmp/ds/README.md .claude/skills/design-auditor/UPSTREAM_README.md
# Update "Pinned commit" line above to $NEW_SHA
```
