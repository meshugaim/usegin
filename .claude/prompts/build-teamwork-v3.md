# Build Teamwork V3 Using Teamwork V2

You are a spawner agent. Your task is to use teamwork-v2 to build teamwork-v3.

## Context

Teamwork-v2 was just built and is operational. It lives at `tools/teamwork-v2/`. Your job is to use v2's CLI to orchestrate the creation of v3 - proving that v2 works by using it to build its successor.

## What Teamwork V2 Provides

```bash
# CLI location
bun tools/teamwork-v2/src/cli.ts <command>

# Commands
plan <spec-id>              # Spawn planning team to create slices
impl <slice-id>             # Spawn impl team for single slice
impl --all <spec-id>        # Implement all slices sequentially
impl --parallel <spec-id>   # Implement slices concurrently
status [id]                 # Show workspace status
list                        # List all teams
watch [id]                  # Monitor progress
events <id>                 # Query events
validate <spec-id>          # Check slice coverage
```

## Your Mission

### Step 1: Create the V3 Spec

Create a Linear issue for teamwork-v3. The spec should include improvements over v2:

**Proposed V3 Improvements:**

1. **Self-hosting** - V3 should be able to build itself (we're testing this with v2→v3)

2. **Better agent prompts** - V2 uses v1's skill files. V3 should have its own optimized prompts based on learnings.

3. **Real-time progress streaming** - V2's watch command polls. V3 should stream events in real-time.

4. **Workspace persistence** - V2 stores state in `.claude/teamwork-v2/`. V3 should integrate with Linear for state (comments, attachments).

5. **Automatic retry with learning** - V2 retries blindly. V3 should analyze failures and adjust approach.

6. **Multi-repo support** - V2 assumes single repo. V3 should coordinate across repos.

7. **Cost tracking** - V3 should track token usage per slice/team.

8. **Human-in-the-loop checkpoints** - V3 should pause at configurable points for human review.

Use `plan create` to create the spec:
```bash
plan create "teamwork-v3: self-improving orchestration system" \
  --description "..." \
  --label feature
```

### Step 2: Run Planning with V2

Once you have a spec ID (e.g., ENG-XXXX), use v2 to create slices:

```bash
bun tools/teamwork-v2/src/cli.ts plan ENG-XXXX
```

This spawns a planning reviewer agent that will:
1. Read the spec from Linear
2. Spawn workers to analyze and propose slices
3. Review and iterate on slice proposals
4. Create Linear sub-issues for each slice

Monitor progress:
```bash
bun tools/teamwork-v2/src/cli.ts status ENG-XXXX
bun tools/teamwork-v2/src/cli.ts events ENG-XXXX
```

### Step 3: Run Implementation with V2

Once slices are created, implement them:

```bash
# Sequential (safer, easier to debug)
bun tools/teamwork-v2/src/cli.ts impl --all ENG-XXXX

# Or parallel (faster)
bun tools/teamwork-v2/src/cli.ts impl --parallel ENG-XXXX --max-concurrent 2
```

Each slice will:
1. Spawn an impl reviewer agent
2. Write failing tests (TDD)
3. Implement to make tests pass
4. Commit and close the slice issue

### Step 4: Validate and Report

After implementation:
1. Run full test suite: `cd tools/teamwork-v3 && bun test`
2. Verify all slices closed in Linear
3. Document what worked and what didn't
4. If v3 is operational, you've proven v2 works!

## Success Criteria

1. V3 spec created in Linear with clear requirements
2. Planning team successfully creates slices (visible in Linear)
3. Implementation teams complete at least 50% of slices via TDD
4. V3 has working tests and basic functionality
5. Retro documented with learnings

## If Things Go Wrong

**Planning fails:**
- Check `bun tools/teamwork-v2/src/cli.ts events <spec-id>` for errors
- Try `--model opus` for more capable planning
- Manually review and adjust slices if needed

**Implementation fails:**
- Use `bun tools/teamwork-v2/src/cli.ts status <slice-id>` to see where it got stuck
- Try `bun tools/teamwork-v2/src/cli.ts retry <slice-id>`
- If repeatedly failing, implement that slice manually and continue

**Agent gets stuck:**
- Check context utilization: `cctx`
- Use `bun tools/teamwork-v2/src/cli.ts health` to see agent health
- Force handoff if needed: `bun tools/teamwork-v2/src/cli.ts handoff <id>`

## Important Notes

- V2 agents read skill files from `.claude/skills/teamwork/` (v1's skills)
- V3 code should go in `tools/teamwork-v3/` (don't modify v2)
- Commit frequently - each slice should result in commits
- If you need to debug, check `.claude/teamwork-v2/<id>/events.jsonl`

## Start

Begin by:
1. Reading v2's structure: `ls tools/teamwork-v2/src/`
2. Understanding what exists: `bun tools/teamwork-v2/src/cli.ts --help`
3. Creating the v3 spec in Linear
4. Running the planning workflow

Good luck! You're about to prove that teamwork-v2 can orchestrate complex multi-agent work.
