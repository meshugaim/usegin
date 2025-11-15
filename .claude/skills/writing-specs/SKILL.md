---
name: writing-specs
description: This skill should be used when the user wants to write a spec document. Triggered by phrases like "let's write a spec", "spec for XXX", "document this feature", or "create a spec". Helps interactively build specification documents in docs/ through structured dialogue.
---

# Writing Specs

## Overview

This skill facilitates an interactive, iterative process for writing technical specification documents. Instead of writing everything at once, we build specs collaboratively through understanding, questioning, and section-by-section refinement.

**Core principle:** Build understanding first, write second. Specs emerge from conversation, not dictation.

## When to Use

Use this skill when the user wants to create a specification document. Common trigger phrases include:

- "let's write a spec"
- "spec for XXX"
- "document this feature"
- "create a spec"
- "we need a spec for..."

## Workflow

### Step 1: Mind Dump & Understanding

User brain-dumps their ideas messily into the conversation. Your job: understand.

Gather context by exploring:
- Related code in the repo
- Relevant documentation (context7, web search)
- Open source repos for local reference if needed (add to `.gitignore`)

Don't write anything yet. Just understand.

### Step 2: Ask Questions

Use the `AskUserQuestion` tool to clarify until you reach baseline understanding.

Keep asking until both of you are aligned on what needs to be spec'd.

### Step 3: Propose Section Structure

Based on understanding, propose a list of sections for the spec.

Present the section outline to the user. Get approval or adjust.

### Step 4: Create Spec File and Build Section by Section

Create `docs/thing.spec.md` and write sections directly into it, one at a time.

For each section:
1. Write the section directly into the spec file
2. Commit the change with a clear message
3. User reviews and provides feedback
4. If changes needed, edit and commit again
5. Move to next section when approved

**Git commit after every change.** This creates:
- Easy rollback to better versions
- History of thought process
- Clear diff showing what changed between versions
- Checkpoint at each step

**Only proceed to next section after user approves current one.**

## Spec Style Guidelines

**Critical:** Specs should be short, informal, no bloat.

- ✅ **Concise** - get to the point
- ✅ **Informal** - conversational tone
- ✅ **Focused** - only what matters
- ❌ **No fluff** - cut the corporate speak
- ❌ **No bloat** - every sentence earns its place
- ❌ **No formality** - we're building, not presenting to a board
