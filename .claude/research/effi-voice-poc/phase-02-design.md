# Phase 02 — Architecture Design

Date: 2026-02-27

---

## 1. Module Structure

7 files total. Each module has a single responsibility. No abstractions for hypothetical futures.

```
experiments/effi-voice-poc/
├── pyproject.toml          # uv project definition
├── main.py                 # Entry point — CLI, config loading, starts orchestrator
├── orchestrator.py         # State machine + main async loop
├── audio.py                # Audio capture (pvrecorder) + playback (sounddevice)
├── wake_word.py            # Porcupine wake word detection
├── stt.py                  # Deepgram STT WebSocket streaming client
├── llm.py                  # Claude API with MCP tools (Unified.to)
├── tts.py                  # Deepgram TTS — REST-based, returns audio buffer
├── tests/
│   ├── __init__.py
│   ├── conftest.py         # Shared fixtures (mock audio, fake config)
│   ├── test_orchestrator.py
│   ├── test_stt.py
│   ├── test_llm.py
│   └── test_tts.py
├── fixtures/               # Test WAV files (16kHz mono PCM)
│   └── hello.wav           # Short spoken phrase for testing
├── .env.example            # Template for credentials
├── .gitignore
└── uv.lock
```

### Module Responsibilities

| Module | Responsibility | Dependencies |
|---|---|---|
| `main.py` | Load `.env`, parse CLI args, instantiate components, call `orchestrator.run()` | All modules |
| `orchestrator.py` | State machine, routes audio frames, coordinates pipeline stages | audio, wake_word, stt, llm, tts |
| `audio.py` | `AudioCapture` (pvrecorder wrapper) + `AudioPlayer` (sounddevice wrapper) | pvrecorder, sounddevice, numpy |
| `wake_word.py` | `WakeWordDetector` — thin wrapper around Porcupine | pvporcupine |
| `stt.py` | `SpeechToText` — Deepgram WebSocket STT session management | deepgram-sdk |
| `llm.py` | `Assistant` — Claude messages API with `mcp_servers` param | anthropic |
| `tts.py` | `TextToSpeech` — Deepgram REST TTS, returns PCM audio bytes | deepgram-sdk, numpy |

---

## 2. State Machine

The orchestrator implements a 4-state machine. States are an `enum.Enum`. Transitions are explicit — each state handler returns the next state.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  ┌───────────┐    wake word     ┌───────────┐   │
│  │ LISTENING │ ──────────────► │ RECORDING │   │
│  │           │                  │           │   │
│  │ (Porcupine│                  │ (Deepgram │   │
│  │  process) │                  │  STT WS)  │   │
│  └───────────┘                  └─────┬─────┘   │
│       ▲                               │         │
│       │                          transcript      │
│       │                               │         │
│       │                        ┌──────▼──────┐  │
│       │                        │ PROCESSING  │  │
│       │                        │             │  │
│       │                        │ (Claude API │  │
│       │                        │  + MCP)     │  │
│       │                        └──────┬──────┘  │
│       │                               │         │
│       │                          response text   │
│       │                               │         │
│       │                        ┌──────▼──────┐  │
│       │                        │  SPEAKING   │  │
│       │           done         │             │  │
│       └────────────────────────│ (Deepgram   │  │
│                                │  TTS + play)│  │
│                                └─────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

### State Definitions

```python
class State(enum.Enum):
    LISTENING = "listening"      # Feeding audio frames to Porcupine
    RECORDING = "recording"      # Feeding audio frames to Deepgram STT WebSocket
    PROCESSING = "processing"    # Waiting for Claude response (no audio routing)
    SPEAKING = "speaking"        # Playing TTS audio (no audio routing)
```

### Transitions

| From | Event | To | Action |
|---|---|---|---|
| LISTENING | Porcupine returns keyword index >= 0 | RECORDING | Play chime, open Deepgram STT WebSocket |
| RECORDING | Deepgram `is_final` transcript received | PROCESSING | Close STT WebSocket, send transcript to Claude |
| RECORDING | Silence timeout (no speech for 5s) | LISTENING | Close STT WebSocket, log "no speech detected" |
| PROCESSING | Claude returns text response | SPEAKING | Send response text to TTS, begin playback |
| PROCESSING | Claude API error | LISTENING | Log error, play error chime |
| SPEAKING | Audio playback completes | LISTENING | Resume wake word detection |
| SPEAKING | Playback error | LISTENING | Log error |

### State Handler Signatures

```python
async def _handle_listening(self) -> State:
    """Read frames from audio queue, feed to Porcupine. Returns RECORDING on wake word."""

async def _handle_recording(self) -> State:
    """Read frames from audio queue, stream to Deepgram STT. Returns PROCESSING on final transcript."""

async def _handle_processing(self, transcript: str) -> tuple[State, str]:
    """Send transcript to Claude, await response. Returns SPEAKING + response text."""

async def _handle_speaking(self, response_text: str) -> State:
    """Convert text to speech, play audio. Returns LISTENING."""
```

---

## 3. Async Architecture

### The Core Problem

We have a mix of blocking I/O (pvrecorder), async I/O (Deepgram WebSocket, Claude API), and CPU-bound work (Porcupine). The architecture uses **asyncio as the backbone** with a **dedicated thread for audio capture**.

### Thread Model

```
Thread 1: Audio Capture (blocking)
├── pvrecorder.read() in a loop (blocks until frame is ready)
├── Puts frames into asyncio.Queue via loop.call_soon_threadsafe()
└── Runs until shutdown event is set

Thread 2 (Main): asyncio event loop
├── Orchestrator state machine (consumes frames from Queue)
├── Deepgram STT WebSocket (async send/recv)
├── Claude API calls (async via anthropic SDK)
├── Deepgram TTS REST call (async HTTP)
└── Audio playback (sounddevice — non-blocking, callback-based)
```

### Audio Capture Thread

```python
# audio.py

class AudioCapture:
    def __init__(self, frame_length: int):
        self._recorder = PvRecorder(frame_length=frame_length)
        self._queue: asyncio.Queue[list[int]] = None  # Set by start()
        self._shutdown = threading.Event()

    def start(self, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue):
        """Start capture in a background thread. Frames go into the async queue."""
        self._queue = queue
        self._loop = loop
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._recorder.start()
        self._thread.start()

    def _capture_loop(self):
        """Blocking loop — runs in its own thread."""
        while not self._shutdown.is_set():
            frame = self._recorder.read()  # blocks ~32ms
            self._loop.call_soon_threadsafe(self._queue.put_nowait, frame)

    def stop(self):
        self._shutdown.set()
        self._thread.join(timeout=2)
        self._recorder.stop()
        self._recorder.delete()
```

### Orchestrator Main Loop

```python
# orchestrator.py

class Orchestrator:
    def __init__(self, audio: AudioCapture, wake_word: WakeWordDetector,
                 stt: SpeechToText, llm: Assistant, tts: TextToSpeech,
                 player: AudioPlayer):
        self._state = State.LISTENING
        self._frame_queue: asyncio.Queue[list[int]] = asyncio.Queue(maxsize=100)
        # ... store components

    async def run(self):
        """Main loop — dispatch to current state handler."""
        loop = asyncio.get_running_loop()
        self._audio.start(loop, self._frame_queue)

        try:
            while True:
                match self._state:
                    case State.LISTENING:
                        self._state = await self._handle_listening()
                    case State.RECORDING:
                        result = await self._handle_recording()
                        if isinstance(result, tuple):
                            self._state, self._transcript = result
                        else:
                            self._state = result
                    case State.PROCESSING:
                        self._state, self._response = await self._handle_processing(self._transcript)
                    case State.SPEAKING:
                        self._state = await self._handle_speaking(self._response)
        except KeyboardInterrupt:
            pass
        finally:
            self._audio.stop()
            self._wake_word.cleanup()
```

### Why This Architecture

1. **pvrecorder must block** — it uses ALSA/CoreAudio internally and provides no async API. Thread is the only option.
2. **asyncio for everything else** — Deepgram SDK, anthropic SDK both have async clients. Keeps coordination simple.
3. **Queue bridges the gap** — `asyncio.Queue` with `call_soon_threadsafe` is the standard pattern for thread-to-async communication.
4. **No executor needed** — We don't use `run_in_executor` because pvrecorder's capture loop is continuous, not request-response. A persistent thread is cleaner.
5. **`maxsize=100` on the queue** — Back-pressure. If the consumer falls behind (e.g., during PROCESSING), we don't accumulate unbounded memory. Old frames are irrelevant during PROCESSING anyway.

### Deepgram STT Session Lifecycle

The STT WebSocket connection is **ephemeral** — opened when entering RECORDING state, closed when leaving.

```python
# stt.py

class SpeechToText:
    def __init__(self, api_key: str):
        self._client = DeepgramClient(api_key)
        self._connection = None
        self._transcript_future: asyncio.Future | None = None

    async def start_session(self) -> asyncio.Future[str]:
        """Open WebSocket, return a Future that resolves with the final transcript."""
        loop = asyncio.get_running_loop()
        self._transcript_future = loop.create_future()

        self._connection = self._client.listen.asyncwebsocket.v("1")

        # Register event handlers
        async def on_transcript(self_dg, result, **kwargs):
            alt = result.channel.alternatives[0]
            if result.is_final and alt.transcript.strip():
                if not self._transcript_future.done():
                    self._transcript_future.set_result(alt.transcript.strip())

        self._connection.on(LiveTranscriptionEvents.Transcript, on_transcript)

        await self._connection.start(LiveOptions(
            encoding="linear16",
            sample_rate=16000,
            channels=1,
            model="nova-3",
            language="en",
            endpointing=300,           # ms of silence before finalizing
            interim_results=False,      # Only final transcripts (simpler for POC)
            utterance_end_ms=1500,      # Max silence gap within an utterance
        ))

        return self._transcript_future

    async def send_audio(self, frame: bytes):
        """Send a single audio frame to the WebSocket."""
        if self._connection:
            await self._connection.send(frame)

    async def close_session(self):
        """Close the WebSocket connection."""
        if self._connection:
            await self._connection.finish()
            self._connection = None
```

### Audio Playback

```python
# audio.py

class AudioPlayer:
    def __init__(self, sample_rate: int = 24000):
        self._sample_rate = sample_rate

    async def play(self, pcm_data: np.ndarray):
        """Play PCM audio. Runs sounddevice in executor to avoid blocking the event loop."""
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._play_sync, pcm_data)

    def _play_sync(self, pcm_data: np.ndarray):
        sd.play(pcm_data, samplerate=self._sample_rate)
        sd.wait()  # Block until playback finishes
```

---

## 4. Data Flow

Trace of a complete request: wake word detection through spoken response.

### Step-by-Step

```
1. LISTENING — Wake Word Detection
   ┌──────────────┐     list[int]      ┌─────────────┐
   │ pvrecorder   │ ──── (512 ints) ──►│ Porcupine   │
   │ (thread)     │     per frame      │ .process()  │
   └──────────────┘                    └──────┬──────┘
                                              │
                                    keyword_index >= 0
                                              │
                                              ▼
                                    Transition to RECORDING

2. RECORDING — Speech Capture
   ┌──────────────┐     list[int]      ┌─────────────────┐
   │ pvrecorder   │ ──── (512 ints) ──►│ Convert to bytes│
   │ (thread)     │     per frame      │ (struct.pack)   │
   └──────────────┘                    └────────┬────────┘
                                                │
                                          bytes (1024B)
                                                │
                                                ▼
                                    ┌─────────────────────┐
                                    │ Deepgram STT        │
                                    │ WebSocket           │
                                    │ (async send)        │
                                    └────────┬────────────┘
                                             │
                                    LiveTranscriptionEvents
                                    .Transcript (is_final)
                                             │
                                             ▼
                                      str: "What meetings do I have today?"
                                             │
                                    Transition to PROCESSING

3. PROCESSING — LLM Reasoning
   ┌──────────────────────────────────────────────────┐
   │ Claude API (anthropic SDK)                       │
   │                                                  │
   │ messages=[{"role":"user",                        │
   │            "content": transcript}]               │
   │                                                  │
   │ mcp_servers=[{                                   │
   │   "type": "url",                                 │
   │   "url": "https://mcp-api.unified.to/mcp?...",   │
   │   "name": "unified-tools"                        │
   │ }]                                               │
   │                                                  │
   │ Claude discovers tools → calls them → reasons    │
   └──────────────────┬───────────────────────────────┘
                      │
                str: "You have 3 meetings today: ..."
                      │
                Transition to SPEAKING

4. SPEAKING — Text-to-Speech + Playback
   ┌─────────────┐    str     ┌──────────────────┐
   │ Response     │ ────────►│ Deepgram TTS     │
   │ text         │           │ REST API         │
   └─────────────┘           │ (aura-2-thalia)  │
                              └────────┬─────────┘
                                       │
                                 bytes (linear16, 24kHz)
                                       │
                                       ▼
                              ┌─────────────────────┐
                              │ numpy.frombuffer()   │
                              │ → np.ndarray int16   │
                              └────────┬────────────┘
                                       │
                                       ▼
                              ┌─────────────────────┐
                              │ sounddevice.play()   │
                              │ samplerate=24000     │
                              └─────────────────────┘
                                       │
                                  playback done
                                       │
                              Transition to LISTENING
```

### Data Formats at Each Boundary

| Boundary | Format | Size per frame | Notes |
|---|---|---|---|
| pvrecorder → Queue | `list[int]` | 512 ints (16-bit signed) | pvrecorder returns Python list of ints |
| Queue → Porcupine | `list[int]` | 512 ints | Direct pass-through, no conversion |
| Queue → Deepgram STT | `bytes` | 1024 bytes | `struct.pack('<512h', *frame)` — little-endian 16-bit PCM |
| Deepgram STT → Orchestrator | `str` | Variable | Final transcript text |
| Orchestrator → Claude | `str` | Variable | User message content |
| Claude → Orchestrator | `str` | Variable | Assistant response text (after tool use resolution) |
| Orchestrator → Deepgram TTS | `str` | Variable | Text to speak |
| Deepgram TTS → Player | `bytes` | Variable | Linear16 PCM at 24kHz |
| Bytes → sounddevice | `np.ndarray[int16]` | Variable | `numpy.frombuffer(data, dtype=np.int16)` |

### Frame Conversion Helper

```python
# audio.py

def frames_to_bytes(frame: list[int]) -> bytes:
    """Convert pvrecorder frame (list of ints) to raw PCM bytes for Deepgram."""
    import struct
    return struct.pack(f'<{len(frame)}h', *frame)
```

---

## 5. Error Handling

POC-grade error handling. Philosophy: **log the error, return to LISTENING state, keep running.**

### Strategy Per Component

| Component | Failure Mode | Response |
|---|---|---|
| pvrecorder | Device not found / permissions | Fatal — print message, exit. Cannot recover without a mic. |
| pvrecorder | Read timeout / device error | Log warning, continue loop. pvrecorder handles transient errors. |
| Porcupine | Init failure (bad access key) | Fatal — print message with setup instructions, exit. |
| Porcupine | Process error | Log warning, skip frame, stay in LISTENING. |
| Deepgram STT | WebSocket connection failure | Log error, return to LISTENING. User can try again. |
| Deepgram STT | No transcript (silence timeout) | Log info "no speech detected", return to LISTENING. |
| Deepgram STT | WebSocket drops mid-stream | Log error, return to LISTENING. |
| Claude API | API error (rate limit, auth, network) | Log error, speak "Sorry, I couldn't process that", return to LISTENING. |
| Claude API | Timeout (>30s) | Same as API error — httpx timeout, caught as exception. |
| Claude MCP | Tool execution failure | Claude handles this internally — the MCP error becomes part of the conversation. |
| Deepgram TTS | API error | Log error, print response text to terminal instead (fallback), return to LISTENING. |
| sounddevice | Playback error | Log error, return to LISTENING. |

### Error Handling Pattern

```python
# orchestrator.py — each state handler wraps its work in try/except

async def _handle_recording(self) -> State | tuple[State, str]:
    try:
        transcript_future = await self._stt.start_session()
        # ... stream frames ...
        transcript = await asyncio.wait_for(transcript_future, timeout=15.0)
        await self._stt.close_session()
        return State.PROCESSING, transcript
    except asyncio.TimeoutError:
        logger.warning("STT timeout — no speech detected")
        await self._stt.close_session()
        return State.LISTENING
    except Exception:
        logger.exception("STT error")
        await self._stt.close_session()
        return State.LISTENING
```

### Fatal vs Recoverable

Two categories only:

- **Fatal** (exit the process): Missing credentials, missing audio device, Porcupine init failure. These are printed to stderr with actionable instructions and `sys.exit(1)`.
- **Recoverable** (return to LISTENING): Everything else. Log the exception, clean up any open connections, transition back to LISTENING.

### Logging

Use Python's `logging` module. Single logger per module:

```python
logger = logging.getLogger(__name__)
```

`main.py` configures the root logger with a format that includes timestamp and level:

```python
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
```

Terminal also prints user-facing status messages:
- `"Listening for wake word..."` (on entering LISTENING)
- `"Listening..."` (when recording starts)
- `"Thinking..."` (when processing)
- `"Speaking..."` (when playing audio)

---

## 6. Configuration

### .env File

All secrets and tunable parameters live in `.env`. Loaded by `python-dotenv` in `main.py`.

```bash
# .env.example

# Required
PICOVOICE_ACCESS_KEY=your-access-key-here
DEEPGRAM_API_KEY=your-deepgram-key-here
ANTHROPIC_API_KEY=your-anthropic-key-here

# Unified.to MCP (optional — without these, Claude has no tools)
UNIFIED_API_TOKEN=your-unified-token
UNIFIED_CONNECTION_ID=your-connection-id

# Optional tuning
WAKE_WORD_MODEL_PATH=./hey-effi.ppn           # Path to custom wake word model
CLAUDE_MODEL=claude-sonnet-4-20250514          # Model for LLM calls
DEEPGRAM_STT_MODEL=nova-3                      # STT model
DEEPGRAM_TTS_MODEL=aura-2-thalia-en            # TTS voice
DEEPGRAM_TTS_SAMPLE_RATE=24000                 # TTS output sample rate
ENDPOINTING_MS=300                             # Silence before STT finalizes
LOG_LEVEL=INFO                                 # Logging level
```

### Config Dataclass

```python
# main.py

@dataclasses.dataclass(frozen=True)
class Config:
    # Required
    picovoice_access_key: str
    deepgram_api_key: str
    anthropic_api_key: str

    # Optional — MCP tools
    unified_api_token: str | None = None
    unified_connection_id: str | None = None

    # Tuning
    wake_word_model_path: str = "./hey-effi.ppn"
    claude_model: str = "claude-sonnet-4-20250514"
    deepgram_stt_model: str = "nova-3"
    deepgram_tts_model: str = "aura-2-thalia-en"
    deepgram_tts_sample_rate: int = 24000
    endpointing_ms: int = 300
    log_level: str = "INFO"

    @classmethod
    def from_env(cls) -> "Config":
        """Load from environment variables. Raises on missing required vars."""
        def require(key: str) -> str:
            val = os.environ.get(key)
            if not val:
                print(f"ERROR: {key} is required. Set it in .env", file=sys.stderr)
                sys.exit(1)
            return val

        return cls(
            picovoice_access_key=require("PICOVOICE_ACCESS_KEY"),
            deepgram_api_key=require("DEEPGRAM_API_KEY"),
            anthropic_api_key=require("ANTHROPIC_API_KEY"),
            unified_api_token=os.environ.get("UNIFIED_API_TOKEN"),
            unified_connection_id=os.environ.get("UNIFIED_CONNECTION_ID"),
            wake_word_model_path=os.environ.get("WAKE_WORD_MODEL_PATH", "./hey-effi.ppn"),
            claude_model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
            deepgram_stt_model=os.environ.get("DEEPGRAM_STT_MODEL", "nova-3"),
            deepgram_tts_model=os.environ.get("DEEPGRAM_TTS_MODEL", "aura-2-thalia-en"),
            deepgram_tts_sample_rate=int(os.environ.get("DEEPGRAM_TTS_SAMPLE_RATE", "24000")),
            endpointing_ms=int(os.environ.get("ENDPOINTING_MS", "300")),
            log_level=os.environ.get("LOG_LEVEL", "INFO"),
        )
```

### Built-in Wake Word Fallback

If `WAKE_WORD_MODEL_PATH` is not set or the file doesn't exist, fall back to Porcupine's built-in `"jarvis"` keyword. This lets developers run the POC immediately without training a custom model.

```python
# wake_word.py

class WakeWordDetector:
    def __init__(self, access_key: str, model_path: str = "./hey-effi.ppn"):
        kwargs = {"access_key": access_key}
        if os.path.exists(model_path):
            kwargs["keyword_paths"] = [model_path]
            logger.info("Using custom wake word model: %s", model_path)
        else:
            kwargs["keywords"] = ["jarvis"]
            logger.info("Custom model not found — using built-in 'jarvis' wake word")
        self._porcupine = pvporcupine.create(**kwargs)

    @property
    def frame_length(self) -> int:
        return self._porcupine.frame_length

    def process(self, frame: list[int]) -> bool:
        """Returns True if wake word detected."""
        return self._porcupine.process(frame) >= 0

    def cleanup(self):
        self._porcupine.delete()
```

---

## 7. Testing Approach

### Philosophy

Test without hardware. All audio I/O is injected, so tests run in Gitpod or CI.

### Mock Strategy

Every component takes its dependency as a constructor argument (no globals, no module-level singletons). Tests inject mocks or fakes.

```python
# conftest.py

import numpy as np
import pytest

@pytest.fixture
def mock_audio_frames() -> list[list[int]]:
    """Generate silent audio frames (512 samples of zeros)."""
    return [[0] * 512 for _ in range(100)]

@pytest.fixture
def spoken_audio_frames() -> list[list[int]]:
    """Load a real WAV file as pvrecorder-format frames."""
    import wave
    import struct

    with wave.open("fixtures/hello.wav", "rb") as wf:
        assert wf.getsampwidth() == 2      # 16-bit
        assert wf.getframerate() == 16000   # 16kHz
        assert wf.getnchannels() == 1       # mono

        raw = wf.readframes(wf.getnframes())
        samples = struct.unpack(f'<{len(raw)//2}h', raw)

        # Chunk into 512-sample frames
        frame_size = 512
        frames = []
        for i in range(0, len(samples), frame_size):
            chunk = list(samples[i:i+frame_size])
            if len(chunk) == frame_size:
                frames.append(chunk)
        return frames
```

### Test Categories

| Test | What it validates | Mocking strategy |
|---|---|---|
| `test_orchestrator.py` | State transitions (LISTENING→RECORDING→PROCESSING→SPEAKING→LISTENING) | Mock all components. `WakeWordDetector.process()` returns True on frame N. `SpeechToText` returns a canned transcript. `Assistant` returns canned text. `TextToSpeech` returns silent PCM. `AudioPlayer.play()` is a no-op. |
| `test_stt.py` | Frame-to-bytes conversion, Deepgram options construction | No network calls. Test `frames_to_bytes()` helper. Test `LiveOptions` are correct. |
| `test_llm.py` | Message construction, MCP server config, response extraction | Mock `anthropic.AsyncAnthropic`. Verify `mcp_servers` param is built correctly. Verify tool-use responses are handled (multi-turn). |
| `test_tts.py` | TTS request construction, PCM-to-numpy conversion | Mock Deepgram REST client. Test `numpy.frombuffer()` conversion. |

### Integration Test (Optional, Local-Only)

A manual integration test script (`test_integration.py`, not in CI) that:
1. Reads a WAV file instead of microphone
2. Sends it through the real Deepgram STT
3. Sends the transcript to real Claude
4. Gets real TTS audio back
5. Writes the result to `output.wav` instead of speakers

This validates the full pipeline without hardware, but requires API keys.

```python
# test_integration.py (manual, not in CI)

async def test_full_pipeline():
    """Run the full pipeline with a WAV file input and WAV file output."""
    config = Config.from_env()

    # 1. Read WAV file as frames
    frames = load_wav_as_frames("fixtures/hello.wav")

    # 2. STT
    stt = SpeechToText(config.deepgram_api_key)
    transcript_future = await stt.start_session()
    for frame in frames:
        await stt.send_audio(frames_to_bytes(frame))
    await stt.close_session()
    transcript = await transcript_future

    # 3. LLM
    assistant = Assistant(config)
    response = await assistant.respond(transcript)

    # 4. TTS
    tts = TextToSpeech(config.deepgram_api_key, model=config.deepgram_tts_model)
    audio_data = await tts.synthesize(response)

    # 5. Write to WAV
    write_wav("output.wav", audio_data, sample_rate=config.deepgram_tts_sample_rate)

    print(f"Transcript: {transcript}")
    print(f"Response: {response}")
    print(f"Audio written to output.wav")
```

### pyproject.toml

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
    "numpy>=1.26",
    "python-dotenv",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["orchestrator.py", "audio.py", "wake_word.py", "stt.py", "llm.py", "tts.py"]

[dependency-groups]
dev = [
    "pytest>=9.0",
    "pytest-asyncio>=0.24",
]

[project.scripts]
effi = "main:main"
```

---

## 8. Component API Summary

Compact reference for implementation.

### audio.py

```python
class AudioCapture:
    def __init__(self, frame_length: int): ...
    def start(self, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue): ...
    def stop(self): ...

class AudioPlayer:
    def __init__(self, sample_rate: int = 24000): ...
    async def play(self, pcm_data: np.ndarray): ...

def frames_to_bytes(frame: list[int]) -> bytes: ...
```

### wake_word.py

```python
class WakeWordDetector:
    def __init__(self, access_key: str, model_path: str = "./hey-effi.ppn"): ...
    @property
    def frame_length(self) -> int: ...
    def process(self, frame: list[int]) -> bool: ...
    def cleanup(self): ...
```

### stt.py

```python
class SpeechToText:
    def __init__(self, api_key: str, model: str = "nova-3", endpointing_ms: int = 300): ...
    async def start_session(self) -> asyncio.Future[str]: ...
    async def send_audio(self, frame_bytes: bytes): ...
    async def close_session(self): ...
```

### llm.py

```python
class Assistant:
    def __init__(self, config: Config): ...
    async def respond(self, transcript: str) -> str: ...
```

The `respond` method:
1. Builds the messages list: system prompt + user transcript
2. Calls `client.beta.messages.create()` with `mcp_servers` if configured
3. Handles multi-turn tool use internally (the SDK manages this with `mcp_servers`)
4. Returns the final text response

System prompt:
```
You are Effi, a helpful voice assistant. Keep responses concise and conversational —
they will be spoken aloud. Aim for 1-3 sentences unless the user asks for detail.
You have access to the user's connected tools via Unified.to.
```

### tts.py

```python
class TextToSpeech:
    def __init__(self, api_key: str, model: str = "aura-2-thalia-en",
                 sample_rate: int = 24000): ...
    async def synthesize(self, text: str) -> np.ndarray: ...
```

The `synthesize` method uses Deepgram's REST TTS endpoint (not WebSocket). REST is simpler and sufficient for POC latency targets — the full response is typically <500ms for a few sentences. Returns a numpy int16 array ready for `sounddevice.play()`.

---

## 9. Design Decisions & Rationale

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| STT connection lifecycle | Ephemeral (open per utterance) | Persistent WebSocket | Saves API credits, avoids idle timeout issues, simpler state |
| TTS method | REST (not WebSocket) | WebSocket streaming TTS | REST is simpler. For 1-3 sentence responses, latency is acceptable. WebSocket TTS adds complexity (chunked playback, connection management) for marginal gain. |
| Claude model | `claude-sonnet-4-20250514` | `claude-haiku`, `claude-opus` | Sonnet balances quality and speed. Haiku fallback if latency is too high. |
| Deepgram `interim_results` | `False` | `True` | POC doesn't need partial transcripts. Final-only is simpler to handle. |
| Audio queue max size | 100 frames (~3.2s) | Unbounded | Back-pressure prevents memory growth during PROCESSING/SPEAKING when frames aren't consumed. |
| Frame draining during PROCESSING/SPEAKING | Drain queue (discard frames) | Stop pvrecorder | Stopping/starting pvrecorder adds latency and complexity. Easier to just drain the queue. |
| MCP approach | `mcp_servers` beta param | Local MCP client | Dramatically less code. Acceptable for POC. Fallback documented in research. |
| Config | Flat dataclass from env vars | YAML/TOML config file | `.env` + dataclass is the simplest thing that works. No config file parsing needed. |
| Silence timeout in RECORDING | 5s with no `is_final` transcript | Deepgram-only endpointing | Belt-and-suspenders. Deepgram's endpointing catches normal pauses. Our 5s timeout catches the case where no speech happens at all after wake word. |

---

## 10. Queue Draining During Non-Listening States

During PROCESSING and SPEAKING, the audio capture thread continues running (stopping/starting pvrecorder adds latency). Frames accumulate in the queue but are irrelevant. When transitioning back to LISTENING, we drain the queue:

```python
async def _drain_queue(self):
    """Discard all queued audio frames."""
    while not self._frame_queue.empty():
        try:
            self._frame_queue.get_nowait()
        except asyncio.QueueEmpty:
            break
```

This is called at the beginning of `_handle_listening()` to ensure Porcupine starts fresh.

---

## 11. Entry Point

```python
# main.py

import asyncio
import sys
import logging

from dotenv import load_dotenv

def main():
    load_dotenv()
    config = Config.from_env()

    logging.basicConfig(
        level=getattr(logging, config.log_level),
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    # Initialize components
    wake_word = WakeWordDetector(config.picovoice_access_key, config.wake_word_model_path)
    audio_capture = AudioCapture(frame_length=wake_word.frame_length)
    audio_player = AudioPlayer(sample_rate=config.deepgram_tts_sample_rate)
    stt = SpeechToText(config.deepgram_api_key, config.deepgram_stt_model, config.endpointing_ms)
    llm = Assistant(config)
    tts = TextToSpeech(config.deepgram_api_key, config.deepgram_tts_model, config.deepgram_tts_sample_rate)

    orchestrator = Orchestrator(audio_capture, wake_word, stt, llm, tts, audio_player)

    print("Effi Voice Assistant starting...")
    print(f"Wake word: {'custom model' if config.wake_word_model_path else 'jarvis'}")
    print(f"Model: {config.claude_model}")
    print("Press Ctrl+C to exit.\n")

    try:
        asyncio.run(orchestrator.run())
    except KeyboardInterrupt:
        print("\nShutting down.")

if __name__ == "__main__":
    main()
```
