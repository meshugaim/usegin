# Handoff Config Skill

Configure automatic session handoff behavior. This toggles whether Claude should be forced to hand off to a fresh agent when context gets high, instead of using auto-compact.

## Commands

### Enable auto-handoff
```bash
# Read current config
CONFIG_FILE="$HOME/.claude.json"
CURRENT=$(cat "$CONFIG_FILE")

# Update settings using jq
echo "$CURRENT" | jq '.autoHandoffEnabled = true | .autoCompactEnabled = false' > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

echo "Auto-handoff ENABLED"
echo "  - autoHandoffEnabled: true"
echo "  - autoCompactEnabled: false"
echo ""
echo "When context reaches 75%, you'll get a warning."
echo "When context reaches 85%, handoff becomes MANDATORY."
```

### Disable auto-handoff
```bash
# Read current config
CONFIG_FILE="$HOME/.claude.json"
CURRENT=$(cat "$CONFIG_FILE")

# Update settings using jq
echo "$CURRENT" | jq '.autoHandoffEnabled = false | .autoCompactEnabled = true' > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

echo "Auto-handoff DISABLED"
echo "  - autoHandoffEnabled: false"
echo "  - autoCompactEnabled: true"
echo ""
echo "Sessions will use auto-compact instead of handoff."
```

### Show current status
```bash
CONFIG_FILE="$HOME/.claude.json"

HANDOFF=$(cat "$CONFIG_FILE" | jq -r '.autoHandoffEnabled // false')
COMPACT=$(cat "$CONFIG_FILE" | jq -r '.autoCompactEnabled // true')

echo "Current handoff configuration:"
echo "  - autoHandoffEnabled: $HANDOFF"
echo "  - autoCompactEnabled: $COMPACT"
echo ""

if [ "$HANDOFF" = "true" ]; then
  echo "Mode: AUTO-HANDOFF"
  echo "  Sessions will hand off to fresh agents at high context."
  echo "  - 75%: Warning to consider handoff"
  echo "  - 85%: MANDATORY handoff (no discretion)"
else
  echo "Mode: AUTO-COMPACT"
  echo "  Sessions will automatically compact context when full."
fi
```

## How It Works

When **auto-handoff is enabled**:
1. The Stop hook checks context utilization after each turn
2. At 75%+: Warning message suggesting `/auto-handoff`
3. At 85%+: Mandatory handoff - agent MUST run `/auto-handoff` immediately
4. Auto-compact is disabled so sessions don't get compacted instead

When **auto-handoff is disabled** (default):
1. Sessions use Claude's built-in auto-compact behavior
2. Context is automatically summarized when full
3. Sessions can continue indefinitely

## Usage

Ask Claude to:
- "Enable auto-handoff" or "Turn on auto-handoff"
- "Disable auto-handoff" or "Turn off auto-handoff"
- "Show handoff status" or "What's my handoff config?"
