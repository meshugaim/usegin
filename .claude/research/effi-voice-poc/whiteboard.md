# Effi Voice Assistant — Lean POC

## Current State
Phase: 4 Implement | Status: done | Iteration: 1
Last checkpoint: All 5 slices built. 32 tests pass. Code review passed. Deepgram SDK v6 adaptations validated.
Next: Commit code, then brief user on how to run it locally with real hardware.

## Auto-Inject (survives compaction — read this every time you re-orient)
Process: Re-read skill (§Pre-Phase Hook) → read whiteboard → note-to-self (§Note-to-Self) → spawn agent → read summary only → update whiteboard
Role: I am the director. I NEVER do work myself — not checking, not reviewing, not fixing, not reading code. Every action = a subagent. If I'm about to do it myself, I stop and delegate. (§Hard Rules, §Role Collapse)
Output: Tell every agent "return ≤10 line summary; write details to phase file." I read summaries, never details. If unclear, spawn a follow-up agent to clarify — don't read the source. (§Agent Output Protocol)
Verification: Spawn sanity-check agents at phase boundaries AND between phases for continuous confidence. Not just in QA. (§Continuous Verification)

## Goal
Build a standalone Python voice assistant POC: wake word ("Hey Effi") → STT → LLM + Unified.to tools → TTS → audio out. Desktop/headless, runs in terminal.

## Scope & Constraints
- **Standalone** from main app — lives in `experiments/effi-voice-poc/`
- **Python 3.12** with uv
- **7 modules** built and tested
- **4-state machine** fully wired
- **Runs on user's local machine** (needs mic + speakers)

## Linear
- ENG-2206: Effi Voice Assistant — lean POC (In Progress)

## Phase Map
1. **Research** → [done, passed]
2. **Design** → [done, passed]
3. **Spec** → [done, passed]
4. **Implement** → [done, passed] — 32 tests pass, SDK v6 adaptations validated
5. **QA** → [pending — requires user's local machine with hardware]

## Design Decisions (final)
1. pvrecorder for capture (16-bit PCM 16kHz mono)
2. sounddevice for playback (24kHz TTS output)
3. Claude SDK beta `mcp_servers` for Unified.to
4. Single pvrecorder thread → asyncio.Queue → async orchestrator
5. REST TTS (not WebSocket) — simpler for POC
6. Sonnet for LLM (configurable)
7. Programmatic 880Hz chime (no external file)
8. Deepgram SDK v6 adaptations: context-manager STT, async iterator TTS

## Quality Log
1. Research (iteration 1): PASS
2. Design (iteration 1): PASS
3. Spec (iteration 1): PASS — 2 minor fixups noted and applied
4. Implementation (iteration 1): PASS — 32/32 tests, spec-faithful with justified SDK adaptations
