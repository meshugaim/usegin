# Phase 04 — Implementation Log

Date: 2026-02-27

---

## Summary

Built the complete Effi Voice Assistant POC in `experiments/effi-voice-poc/`. All 5 slices implemented, 32 unit tests passing.

---

## Slice 1: Scaffold + Audio Capture + Wake Word

**Files created:**
- `pyproject.toml` — uv project definition with all dependencies
- `.env.example` — template for API credentials
- `.gitignore` — excludes .env, .ppn, __pycache__, .venv, uv.lock, fixtures
- `main.py` — Config dataclass with `from_env()`, entry point with component initialization
- `audio.py` — `AudioCapture` (pvrecorder in background thread, asyncio.Queue bridge), `AudioPlayer` (sounddevice wrapper), `frames_to_bytes()`, `generate_chime()`
- `wake_word.py` — `WakeWordDetector` wrapping Porcupine, fallback to built-in "jarvis"
- `orchestrator.py` — Full state machine with all 4 states
- `tests/__init__.py`, `tests/conftest.py` — test infrastructure

**Decisions:**
- Wrote all modules with full implementations (not stubs) since the interfaces were well-defined by the spec. This allowed building all slices in a single pass.
- Installed `libportaudio2` system dependency required by sounddevice.

---

## Slice 2: STT Integration

**File:** `stt.py`

**Major adaptation:** The spec was written against Deepgram SDK v3/v4, but `deepgram-sdk>=6.0,<7.0` (v6.0.1 installed) has a completely rewritten API:
- `DeepgramClient(api_key)` -> `AsyncDeepgramClient(api_key='...')` (keyword-only)
- `client.listen.asyncwebsocket.v("1")` -> `client.listen.v1.connect(model=..., ...)` (async context manager)
- `LiveOptions(...)` -> keyword args (all strings) directly on `connect()`
- `LiveTranscriptionEvents.Transcript` callback -> `recv()` loop returning `ListenV1Results`
- `connection.send(bytes)` -> `ws.send_media(bytes)`
- `connection.finish()` -> `ws.send_close_stream()` or context manager exit
- `DeepgramClientOptions` -> removed (no equivalent needed)

**Implementation approach:**
- Manually manage the async context manager via `__aenter__`/`__aexit__` to preserve the spec's ephemeral session pattern (`start_session()` / `send_audio()` / `close_session()`)
- Added a `_recv_loop()` background task to poll `ws.recv()` and set the transcript future when a final result arrives
- All params passed as strings per v6 API requirement

---

## Slice 3: LLM + MCP Integration

**File:** `llm.py`

Implemented exactly per spec:
- `Assistant` class with `respond()`, `_build_mcp_servers()`, `_extract_text()`
- Uses `client.beta.messages.create()` with `mcp_servers` and `betas=["mcp-client-2025-04-04"]` when Unified.to is configured
- Falls back to stable `client.messages.create()` without tools
- System prompt directs Effi to be concise and conversational

**Tests:** `tests/test_llm.py` — 8 tests covering MCP server building, text extraction (single block, multiple blocks, empty, no text blocks), and mocked respond calls with/without MCP.

---

## Slice 4: TTS + Playback

**File:** `tts.py`

**Deepgram SDK v6 adaptation:**
- `client.speak.asyncrest.v("1").stream_raw(...)` -> `client.speak.v1.audio.generate(text=..., model=..., encoding=..., sample_rate=...)` (async iterator of bytes)
- Collects all chunks, strips WAV header if present, converts to numpy int16

**Tests:** `tests/test_tts.py` — 4 tests covering WAV header stripping and PCM-to-numpy conversion.

---

## Slice 5: Full Pipeline + Tests

**File:** `orchestrator.py` (completed), `tests/test_orchestrator.py`

**Orchestrator details:**
- State machine: LISTENING -> RECORDING -> PROCESSING -> SPEAKING -> LISTENING
- Queue draining on entering LISTENING (discards stale frames from PROCESSING/SPEAKING)
- Confirmation chime pre-generated at init, played via executor (awaited to prevent STT pickup)
- `_stream_frames_to_stt()` as a cancellable background task during RECORDING
- Silence timeout uses `self._silence_timeout_s` from Config (spec fixup applied)
- QueueFull comment added in capture thread's exception handler (spec fixup applied)
- Error recovery: all handlers wrap in try/except, always return to LISTENING on failure

**Tests:** `tests/test_orchestrator.py` — 12 tests covering:
- Initial state
- LISTENING -> RECORDING transition (wake word detection)
- Queue draining behavior
- RECORDING -> PROCESSING transition (transcript received)
- RECORDING timeout -> LISTENING (silence)
- PROCESSING -> SPEAKING transition (LLM response)
- PROCESSING error -> LISTENING
- SPEAKING -> LISTENING transition (TTS + playback)
- SPEAKING TTS error -> LISTENING (graceful degradation)
- Queue drain utility
- Chime generation at init
- Full state cycle (all 4 transitions)

**Test fix:** The listening tests initially hung because `_handle_listening()` drains the queue before reading — pre-filled frames were discarded. Fixed by feeding frames from a concurrent `asyncio.create_task()` after a short delay to let the drain complete.

---

## Spec Fixups Applied

1. **`self._silence_timeout_s`** — Used `self._silence_timeout_s` in `asyncio.wait_for()` instead of hardcoded `15.0`. The Config field `silence_timeout_s` defaults to `5` (not `15`).
2. **QueueFull comment** — Added comment in `_capture_loop()` noting that `QueueFull` is caught by the generic `Exception` handler.

---

## Test Results

```
32 passed in 2.63s
```

- `tests/test_audio.py` — 8 tests (frames_to_bytes, generate_chime)
- `tests/test_llm.py` — 8 tests (MCP config, text extraction, respond)
- `tests/test_orchestrator.py` — 12 tests (state machine transitions)
- `tests/test_tts.py` — 4 tests (WAV header, PCM conversion)

---

## File Inventory

```
experiments/effi-voice-poc/
├── pyproject.toml
├── .env.example
├── .gitignore
├── main.py              # Config + entry point
├── orchestrator.py      # State machine (LISTENING/RECORDING/PROCESSING/SPEAKING)
├── audio.py             # AudioCapture + AudioPlayer + frames_to_bytes + generate_chime
├── wake_word.py         # WakeWordDetector (Porcupine wrapper)
├── stt.py               # SpeechToText (Deepgram v6 WebSocket)
├── llm.py               # Assistant (Claude + beta MCP)
├── tts.py               # TextToSpeech (Deepgram v6 REST TTS)
├── fixtures/            # (empty, for test WAV files)
└── tests/
    ├── __init__.py
    ├── conftest.py      # Shared fixtures
    ├── test_audio.py
    ├── test_llm.py
    ├── test_orchestrator.py
    └── test_tts.py
```

---

## Known Issues / Unresolved

1. **Deepgram SDK v6 breaking changes** — The spec was written for Deepgram SDK v3/v4. The v6 SDK has a completely rewritten API. The implementation adapts to v6 but the patterns are different from what the spec describes. If the team downgrades to v3, the stt.py and tts.py modules would need to be reverted to match the spec's original patterns.

2. **No hardware testing** — All tests are unit tests with mocks. The POC requires actual audio hardware (microphone + speakers) and API keys to run end-to-end. The Gitpod environment lacks audio devices.

3. **`send_media()` is synchronous** — The Deepgram v6 `ws.send_media()` method is synchronous (not async). The `send_audio()` method in stt.py is still declared async for API compatibility with the orchestrator, but internally calls `send_media()` synchronously.

4. **System dependency** — `libportaudio2` must be installed on the host (Ubuntu/Debian). Documented in main.py header comment.
