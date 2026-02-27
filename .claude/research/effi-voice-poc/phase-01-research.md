# Phase 01 — Research Findings

Date: 2026-02-27

---

## 1. Python SDK Compatibility

### 1.1 pvporcupine (Picovoice Wake Word)

- **Latest version:** 4.0.2 (released 2026-02-13)
- **Python:** 3.9+
- **Linux x86_64:** Fully supported. The native shared library `libpv_porcupine.so` ships for `linux/x86_64` in the pip package.
- **Built-in keywords:** alexa, hey google, ok google, hey siri, jarvis, bumblebee, picovoice, etc.
- **Custom keywords:** Trained via Picovoice Console — produces a `.ppn` model file. "Hey Effi" will require a custom model.
- **Authentication:** Requires a free Picovoice AccessKey.
- **Audio requirements:** 16-bit linearly-encoded PCM, single-channel (mono), 16 kHz sample rate. Frame length is fixed at `porcupine.frame_length` samples (typically 512 samples = 32ms at 16kHz).
- **License:** Apache-2.0

### 1.2 deepgram-sdk (Deepgram STT + TTS)

- **Latest version:** 6.0.1 (released 2026-02-24)
- **Python:** 3.8–3.15
- **WebSocket Streaming STT:** Yes. Uses `client.listen.v2.connect()` with params `encoding="linear16"`, `sample_rate="16000"`. Accepts raw PCM 16-bit 16kHz mono audio — same format Porcupine requires.
- **WebSocket Streaming TTS:** Yes. Supports `linear16`, `mulaw`, and `alaw` encodings for WebSocket TTS. REST TTS defaults to linear16 WAV at 24kHz. Configurable output sample rates: 8000, 16000, 24000, 32000, 48000 Hz.
- **TTS models:** Aura-2 family (e.g., `aura-2-thalia-en`, `aura-asteria-en`).
- **Key TTS WebSocket operations:** `Flush` (force audio generation from text buffer), `Clear` (empty text buffer), `Close` (terminate connection).
- **License:** MIT

### 1.3 anthropic SDK (Claude + Tool Use / MCP)

- **Latest version:** ~0.84.0 (released 2026-02-25)
- **Python:** 3.9+
- **Tool use:** Fully supported via `messages.create()` with `tools` parameter.
- **Remote MCP support:** Beta feature via `client.beta.messages.create()` with `mcp_servers` parameter. Requires extra header `"anthropic-beta": "mcp-client-2025-04-04"`.
- **MCP connector limitations:** Currently only accesses **tools** from MCP servers (not resources or prompts). Queries `list_tools` endpoint and exposes functions to Claude.
- **License:** MIT

### 1.4 Audio Capture Libraries

| Library | Version | Format | Cross-platform | Install complexity | Notes |
|---|---|---|---|---|---|
| **pvrecorder** | 1.2.7 | 16-bit PCM, 16kHz, mono | Linux/macOS/Windows/RPi | `pip install pvrecorder` (no system deps) | Purpose-built for speech. Same format Porcupine needs. From Picovoice. |
| **sounddevice** | ~0.5.x | NumPy arrays (configurable) | Linux/macOS/Windows | Needs PortAudio (`apt install libportaudio2`) | More flexible but requires system dependency. |
| **pyaudio** | ~0.2.14 | Bytes (configurable) | Linux/macOS/Windows | Needs PortAudio + build tools | Most granular control, hardest to install. |

**Recommendation:** Use `pvrecorder` for the POC. Zero system dependencies, outputs exactly the format Porcupine and Deepgram expect (16-bit PCM, 16kHz), cross-platform, and from the same vendor as Porcupine so integration is battle-tested.

### 1.5 Audio Playback Libraries

| Library | Strengths | Weaknesses | Best for |
|---|---|---|---|
| **sounddevice** | Play NumPy arrays directly, record + playback in one lib | Needs PortAudio system dep | Prototyping, when already using sounddevice for capture |
| **simpleaudio** | Dead-simple WAV/PCM playback, low-latency | No streaming playback, no recording | Playing complete audio buffers |
| **pyaudio** | Stream-based playback, fine-grained control | Hard to install, verbose API | Real-time streaming playback |

**Recommendation:** Use `sounddevice` for playback. It can play raw PCM NumPy arrays directly (which Deepgram TTS returns as linear16), doesn't require a WAV wrapper, and supports streaming playback via callback or blocking modes. The PortAudio dependency is the only downside but is a one-line install (`apt install libportaudio2`).

**Alternative:** If we want zero system deps, we could use `simpleaudio` for playback of complete buffers, but it doesn't support streaming playback which hurts latency (must wait for full TTS response before playing).

---

## 2. Unified.to MCP Integration

### 2.1 Existing Experiment Pattern

The existing experiment at `experiments/unified-integration/` uses:
- **OpenAI SDK** with function calling (tool definitions as JSON schemas)
- **Unified Python SDK** (`unified-python-sdk`) for direct API calls
- **FastAPI** web server with SSE streaming chat
- **Connection model:** OAuth flow via `get_unified_integration_auth()`, stores connection IDs in memory
- **Tool execution:** Custom `_execute_tool()` function that dispatches to Unified SDK calls
- **Connection discovery:** `lib/connection.py` has `discover_connection_id()` which checks env var → cache file → API call

### 2.2 Two Approaches for Effi Voice POC

**Approach A: Anthropic `mcp_servers` parameter (recommended)**

The Anthropic SDK has beta support for remote MCP servers. Claude itself becomes the MCP client — we just pass the server URL:

```python
import anthropic

client = anthropic.Anthropic()
response = client.beta.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": user_query}],
    mcp_servers=[{
        "type": "url",
        "url": "https://mcp-api.unified.to/mcp?token={TOKEN}&connection={CONN_ID}",
        "name": "unified-tools",
        "authorization_token": UNIFIED_API_KEY,  # if needed
    }],
    extra_headers={"anthropic-beta": "mcp-client-2025-04-04"},
)
```

Pros:
- Zero tool-definition boilerplate — Claude discovers tools from the MCP server automatically
- Simplest code path for the POC
- No need for local MCP client library

Cons:
- Beta feature — API may change
- Only supports tools (not resources/prompts)
- Adds network hop: our code → Anthropic API → Unified.to MCP → Anthropic API → our code
- May add latency (extra round-trip through Anthropic's servers to Unified.to)
- Less control over tool execution

**Approach B: Local MCP client + Anthropic tool_use**

Use the `mcp` Python SDK to connect to the remote MCP server ourselves, discover tools, convert them to Anthropic tool schemas, and handle tool execution locally:

```python
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async with streamablehttp_client(
    "https://mcp-api.unified.to/mcp?token={TOKEN}&connection={CONN_ID}"
) as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tools = await session.list_tools()
        # Convert MCP tools to Anthropic tool schemas
        # Use anthropic client.messages.create(tools=converted_tools)
        # Execute tool calls via session.call_tool()
```

Pros:
- Full control over tool execution
- Can cache tool lists, add retry logic
- No beta dependency
- Lower latency for tool execution (direct to Unified.to, not via Anthropic)

Cons:
- More code to write (tool schema conversion, execution loop)
- Must manage MCP client session lifecycle

**Recommendation for POC:** Start with **Approach A** (`mcp_servers` parameter). It's dramatically less code and the POC doesn't need fine-grained control. If latency is unacceptable or the beta proves unreliable, fall back to Approach B.

### 2.3 Unified.to MCP URL Format

Based on the whiteboard, the MCP endpoint is:
```
https://mcp-api.unified.to/mcp?token={TOKEN}&connection={CONN_ID}
```

The token and connection ID come from the existing Unified.to setup (same credentials as the `experiments/unified-integration/` experiment).

---

## 3. Audio in Containerized Environments (Gitpod)

### 3.1 The Problem

Gitpod Flex workspaces run in containers. By default, containers are **isolated from host hardware** including audio devices. There is no `/dev/snd`, no PulseAudio socket, and no ALSA device available.

### 3.2 What Would Be Needed

To capture microphone audio in a container, you need one of:
1. **ALSA passthrough:** `--device /dev/snd` on the Docker container (requires host cooperation)
2. **PulseAudio socket forwarding:** Bind-mount the host's PulseAudio socket into the container
3. **Custom devcontainer config:** Gitpod supports `.devcontainer/devcontainer.json` — could potentially configure device access, but Gitpod's documentation does not mention audio device support.

### 3.3 Reality Check

- **Gitpod does not document audio device access.** No evidence of microphone passthrough support.
- **pvrecorder will fail** in Gitpod — it enumerates audio devices via ALSA/CoreAudio/WASAPI, and none will be present.
- **sounddevice/pyaudio** have the same problem — they rely on PortAudio which needs ALSA on Linux.

### 3.4 Verdict

**The voice POC must run on the user's local machine**, not in Gitpod. The code can be developed and tested (unit tests, mock audio) in Gitpod, but actual microphone capture and speaker playback require a local machine with audio hardware.

**Workaround for development in Gitpod:**
- Use pre-recorded WAV files as mock audio input for testing the STT → LLM → TTS pipeline
- Mock `pvrecorder` with a class that reads from WAV files
- Test audio playback by writing to WAV files instead of speakers
- The full end-to-end voice loop only works locally

---

## 4. Architecture Validation

### 4.1 Audio Format Compatibility Matrix

| Component | Expected Input | Output Format |
|---|---|---|
| **pvrecorder** | Microphone | 16-bit PCM, 16kHz, mono (frames of `frame_length` samples) |
| **Porcupine** | 16-bit PCM, 16kHz, mono | Boolean (wake word detected) |
| **Deepgram STT** (WebSocket) | `linear16`, 16kHz | JSON transcript events |
| **Claude API** | Text (transcript) | Text (response) + tool calls |
| **Deepgram TTS** (WebSocket) | Text | `linear16` PCM audio (configurable sample rate: 8k–48kHz) |
| **sounddevice** (playback) | NumPy array / raw PCM | Speaker output |

**Key finding: pvrecorder output matches both Porcupine and Deepgram STT input perfectly.** All three expect 16-bit PCM, 16kHz, mono. No format conversion needed anywhere in the capture→STT path.

For TTS→playback, Deepgram TTS can output `linear16` at any supported sample rate. If we request 24kHz (default), `sounddevice` can play it directly at that sample rate.

### 4.2 Audio Stream Sharing: Porcupine + Deepgram

**Can we share a single audio input stream?** Yes, with a state machine approach:

```
State: LISTENING_FOR_WAKE_WORD
  └─ pvrecorder reads frames → feed to porcupine.process()
  └─ Wake word detected → transition to LISTENING_FOR_SPEECH

State: LISTENING_FOR_SPEECH
  └─ pvrecorder reads frames → feed to Deepgram WebSocket
  └─ Deepgram returns final transcript → transition to PROCESSING
  └─ Silence timeout → transition to LISTENING_FOR_WAKE_WORD

State: PROCESSING
  └─ Send transcript to Claude → get response → TTS → play audio
  └─ Done → transition to LISTENING_FOR_WAKE_WORD
```

**pvrecorder provides a single continuous stream.** We don't need to "switch" — we just change where we route each frame. During wake word detection, frames go to `porcupine.process()`. After detection, frames go to the Deepgram WebSocket. The audio capture never stops.

**Gotcha:** Porcupine's `process()` expects exactly `porcupine.frame_length` samples per call (typically 512 = 32ms at 16kHz). pvrecorder's `frame_length` should be set to match `porcupine.frame_length`. When routing to Deepgram, we can send the same-sized frames — Deepgram accepts any chunk size.

### 4.3 Latency Budget

Target: <4 seconds from end-of-speech to start-of-audio-response.

| Stage | Expected Latency | Notes |
|---|---|---|
| Deepgram STT finalization | 200–500ms | `endpointing` param controls silence detection |
| Claude API (tool use) | 1–3s | Depends on model, tools invoked |
| Deepgram TTS first byte | 200–400ms | WebSocket streaming, first audio chunk |
| **Total** | **~1.5–4s** | Achievable if Claude responds quickly |

The bottleneck is Claude's response time, especially with MCP tool calls (Approach A adds an extra network hop). If latency exceeds 4s, we can:
- Use `claude-haiku` for faster responses
- Switch to Approach B (local MCP client) to reduce tool-call latency
- Use Deepgram's `endpointing` param to reduce STT finalization delay

### 4.4 Gotchas Identified

1. **Porcupine frame alignment:** pvrecorder's `frame_length` must equal `porcupine.frame_length`. Mismatch causes silent failures or exceptions.
2. **Deepgram WebSocket lifecycle:** The STT WebSocket connection should be opened when wake word is detected and closed after the transcript is received. Keeping it open permanently wastes API credits and may hit idle timeouts.
3. **TTS audio sample rate:** Deepgram TTS defaults to 24kHz. The playback device must be configured to match. If using `sounddevice`, set `samplerate=24000` in the play call.
4. **Endpointing sensitivity:** Deepgram's `endpointing` parameter (ms of silence before finalizing) needs tuning. Too short = cuts off mid-sentence. Too long = adds latency. Start with 300ms.
5. **Beta MCP header:** The `mcp_servers` feature requires `"anthropic-beta": "mcp-client-2025-04-04"` header. This may change or graduate out of beta.
6. **Thread safety:** pvrecorder capture runs in a loop. Audio playback runs in another thread. Deepgram WebSocket is async. Need careful state management — suggest `asyncio` with a synchronous pvrecorder read loop in a thread.

---

## 5. Existing Experiment Structure

### 5.1 Pattern from `experiments/unified-integration/`

```
experiments/unified-integration/
├── pyproject.toml          # uv project, hatchling build backend
├── main.py                 # FastAPI app (entry point)
├── lib/                    # Shared library code
│   ├── __init__.py
│   ├── connection.py       # Connection discovery
│   ├── linear.py           # Linear-specific logic
│   └── fathom.py           # Fathom-specific logic
├── linear_cli.py           # Click CLI for Linear
├── fathom_cli.py           # Click CLI for Fathom
├── templates/              # Jinja2 HTML templates
├── tests/                  # pytest tests
├── .gitignore
├── .env                    # Credentials (gitignored)
└── uv.lock                 # Lockfile
```

Key patterns:
- **Standalone `pyproject.toml`** with `uv` — experiment is fully isolated from main app
- **`hatchling` build backend** — standard Python packaging
- **`python-dotenv`** for credential loading from `.env`
- **CLI tools** via `click` with `[project.scripts]` entry points
- **Tests** in `tests/` directory using `pytest`

### 5.2 Proposed Structure for Effi Voice POC

```
experiments/effi-voice-poc/
├── pyproject.toml          # uv project
├── main.py                 # Entry point: voice loop orchestrator
├── lib/
│   ├── __init__.py
│   ├── wake_word.py        # Porcupine wake word detector
│   ├── stt.py              # Deepgram STT WebSocket client
│   ├── llm.py              # Claude API with MCP tools
│   ├── tts.py              # Deepgram TTS WebSocket client
│   └── audio.py            # Audio capture (pvrecorder) + playback (sounddevice)
├── tests/
│   ├── __init__.py
│   ├── test_stt.py
│   ├── test_llm.py
│   └── test_tts.py
├── .gitignore
├── .env                    # Credentials (gitignored)
└── uv.lock
```

### 5.3 Proposed Dependencies

```toml
[project]
name = "effi-voice-poc"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "pvporcupine>=4.0",
    "pvrecorder>=1.2",
    "deepgram-sdk>=6.0",
    "anthropic>=0.80",
    "sounddevice>=0.5",
    "python-dotenv",
]

[dependency-groups]
dev = [
    "pytest>=9.0",
    "pytest-asyncio>=0.24",
]
```

Note: `sounddevice` requires system-level PortAudio (`apt install libportaudio2` on Ubuntu/Debian). This is needed for audio playback only — capture uses `pvrecorder` which has no system deps.

---

## Summary of Key Decisions

| Question | Answer |
|---|---|
| Wake word SDK | pvporcupine 4.0.2 — fully supports Linux x86_64 |
| STT + TTS SDK | deepgram-sdk 6.0.1 — WebSocket streaming for both STT and TTS |
| LLM SDK | anthropic ~0.84 — beta `mcp_servers` for Unified.to MCP |
| Audio capture | pvrecorder 1.2.7 — zero deps, outputs 16kHz PCM (matches Porcupine + Deepgram) |
| Audio playback | sounddevice — plays PCM arrays, needs PortAudio system dep |
| MCP approach | Approach A (mcp_servers param) for simplicity; Approach B as fallback |
| Gitpod audio | Not possible — POC must run on local machine for real audio |
| Audio stream sharing | State machine routing frames to Porcupine or Deepgram — works fine |
| Format conversion needed? | No — all components align on 16-bit PCM 16kHz mono |
| Latency target achievable? | Yes, ~1.5–4s is realistic with streaming STT/TTS |
