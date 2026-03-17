# Auto-Inject Hook Build

## What was built

Replaced the experiment hook (`.claude/hooks/auto-inject-experiment.ts`) with a production-ready auto-inject system for the build-orchestrate skill.

## Changes

1. **New hook**: `.claude/hooks/build-orchestrate-auto-inject.ts` -- reads `AUTO-INJECT-START/END` markers from SKILL.md + `## Auto-Inject` section from whiteboard, outputs combined `additionalContext` JSON.
2. **SKILL.md markers**: Added `<!-- AUTO-INJECT-START/END -->` around 5 compressed hard rules in the Hard Rules section.
3. **Skill-scoped hook**: Added `PostToolUse` matcher for `Agent|TeamCreate` in SKILL.md YAML frontmatter (skill-scoped, not global).
4. **Registration instruction**: Added `.claude/active-build.json` registration step to whiteboard creation docs.
5. **Reframed Auto-Inject**: "survives compaction" replaced with "re-orientation between phases" throughout.
6. **Pre-Phase Hook**: Removed "Re-read this skill" as step 1 (auto-inject handles this). Now starts with "Read the whiteboard."
7. **Cleanup**: Removed experiment file + global PostToolUse hook from settings.json.

## Testing

- `echo '{"tool_name":"Agent",...}' | bun .claude/hooks/build-orchestrate-auto-inject.ts` with no active-build.json: silent exit (correct)
- Same with active-build.json pointing to existing whiteboard: outputs both `[Build Director Re-orientation]` and `[Session Notes]` sections (correct)
- Non-matching tool_name (Bash): silent exit (correct)
- settings.json validates as JSON
