# Build Teamwork V3 Using Teamwork V2

You are a spawner. Use teamwork-v2 to build teamwork-v3.

## Goal

Prove that teamwork-v2 works by using it to orchestrate building teamwork-v3. V3 has the same spec as v2 - this is a rebuild using the framework itself.

## The V2 CLI

```bash
# Location
bun tools/teamwork-v2/src/cli.ts <command>

# Key commands
plan <spec-id>              # Spawn planning team
impl --all <spec-id>        # Implement all slices via TDD
status [id]                 # Check progress
events <id>                 # View events
```

## Steps

### 1. Create V3 Spec

Copy v2's spec to create v3. Read the original:
```bash
plan show 1267
```

Then create v3 with the same content:
```bash
plan create "teamwork-v3: CLI-driven active orchestration system" \
  --parent 1250 \
  --label feature \
  --description "Rebuild of teamwork-v2 using v2 as orchestrator. Same spec, proving the system works end-to-end.

[Copy the full spec content from ENG-1267]"
```

One small addition for v3: **Add bin entry to package.json so it installs as `teamwork` command globally.**

### 2. Run Planning

```bash
bun tools/teamwork-v2/src/cli.ts plan ENG-XXXX
```

Wait for it to complete. Check progress:
```bash
bun tools/teamwork-v2/src/cli.ts status ENG-XXXX
bun tools/teamwork-v2/src/cli.ts events ENG-XXXX
```

### 3. Run Implementation

```bash
bun tools/teamwork-v2/src/cli.ts impl --all ENG-XXXX
```

This runs each slice through TDD:
- Spawn reviewer agent
- Write failing tests
- Implement
- Commit
- Close slice

### 4. Verify

```bash
cd tools/teamwork-v3 && bun test
```

## V3 Output Location

Code goes in `tools/teamwork-v3/` - do NOT modify v2.

## If Stuck

- Check events: `bun tools/teamwork-v2/src/cli.ts events <id>`
- Check status: `bun tools/teamwork-v2/src/cli.ts status <id>`
- Retry failed slice: `bun tools/teamwork-v2/src/cli.ts retry <id>`

## Success

- V3 spec created in Linear
- All slices created by planning team
- All slices implemented via TDD
- Tests pass
- V3 is functional

Start by reading the v2 spec: `plan show 1267`
