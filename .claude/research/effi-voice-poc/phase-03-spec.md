# Phase 03 — Implementation Spec

Date: 2026-02-27

---

## 1. Project Setup

### Directory

```
experiments/effi-voice-poc/
```

### pyproject.toml

```toml
[project]
name = "effi-voice-poc"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "pvporcupine>=4.0,<5.0",
    "pvrecorder>=1.2,<2.0",
    "deepgram-sdk>=6.0,<7.0",
    "anthropic>=0.80,<1.0",
    "sounddevice>=0.5,<1.0",
    "numpy>=1.26,<3.0",
    "python-dotenv>=1.0,<2.0",
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

### .env.example

```bash
# ─── Required ────────────────────────────────────────────────
PICOVOICE_ACCESS_KEY=             # Free key from console.picovoice.ai
DEEPGRAM_API_KEY=                 # From console.deepgram.com
ANTHROPIC_API_KEY=                # From console.anthropic.com

# ─── Unified.to MCP (optional — without these, Claude has no tools) ───
UNIFIED_API_TOKEN=                # From unified.to dashboard
UNIFIED_CONNECTION_ID=            # Connection ID for the integration

# ─── Optional tuning ─────────────────────────────────────────
# WAKE_WORD_MODEL_PATH=./hey-effi.ppn    # Custom .ppn file; falls back to built-in "jarvis"
# CLAUDE_MODEL=claude-sonnet-4-20250514  # LLM model
# DEEPGRAM_STT_MODEL=nova-3              # STT model
# DEEPGRAM_TTS_MODEL=aura-2-thalia-en    # TTS voice
# DEEPGRAM_TTS_SAMPLE_RATE=24000         # TTS output sample rate (Hz)
# ENDPOINTING_MS=300                     # Silence (ms) before STT finalizes
# SILENCE_TIMEOUT_S=5                    # Max seconds of total silence in RECORDING
# LOG_LEVEL=INFO                         # Python logging level
```

### .gitignore

```gitignore
.env
*.ppn
__pycache__/
*.pyc
.venv/
uv.lock
output.wav
fixtures/*.wav
```

### System dependency (one-time, documented in README comment at top of main.py)

```bash
# Ubuntu/Debian — required for audio playback via sounddevice
sudo apt install libportaudio2
```

---

## 2. Module Specifications

### 2.1 main.py

**Path:** `experiments/effi-voice-poc/main.py`

**Public interface:**

```python
import asyncio
import dataclasses
import logging
import os
import sys

from dotenv import load_dotenv


@dataclasses.dataclass(frozen=True)
class Config:
    """Immutable configuration loaded from environment variables."""

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
    silence_timeout_s: int = 5
    log_level: str = "INFO"

    @classmethod
    def from_env(cls) -> "Config":
        """Load from environment variables. Exits with message on missing required vars."""
        ...


def main() -> None:
    """Entry point. Loads config, initializes components, runs orchestrator."""
    ...


if __name__ == "__main__":
    main()
```

**Behavior:**

1. Call `load_dotenv()` to read `.env`.
2. Call `Config.from_env()` — exits with actionable error message if any required key is missing.
3. Configure root logger with timestamp + level format.
4. Instantiate all components in order: `WakeWordDetector` -> `AudioCapture` (using `wake_word.frame_length`) -> `AudioPlayer` -> `SpeechToText` -> `Assistant` -> `TextToSpeech` -> `Orchestrator`.
5. Print startup banner (wake word type, model name, Ctrl+C hint).
6. Call `asyncio.run(orchestrator.run())`.
7. Catch `KeyboardInterrupt` at the top level and print clean shutdown message.

**Error handling:**

- `Config.from_env()` prints `"ERROR: {KEY} is required. Set it in .env"` to stderr and calls `sys.exit(1)` for each missing required variable.
- Component init failures (bad Picovoice key, no audio device) are fatal — let the exception propagate with its natural message. The orchestrator's `finally` block handles cleanup.

**Dependencies:** All other modules.

---

### 2.2 orchestrator.py

**Path:** `experiments/effi-voice-poc/orchestrator.py`

**Public interface:**

```python
import asyncio
import enum
import logging

import numpy as np

from audio import AudioCapture, AudioPlayer, frames_to_bytes
from wake_word import WakeWordDetector
from stt import SpeechToText
from llm import Assistant
from tts import TextToSpeech


logger = logging.getLogger(__name__)


class State(enum.Enum):
    LISTENING = "listening"
    RECORDING = "recording"
    PROCESSING = "processing"
    SPEAKING = "speaking"


class Orchestrator:
    def __init__(
        self,
        audio: AudioCapture,
        wake_word: WakeWordDetector,
        stt: SpeechToText,
        llm: Assistant,
        tts: TextToSpeech,
        player: AudioPlayer,
        silence_timeout_s: int = 5,
    ) -> None:
        """Store components. Initialize state to LISTENING. Create frame queue (maxsize=100)."""
        ...

    async def run(self) -> None:
        """Main loop. Start audio capture thread, then dispatch to state handlers forever."""
        ...

    async def _handle_listening(self) -> State:
        """Drain stale frames, then read frames from queue and feed to Porcupine.
        Returns RECORDING when wake word detected. Plays confirmation chime."""
        ...

    async def _handle_recording(self) -> tuple[State, str] | State:
        """Open Deepgram STT session. Read frames from queue, convert to bytes, send to STT.
        Returns (PROCESSING, transcript) on final transcript.
        Returns LISTENING on silence timeout or error."""
        ...

    async def _handle_processing(self, transcript: str) -> tuple[State, str] | State:
        """Send transcript to Claude. Returns (SPEAKING, response_text) on success.
        Returns LISTENING on error (after logging)."""
        ...

    async def _handle_speaking(self, response_text: str) -> State:
        """Synthesize speech via TTS, play audio. Returns LISTENING.
        Falls back to printing text on TTS/playback error."""
        ...

    async def _drain_queue(self) -> None:
        """Discard all queued audio frames (called when entering LISTENING)."""
        ...

    def _play_chime(self) -> None:
        """Play a short confirmation ding (see Section 4.1 for implementation)."""
        ...
```

**Behavior — main loop:**

The `run()` method contains a `while True` with a `match self._state` dispatcher. Each state handler returns the next state (and optionally data). The loop carries data between states via instance variables `self._transcript` and `self._response`.

```python
async def run(self) -> None:
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
                    result = await self._handle_processing(self._transcript)
                    if isinstance(result, tuple):
                        self._state, self._response = result
                    else:
                        self._state = result
                case State.SPEAKING:
                    self._state = await self._handle_speaking(self._response)
    except KeyboardInterrupt:
        pass
    finally:
        self._audio.stop()
        self._wake_word.cleanup()
```

**State handler details:**

`_handle_listening()`:
1. Call `_drain_queue()` to discard stale frames.
2. Print `"Listening for wake word..."` to terminal.
3. Loop: `frame = await self._frame_queue.get()`.
4. Call `self._wake_word.process(frame)`.
5. If True: call `_play_chime()`, return `State.RECORDING`.

`_handle_recording()`:
1. Print `"Listening..."` to terminal.
2. Call `transcript_future = await self._stt.start_session()`.
3. Start a combined loop that reads frames and sends them to STT via `send_audio(frames_to_bytes(frame))`.
4. Use `asyncio.wait_for(transcript_future, timeout=self._silence_timeout_s)` as a concurrent task.
5. On success: `await self._stt.close_session()`, return `(State.PROCESSING, transcript)`.
6. On `TimeoutError`: log `"No speech detected"`, close session, return `State.LISTENING`.
7. On any exception: log error, close session, return `State.LISTENING`.

Implementation detail for concurrent frame sending + transcript waiting:

```python
async def _handle_recording(self) -> tuple[State, str] | State:
    try:
        transcript_future = await self._stt.start_session()
        print("Listening...")

        # Send frames while waiting for final transcript
        send_task = asyncio.create_task(self._stream_frames_to_stt())
        try:
            transcript = await asyncio.wait_for(transcript_future, timeout=15.0)
        finally:
            send_task.cancel()
            try:
                await send_task
            except asyncio.CancelledError:
                pass

        await self._stt.close_session()
        logger.info("Transcript: %s", transcript)
        return State.PROCESSING, transcript
    except asyncio.TimeoutError:
        logger.warning("No speech detected (timeout)")
        await self._stt.close_session()
        return State.LISTENING
    except Exception:
        logger.exception("STT error")
        await self._stt.close_session()
        return State.LISTENING

async def _stream_frames_to_stt(self) -> None:
    """Read frames from queue and send to STT until cancelled."""
    while True:
        frame = await self._frame_queue.get()
        await self._stt.send_audio(frames_to_bytes(frame))
```

`_handle_processing(transcript)`:
1. Print `"Thinking..."` to terminal.
2. Call `response = await self._llm.respond(transcript)`.
3. On success: return `(State.SPEAKING, response)`.
4. On exception: log error, return `State.LISTENING`.

`_handle_speaking(response_text)`:
1. Print `f"Effi: {response_text}"` to terminal.
2. Print `"Speaking..."`.
3. Call `audio_data = await self._tts.synthesize(response_text)`.
4. Call `await self._player.play(audio_data)`.
5. Return `State.LISTENING`.
6. On TTS or playback error: log, still return `State.LISTENING`.

**Error handling:** Each state handler wraps its body in `try/except Exception`. Recoverable errors log and return `State.LISTENING`. Fatal errors (missing audio device) propagate up through `run()` and are caught by the `finally` block.

**Dependencies:** audio, wake_word, stt, llm, tts.

---

### 2.3 audio.py

**Path:** `experiments/effi-voice-poc/audio.py`

**Public interface:**

```python
import asyncio
import struct
import threading
import logging

import numpy as np
import sounddevice as sd
from pvrecorder import PvRecorder

logger = logging.getLogger(__name__)


def frames_to_bytes(frame: list[int]) -> bytes:
    """Convert pvrecorder frame (list of 16-bit signed ints) to little-endian PCM bytes.

    Args:
        frame: List of integers from pvrecorder.read(). Each int is a 16-bit signed sample.

    Returns:
        Raw PCM bytes (2 bytes per sample, little-endian) suitable for Deepgram STT.
    """
    return struct.pack(f"<{len(frame)}h", *frame)


def generate_chime(
    frequency: float = 880.0,
    duration: float = 0.15,
    sample_rate: int = 24000,
) -> np.ndarray:
    """Generate a short sine-wave chime as a numpy int16 array.

    Args:
        frequency: Tone frequency in Hz. Default 880 Hz (A5 — a pleasant "ding").
        duration: Duration in seconds. Default 0.15s.
        sample_rate: Output sample rate in Hz. Match the AudioPlayer's sample rate.

    Returns:
        numpy int16 array ready for sounddevice.play().
    """
    ...


class AudioCapture:
    """Captures audio from the microphone in a background thread.

    pvrecorder.read() is blocking, so capture runs in a dedicated daemon thread.
    Frames are pushed into an asyncio.Queue via loop.call_soon_threadsafe().
    """

    def __init__(self, frame_length: int) -> None:
        """
        Args:
            frame_length: Number of samples per frame. Must equal porcupine.frame_length.
        """
        ...

    def start(self, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue[list[int]]) -> None:
        """Start the capture thread. Frames are pushed into the provided async queue.

        Args:
            loop: The running asyncio event loop (for call_soon_threadsafe).
            queue: Async queue to receive frames.
        """
        ...

    def stop(self) -> None:
        """Signal the capture thread to stop, join it, and release the recorder."""
        ...

    def _capture_loop(self) -> None:
        """Internal blocking loop running in the capture thread."""
        ...


class AudioPlayer:
    """Plays PCM audio through the system speakers via sounddevice."""

    def __init__(self, sample_rate: int = 24000) -> None:
        """
        Args:
            sample_rate: Expected sample rate of audio data. Must match TTS output.
        """
        ...

    async def play(self, pcm_data: np.ndarray) -> None:
        """Play PCM audio data. Runs blocking sounddevice.play() in an executor.

        Args:
            pcm_data: numpy int16 array of audio samples.
        """
        ...

    def play_sync(self, pcm_data: np.ndarray) -> None:
        """Synchronous playback. Blocks until audio finishes.

        Used for the chime (called from the orchestrator without awaiting).
        """
        ...
```

**Behavior — AudioCapture:**

- `__init__`: Create `PvRecorder(frame_length=frame_length)`. Store a `threading.Event` for shutdown signaling.
- `start`: Store the loop and queue references. Create and start a daemon thread running `_capture_loop`. Call `self._recorder.start()`.
- `_capture_loop`: `while not self._shutdown.is_set()`: call `self._recorder.read()` (blocks ~32ms), then `self._loop.call_soon_threadsafe(self._queue.put_nowait, frame)`. Catch `Full` on the queue and silently drop the frame (back-pressure).
- `stop`: Set the shutdown event, join the thread (timeout 2s), call `self._recorder.stop()`, call `self._recorder.delete()`.

**Behavior — AudioPlayer:**

- `play`: Run `self.play_sync(pcm_data)` in the default executor via `loop.run_in_executor(None, ...)`.
- `play_sync`: Call `sd.play(pcm_data, samplerate=self._sample_rate)` then `sd.wait()`.

**Behavior — generate_chime:**

1. Create a time array: `t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)`.
2. Generate sine wave: `wave = np.sin(2 * np.pi * frequency * t)`.
3. Apply a quick fade-out envelope (last 30% of samples) to avoid a click: multiply by a linear ramp from 1.0 to 0.0.
4. Scale to int16 range: `(wave * 0.3 * 32767).astype(np.int16)`. The 0.3 multiplier keeps the chime soft.

**Error handling:**

- `AudioCapture.__init__` — let `PvRecorder` raise on no device (fatal).
- `_capture_loop` — catch generic exceptions, log, and break the loop (prevents silent thread death).
- `play` — let exceptions propagate to the orchestrator (which catches and returns to LISTENING).

**Dependencies:** pvrecorder, sounddevice, numpy, struct, asyncio, threading.

---

### 2.4 wake_word.py

**Path:** `experiments/effi-voice-poc/wake_word.py`

**Public interface:**

```python
import logging
import os

import pvporcupine

logger = logging.getLogger(__name__)


class WakeWordDetector:
    """Thin wrapper around Picovoice Porcupine for wake word detection."""

    def __init__(self, access_key: str, model_path: str = "./hey-effi.ppn") -> None:
        """Initialize Porcupine. Falls back to built-in "jarvis" if model_path doesn't exist.

        Args:
            access_key: Picovoice AccessKey (from console.picovoice.ai).
            model_path: Path to custom .ppn wake word model file.

        Raises:
            pvporcupine.PorcupineError: On invalid access key or other init failure.
        """
        ...

    @property
    def frame_length(self) -> int:
        """Number of samples per audio frame expected by Porcupine (typically 512)."""
        return self._porcupine.frame_length

    def process(self, frame: list[int]) -> bool:
        """Feed an audio frame to Porcupine.

        Args:
            frame: List of 16-bit signed integers, length must equal self.frame_length.

        Returns:
            True if the wake word was detected in this frame.
        """
        return self._porcupine.process(frame) >= 0

    def cleanup(self) -> None:
        """Release Porcupine native resources. Call once on shutdown."""
        self._porcupine.delete()
```

**Behavior:**

- `__init__`: Check if `model_path` exists via `os.path.exists()`. If yes, use `keyword_paths=[model_path]`. If no, use `keywords=["jarvis"]` and log a warning. Call `pvporcupine.create(**kwargs)`.
- `process`: Single-line delegation to `self._porcupine.process(frame) >= 0`.
- `cleanup`: Call `self._porcupine.delete()`. Safe to call multiple times (Porcupine handles it).

**Error handling:**

- Init failure (bad access key): Let `PorcupineError` propagate (fatal).
- `process` errors: Let propagate to orchestrator (which catches and stays in LISTENING).

**Dependencies:** pvporcupine.

---

### 2.5 stt.py

**Path:** `experiments/effi-voice-poc/stt.py`

**Public interface:**

```python
import asyncio
import logging

from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveOptions,
    LiveTranscriptionEvents,
)

logger = logging.getLogger(__name__)


class SpeechToText:
    """Manages ephemeral Deepgram STT WebSocket sessions.

    Each call to start_session() opens a new WebSocket connection.
    Audio frames are sent via send_audio(). The session resolves a Future
    with the final transcript when Deepgram's endpointing triggers.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "nova-3",
        endpointing_ms: int = 300,
    ) -> None:
        """
        Args:
            api_key: Deepgram API key.
            model: Deepgram STT model name.
            endpointing_ms: Milliseconds of silence before Deepgram finalizes a transcript.
        """
        ...

    async def start_session(self) -> asyncio.Future[str]:
        """Open a new WebSocket STT session.

        Returns:
            A Future that will resolve with the final transcript string.
            The Future is resolved by the Deepgram on_transcript callback.
        """
        ...

    async def send_audio(self, frame_bytes: bytes) -> None:
        """Send raw PCM audio bytes to the active WebSocket session.

        Args:
            frame_bytes: Raw little-endian 16-bit PCM bytes (from frames_to_bytes).

        No-op if no session is active.
        """
        ...

    async def close_session(self) -> None:
        """Close the active WebSocket session. Safe to call if no session is active."""
        ...
```

**Behavior — start_session:**

1. Get the running event loop.
2. Create `self._transcript_future = loop.create_future()`.
3. Create the Deepgram async WebSocket connection: `self._connection = self._client.listen.asyncwebsocket.v("1")`.
4. Register event handler for `LiveTranscriptionEvents.Transcript`:
   - Extract `result.channel.alternatives[0]`.
   - If `result.is_final` and `alt.transcript.strip()` is non-empty, set the future result.
   - Guard against setting result on an already-done future.
5. Register handler for `LiveTranscriptionEvents.Error` — log the error, set exception on the future if not done.
6. Start the connection with `LiveOptions`:
   - `encoding="linear16"`
   - `sample_rate=16000`
   - `channels=1`
   - `model=self._model`
   - `language="en"`
   - `endpointing=self._endpointing_ms`
   - `interim_results=False`
   - `utterance_end_ms=1500`
7. Return the future.

**Behavior — send_audio:**

If `self._connection` is not None, call `await self._connection.send(frame_bytes)`.

**Behavior — close_session:**

If `self._connection` is not None, call `await self._connection.finish()`, then set `self._connection = None`.

**Error handling:**

- WebSocket connection failure in `start_session` — let exception propagate.
- `send_audio` on a closed connection — no-op (guard on `self._connection`).
- `close_session` — safe to call multiple times.

**Dependencies:** deepgram-sdk.

---

### 2.6 llm.py

**Path:** `experiments/effi-voice-poc/llm.py`

**Public interface:**

```python
import logging
from typing import TYPE_CHECKING

import anthropic

if TYPE_CHECKING:
    from main import Config

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are Effi, a helpful voice assistant. "
    "Keep responses concise and conversational — they will be spoken aloud. "
    "Aim for 1-3 sentences unless the user asks for detail. "
    "You have access to the user's connected tools via Unified.to."
)


class Assistant:
    """Claude-powered assistant with optional MCP tool access via Unified.to."""

    def __init__(self, config: "Config") -> None:
        """
        Args:
            config: Application config (needs anthropic_api_key, claude_model,
                    unified_api_token, unified_connection_id).
        """
        ...

    async def respond(self, transcript: str) -> str:
        """Send user transcript to Claude and return the text response.

        If MCP servers are configured, Claude can discover and use tools
        from Unified.to (calendar, email, etc.).

        Args:
            transcript: The user's spoken words (from STT).

        Returns:
            Claude's text response (suitable for TTS).

        Raises:
            anthropic.APIError: On API failures (rate limit, auth, network).
        """
        ...

    def _build_mcp_servers(self) -> list[dict] | None:
        """Build the mcp_servers parameter for the API call.

        Returns None if Unified.to credentials are not configured,
        which means Claude will respond without tool access.
        """
        ...

    def _extract_text(self, response: anthropic.types.Message) -> str:
        """Extract the text content from a Claude response message.

        Iterates content blocks and joins all TextBlock contents.
        Returns empty string if no text blocks found.
        """
        ...
```

**Behavior — respond:**

1. Build the messages list: `[{"role": "user", "content": transcript}]`.
2. Build `mcp_servers` via `_build_mcp_servers()`.
3. If `mcp_servers` is not None, call:
   ```python
   response = await self._client.beta.messages.create(
       model=self._model,
       max_tokens=1024,
       system=SYSTEM_PROMPT,
       messages=messages,
       mcp_servers=mcp_servers,
       betas=["mcp-client-2025-04-04"],
   )
   ```
4. If `mcp_servers` is None (no Unified.to config), call the stable API:
   ```python
   response = await self._client.messages.create(
       model=self._model,
       max_tokens=1024,
       system=SYSTEM_PROMPT,
       messages=messages,
   )
   ```
5. Extract and return text via `_extract_text(response)`.

**Behavior — _build_mcp_servers:**

If both `unified_api_token` and `unified_connection_id` are set on the config:

```python
return [{
    "type": "url",
    "url": f"https://mcp-api.unified.to/mcp?token={self._config.unified_api_token}&connection={self._config.unified_connection_id}",
    "name": "unified-tools",
}]
```

Otherwise return None.

**Behavior — _extract_text:**

```python
def _extract_text(self, response: anthropic.types.Message) -> str:
    parts = []
    for block in response.content:
        if block.type == "text":
            parts.append(block.text)
    return " ".join(parts) if parts else "I'm sorry, I couldn't generate a response."
```

**Note on multi-turn tool use:** When using the `mcp_servers` beta parameter, the Anthropic API handles the tool discovery, invocation, and multi-turn loop internally. The response returned to us is the final assistant text after all tool calls have resolved. We do not need to implement a tool-use loop ourselves.

**Error handling:**

- API errors (rate limit, auth, network) — let `anthropic.APIError` propagate to orchestrator.
- `httpx.TimeoutException` — let propagate (default timeout is 60s, sufficient for tool use).

**Dependencies:** anthropic.

---

### 2.7 tts.py

**Path:** `experiments/effi-voice-poc/tts.py`

**Public interface:**

```python
import logging

import numpy as np
from deepgram import DeepgramClient

logger = logging.getLogger(__name__)


class TextToSpeech:
    """Converts text to spoken audio via Deepgram's REST TTS API.

    Uses REST (not WebSocket) for simplicity. For 1-3 sentence responses,
    REST latency is typically <500ms which meets POC targets.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "aura-2-thalia-en",
        sample_rate: int = 24000,
    ) -> None:
        """
        Args:
            api_key: Deepgram API key.
            model: TTS voice model name.
            sample_rate: Desired output sample rate in Hz.
        """
        ...

    async def synthesize(self, text: str) -> np.ndarray:
        """Convert text to PCM audio.

        Args:
            text: The text to speak.

        Returns:
            numpy int16 array of PCM audio at self._sample_rate Hz.
            Ready to pass directly to AudioPlayer.play().

        Raises:
            Exception: On Deepgram API errors.
        """
        ...
```

**Behavior — synthesize:**

1. Call the Deepgram TTS REST API:
   ```python
   options = SpeakOptions(
       model=self._model,
       encoding="linear16",
       sample_rate=self._sample_rate,
   )
   response = await self._client.speak.asyncrest.v("1").stream_raw(
       {"text": text},
       options,
   )
   ```
2. Read the full response body as bytes.
3. If the response is a WAV file (starts with `b"RIFF"`), strip the 44-byte WAV header to get raw PCM.
4. Convert bytes to numpy: `np.frombuffer(pcm_bytes, dtype=np.int16)`.
5. Return the array.

**WAV header handling detail:**

Deepgram's REST TTS returns audio with a WAV header by default when using `linear16` encoding. The header is exactly 44 bytes for standard PCM WAV.

```python
def _strip_wav_header(self, data: bytes) -> bytes:
    """Strip WAV header if present, returning raw PCM bytes."""
    if data[:4] == b"RIFF":
        return data[44:]
    return data
```

**Error handling:**

- API errors — let propagate to orchestrator (which catches and prints text to terminal as fallback).

**Dependencies:** deepgram-sdk, numpy.

---

## 3. Implementation Slices

### Slice 1: Project Scaffold + Audio Capture + Wake Word Detection

**Goal:** Say the wake word, see a log message. Confirms audio capture, Porcupine, and the thread-to-async bridge all work.

**Files to create:**
- `pyproject.toml`
- `.env.example`
- `.gitignore`
- `main.py` — Config dataclass + skeleton entry point (only wake word + audio deps)
- `audio.py` — `AudioCapture` class + `frames_to_bytes()` + `generate_chime()`
- `wake_word.py` — `WakeWordDetector` class
- `orchestrator.py` — Only `State.LISTENING` handler implemented. Other states log and return to LISTENING.

**Stub files (empty or minimal):**
- `stt.py` — empty class with `pass` methods
- `llm.py` — empty class with `pass` methods
- `tts.py` — empty class with `pass` methods

**Test manually:**

```bash
cd experiments/effi-voice-poc
uv sync
cp .env.example .env
# Fill in PICOVOICE_ACCESS_KEY
uv run python main.py
# Say "Jarvis" (or custom wake word) → see log: "Wake word detected!"
# Hear confirmation chime
```

**Definition of done:**
- `uv sync` succeeds without errors
- Process starts, prints "Listening for wake word..."
- Speaking the wake word prints "Wake word detected!" and plays chime
- Ctrl+C cleanly shuts down (no tracebacks)

---

### Slice 2: STT Integration

**Goal:** Say the wake word, speak a sentence, see the transcript in the terminal.

**Files to create/modify:**
- `stt.py` — Full `SpeechToText` implementation
- `orchestrator.py` — Add `_handle_recording()` with frame streaming and transcript future
- `audio.py` — No changes needed (frames_to_bytes already exists)

**Test manually:**

```bash
# Fill in DEEPGRAM_API_KEY in .env
uv run python main.py
# Say "Jarvis" → hear chime → say "What time is it?" → see transcript in terminal
```

**Definition of done:**
- Wake word triggers recording mode
- Spoken words appear as transcript in terminal
- Silence timeout (5s) returns to listening without crash
- Deepgram WebSocket opens and closes cleanly (no resource leaks)

---

### Slice 3: LLM + MCP Integration

**Goal:** Hardcoded text input produces a Claude response with optional tool use.

**Files to create/modify:**
- `llm.py` — Full `Assistant` implementation
- `orchestrator.py` — Add `_handle_processing()` implementation

**Test manually (two modes):**

Without MCP (quick validation):
```bash
# Fill in ANTHROPIC_API_KEY in .env (no UNIFIED_ vars)
uv run python main.py
# Say "Jarvis" → "What is the capital of France?" → see Claude response in terminal
```

With MCP (Unified.to tools):
```bash
# Fill in UNIFIED_API_TOKEN and UNIFIED_CONNECTION_ID in .env
uv run python main.py
# Say "Jarvis" → "What meetings do I have today?" → see Claude response with tool results
```

**Unit test:** `tests/test_llm.py`
- Mock `anthropic.AsyncAnthropic`. Verify `mcp_servers` param is built correctly when Unified config is present.
- Verify `mcp_servers` is omitted when Unified config is absent.
- Verify `_extract_text()` handles text blocks and empty responses.

```python
# tests/test_llm.py

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from main import Config


@pytest.fixture
def config_with_mcp():
    return Config(
        picovoice_access_key="test",
        deepgram_api_key="test",
        anthropic_api_key="test",
        unified_api_token="tok_123",
        unified_connection_id="conn_456",
    )


@pytest.fixture
def config_without_mcp():
    return Config(
        picovoice_access_key="test",
        deepgram_api_key="test",
        anthropic_api_key="test",
    )


def test_build_mcp_servers_with_config(config_with_mcp):
    from llm import Assistant
    assistant = Assistant(config_with_mcp)
    servers = assistant._build_mcp_servers()
    assert servers is not None
    assert len(servers) == 1
    assert "unified.to" in servers[0]["url"]
    assert "tok_123" in servers[0]["url"]
    assert "conn_456" in servers[0]["url"]


def test_build_mcp_servers_without_config(config_without_mcp):
    from llm import Assistant
    assistant = Assistant(config_without_mcp)
    assert assistant._build_mcp_servers() is None


def test_extract_text_from_response():
    from llm import Assistant
    assistant = Assistant.__new__(Assistant)  # skip __init__
    mock_response = MagicMock()
    mock_block = MagicMock()
    mock_block.type = "text"
    mock_block.text = "Hello there"
    mock_response.content = [mock_block]
    assert assistant._extract_text(mock_response) == "Hello there"
```

**Definition of done:**
- Claude response appears in terminal after wake word + speech
- Without MCP config: basic Q&A works
- With MCP config: tool-augmented responses work
- API errors are caught and logged, system returns to LISTENING

---

### Slice 4: TTS + Playback

**Goal:** Hardcoded text is spoken through the speakers.

**Files to create/modify:**
- `tts.py` — Full `TextToSpeech` implementation
- `audio.py` — `AudioPlayer` class (if not already complete from slice 1)
- `orchestrator.py` — Add `_handle_speaking()` implementation

**Test manually:**

```bash
uv run python main.py
# Say "Jarvis" → "Tell me a joke" → hear Claude's response spoken aloud
```

**Unit test:** `tests/test_tts.py`
- Test `_strip_wav_header()` with and without WAV header.
- Test numpy conversion from raw PCM bytes.

```python
# tests/test_tts.py

import numpy as np


def test_strip_wav_header():
    from tts import TextToSpeech
    tts = TextToSpeech.__new__(TextToSpeech)

    # With WAV header
    header = b"RIFF" + b"\x00" * 40
    pcm = b"\x01\x00\x02\x00"
    assert tts._strip_wav_header(header + pcm) == pcm

    # Without header (raw PCM)
    assert tts._strip_wav_header(pcm) == pcm


def test_pcm_to_numpy():
    pcm_bytes = b"\x00\x00\xff\x7f\x01\x80"  # 0, 32767, -32767
    arr = np.frombuffer(pcm_bytes, dtype=np.int16)
    assert arr[0] == 0
    assert arr[1] == 32767
    assert arr[2] == -32767
```

**Definition of done:**
- Claude's text response is spoken through the speakers
- Audio is clear, correct sample rate (24kHz), no distortion
- TTS errors fall back to text-only output in terminal

---

### Slice 5: Full Pipeline Integration

**Goal:** Complete end-to-end loop: wake word -> STT -> LLM -> TTS -> speaker -> back to listening.

**Files to modify:**
- `orchestrator.py` — Final integration pass. Ensure all transitions are smooth.
- `tests/test_orchestrator.py` — Full state machine test with all components mocked.

**Test manually:**

```bash
uv run python main.py
# Full conversation loop:
# 1. Say "Jarvis" → hear chime
# 2. Say "What meetings do I have today?"
# 3. See transcript in terminal
# 4. See "Thinking..." status
# 5. See Claude response in terminal
# 6. Hear response spoken aloud
# 7. System returns to "Listening for wake word..."
# 8. Repeat
```

**Unit test:** `tests/test_orchestrator.py`

```python
# tests/test_orchestrator.py

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import numpy as np

from orchestrator import Orchestrator, State


@pytest.fixture
def mock_components():
    """Create mock versions of all components."""
    audio = MagicMock()
    audio.start = MagicMock()
    audio.stop = MagicMock()

    wake_word = MagicMock()
    wake_word.frame_length = 512
    wake_word.cleanup = MagicMock()

    stt = AsyncMock()
    llm = AsyncMock()
    tts = AsyncMock()
    player = AsyncMock()

    return audio, wake_word, stt, llm, tts, player


@pytest.mark.asyncio
async def test_listening_to_recording_transition(mock_components):
    """Wake word detection transitions from LISTENING to RECORDING."""
    audio, wake_word, stt, llm, tts, player = mock_components

    # Wake word detected on 3rd frame
    call_count = 0
    def process_side_effect(frame):
        nonlocal call_count
        call_count += 1
        return call_count >= 3

    wake_word.process = process_side_effect

    orch = Orchestrator(audio, wake_word, stt, llm, tts, player)

    # Pre-fill queue with frames
    for _ in range(5):
        await orch._frame_queue.put([0] * 512)

    result = await orch._handle_listening()
    assert result == State.RECORDING


@pytest.mark.asyncio
async def test_full_state_cycle(mock_components):
    """Verify LISTENING -> RECORDING -> PROCESSING -> SPEAKING -> LISTENING."""
    audio, wake_word, stt, llm, tts, player = mock_components

    # Configure mocks for a complete cycle
    wake_word.process = MagicMock(return_value=True)

    transcript_future = asyncio.get_event_loop().create_future()
    transcript_future.set_result("test query")
    stt.start_session = AsyncMock(return_value=transcript_future)

    mock_response = MagicMock()
    mock_block = MagicMock()
    mock_block.type = "text"
    mock_block.text = "test response"
    mock_response.content = [mock_block]
    llm.respond = AsyncMock(return_value="test response")

    tts.synthesize = AsyncMock(return_value=np.zeros(1000, dtype=np.int16))

    orch = Orchestrator(audio, wake_word, stt, llm, tts, player)

    # LISTENING -> RECORDING
    await orch._frame_queue.put([0] * 512)
    state = await orch._handle_listening()
    assert state == State.RECORDING
```

**Additional integration test (optional):** `tests/test_integration.py`

```python
# tests/test_integration.py — manual, not run in CI
# Requires API keys in .env and a fixtures/hello.wav file

async def test_full_pipeline_file_to_file():
    """Run STT -> LLM -> TTS with file I/O instead of microphone/speakers."""
    ...
```

**Definition of done:**
- Complete wake-to-speech loop works with no manual intervention
- Multiple consecutive interactions work (system correctly returns to LISTENING)
- Queue draining works (no stale audio after SPEAKING)
- Clean shutdown on Ctrl+C
- All unit tests pass: `uv run pytest tests/`

---

## 4. Key Implementation Details

### 4.1 Confirmation Chime

Generate a short sine wave programmatically. No external audio file needed.

```python
# audio.py

def generate_chime(
    frequency: float = 880.0,
    duration: float = 0.15,
    sample_rate: int = 24000,
) -> np.ndarray:
    """Generate a short confirmation ding."""
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    wave = np.sin(2 * np.pi * frequency * t)

    # Fade out the last 30% to avoid click
    fade_len = int(len(wave) * 0.3)
    if fade_len > 0:
        fade = np.linspace(1.0, 0.0, fade_len)
        wave[-fade_len:] *= fade

    return (wave * 0.3 * 32767).astype(np.int16)
```

The orchestrator generates the chime once at init and reuses it:

```python
# orchestrator.py __init__
self._chime = generate_chime(sample_rate=player._sample_rate)
```

Playing the chime (non-blocking, fire-and-forget via executor):

```python
# orchestrator.py _handle_listening
async def _play_chime(self):
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, self._player.play_sync, self._chime)
```

We await the chime so it finishes before recording starts (prevents the chime audio from being picked up by STT).

### 4.2 State Machine Transitions and Timeout Handling

**Silence timeout in RECORDING state:**

Two levels of timeout protection:

1. **Deepgram's `endpointing` (300ms default):** Detects end of speech (natural pause). Triggers `is_final` transcript. This is the normal path.

2. **Our `silence_timeout_s` (5s default):** Hard timeout via `asyncio.wait_for()`. Catches the case where the user says the wake word but then says nothing. Without this, the system would hang in RECORDING forever.

```python
# In _handle_recording:
try:
    transcript = await asyncio.wait_for(transcript_future, timeout=15.0)
except asyncio.TimeoutError:
    # No final transcript received in 15s — probably no speech
    logger.warning("Recording timeout — no speech detected")
    return State.LISTENING
```

The 15s timeout is generous — it allows for long utterances. Deepgram's endpointing handles the normal "user finished speaking" case much faster (within 300ms of silence).

**Error-to-LISTENING transitions:**

Every state handler wraps its body in `try/except Exception`. The except clause:
1. Logs the exception with `logger.exception()` (includes traceback).
2. Cleans up any open resources (e.g., STT WebSocket).
3. Returns `State.LISTENING`.

### 4.3 asyncio.Queue Bridge Between Capture Thread and Async Loop

The capture thread and async loop communicate via `asyncio.Queue`:

```
Capture Thread                    Async Loop (Main Thread)
─────────────                    ────────────────────────
pvrecorder.read()                await queue.get()
  → frame (list[int])             → frame (list[int])
  → loop.call_soon_threadsafe(    → process frame (Porcupine or STT)
      queue.put_nowait, frame)
```

**Critical details:**

1. **`call_soon_threadsafe`** is required because `asyncio.Queue.put_nowait()` is not thread-safe. `call_soon_threadsafe` schedules the put on the event loop's thread.

2. **`maxsize=100`** provides back-pressure. At 512 samples/frame and 16kHz, each frame is 32ms. 100 frames = 3.2s of buffered audio. During PROCESSING/SPEAKING, frames accumulate but are capped.

3. **Dropping frames on full queue:** When the queue is full, `put_nowait` raises `asyncio.QueueFull`. The capture thread catches this and silently drops the frame:

```python
def _capture_loop(self):
    while not self._shutdown.is_set():
        try:
            frame = self._recorder.read()
            self._loop.call_soon_threadsafe(self._queue.put_nowait, frame)
        except Exception:
            # Queue full or other error — drop frame and continue
            pass
```

4. **Queue draining:** When transitioning back to LISTENING, the orchestrator drains all stale frames:

```python
async def _drain_queue(self):
    while not self._frame_queue.empty():
        try:
            self._frame_queue.get_nowait()
        except asyncio.QueueEmpty:
            break
```

### 4.4 Deepgram WebSocket STT Lifecycle

The STT WebSocket connection is opened when entering RECORDING and closed when leaving.

**Open sequence:**

```python
async def start_session(self) -> asyncio.Future[str]:
    loop = asyncio.get_running_loop()
    self._transcript_future = loop.create_future()

    # Create connection object
    self._connection = self._client.listen.asyncwebsocket.v("1")

    # Register transcript handler
    async def on_transcript(self_dg, result, **kwargs):
        alt = result.channel.alternatives[0]
        if result.is_final and alt.transcript.strip():
            if not self._transcript_future.done():
                self._transcript_future.set_result(alt.transcript.strip())

    # Register error handler
    async def on_error(self_dg, error, **kwargs):
        logger.error("Deepgram STT error: %s", error)
        if not self._transcript_future.done():
            self._transcript_future.set_exception(
                RuntimeError(f"Deepgram STT error: {error}")
            )

    self._connection.on(LiveTranscriptionEvents.Transcript, on_transcript)
    self._connection.on(LiveTranscriptionEvents.Error, on_error)

    # Open the WebSocket with STT configuration
    await self._connection.start(LiveOptions(
        encoding="linear16",
        sample_rate=16000,
        channels=1,
        model=self._model,
        language="en",
        endpointing=self._endpointing_ms,
        interim_results=False,
        utterance_end_ms=1500,
    ))

    return self._transcript_future
```

**Audio streaming:** Frames are sent as raw bytes via `await self._connection.send(frame_bytes)`. Deepgram accepts arbitrary chunk sizes.

**Close sequence:**

```python
async def close_session(self):
    if self._connection:
        await self._connection.finish()
        self._connection = None
```

`finish()` sends a close-stream message to Deepgram, which triggers any remaining final transcripts before closing.

**Accumulating multi-utterance transcripts:** The current design captures only the first `is_final` transcript. For the POC, this is acceptable — the user speaks one command after the wake word. If we need multi-sentence input, the handler would accumulate all `is_final` transcripts into a list and use `utterance_end_ms` to know when the user is truly done.

### 4.5 Claude Beta mcp_servers Parameter Usage

```python
# llm.py — respond method

async def respond(self, transcript: str) -> str:
    messages = [{"role": "user", "content": transcript}]
    mcp_servers = self._build_mcp_servers()

    if mcp_servers:
        # Beta API with MCP tool access
        response = await self._client.beta.messages.create(
            model=self._model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=messages,
            mcp_servers=mcp_servers,
            betas=["mcp-client-2025-04-04"],
        )
    else:
        # Stable API without tools
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=messages,
        )

    return self._extract_text(response)
```

**Key points:**

1. **`betas=["mcp-client-2025-04-04"]`** — the SDK's beta method handles the header injection. We pass the beta version string, not the raw header.

2. **`mcp_servers` format:**
   ```python
   [{
       "type": "url",
       "url": "https://mcp-api.unified.to/mcp?token={TOKEN}&connection={CONN_ID}",
       "name": "unified-tools",
   }]
   ```

3. **Multi-turn tool use is automatic.** When Claude decides to use a tool, the Anthropic API:
   - Discovers available tools from the MCP server
   - Calls the tool
   - Feeds the result back to Claude
   - Returns the final text response
   All of this happens server-side. We get back a single response with the final answer.

4. **Response content blocks:** The response may contain multiple content blocks (text, tool_use, tool_result). We only extract `text` blocks via `_extract_text()`.

### 4.6 Deepgram REST TTS Call and Audio Playback

```python
# tts.py — synthesize method

async def synthesize(self, text: str) -> np.ndarray:
    options = SpeakOptions(
        model=self._model,
        encoding="linear16",
        sample_rate=self._sample_rate,
    )

    # Use the REST speak endpoint
    response = await self._client.speak.asyncrest.v("1").stream_raw(
        {"text": text},
        options,
    )

    # Read the full audio response
    audio_bytes = response.stream.read()

    # Strip WAV header if present
    pcm_bytes = self._strip_wav_header(audio_bytes)

    # Convert to numpy array for sounddevice
    return np.frombuffer(pcm_bytes, dtype=np.int16)
```

**Playback:**

```python
# audio.py — AudioPlayer

async def play(self, pcm_data: np.ndarray) -> None:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, self.play_sync, pcm_data)

def play_sync(self, pcm_data: np.ndarray) -> None:
    sd.play(pcm_data, samplerate=self._sample_rate)
    sd.wait()
```

`run_in_executor` is essential — `sd.wait()` blocks the thread until playback completes, which would freeze the event loop if called directly.

---

## 5. Configuration Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `PICOVOICE_ACCESS_KEY` | Yes | — | Free access key from console.picovoice.ai. Used by Porcupine for wake word detection. |
| `DEEPGRAM_API_KEY` | Yes | — | API key from console.deepgram.com. Used for both STT and TTS. |
| `ANTHROPIC_API_KEY` | Yes | — | API key from console.anthropic.com. Used for Claude LLM calls. |
| `UNIFIED_API_TOKEN` | No | None | API token from unified.to dashboard. Required for MCP tool access. |
| `UNIFIED_CONNECTION_ID` | No | None | Connection ID for the Unified.to integration. Required for MCP tool access. |
| `WAKE_WORD_MODEL_PATH` | No | `./hey-effi.ppn` | Path to custom Porcupine .ppn model file. Falls back to built-in "jarvis" keyword if file doesn't exist. |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-20250514` | Anthropic model ID for LLM calls. Use `claude-haiku` for lower latency. |
| `DEEPGRAM_STT_MODEL` | No | `nova-3` | Deepgram model for speech-to-text. |
| `DEEPGRAM_TTS_MODEL` | No | `aura-2-thalia-en` | Deepgram voice for text-to-speech. See Deepgram docs for voice options. |
| `DEEPGRAM_TTS_SAMPLE_RATE` | No | `24000` | TTS output sample rate in Hz. Must match the value expected by AudioPlayer. |
| `ENDPOINTING_MS` | No | `300` | Milliseconds of silence before Deepgram finalizes a transcript. Lower = faster but may cut off mid-sentence. Higher = more tolerant but adds latency. |
| `SILENCE_TIMEOUT_S` | No | `5` | Hard timeout (seconds) for the RECORDING state. If no final transcript is received within this time after entering RECORDING, return to LISTENING. |
| `LOG_LEVEL` | No | `INFO` | Python logging level (DEBUG, INFO, WARNING, ERROR). |

**Minimum viable .env for first run:**

```bash
PICOVOICE_ACCESS_KEY=your-key
DEEPGRAM_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
```

This gives you: wake word ("jarvis") -> STT -> Claude (no tools) -> TTS -> speaker.

Add `UNIFIED_API_TOKEN` and `UNIFIED_CONNECTION_ID` to enable tool access (calendar, email, etc.).

---

## 6. File Creation Checklist

Summary of all files to create, in slice order:

| Slice | File | Action |
|---|---|---|
| 1 | `pyproject.toml` | Create |
| 1 | `.env.example` | Create |
| 1 | `.gitignore` | Create |
| 1 | `main.py` | Create (full Config, skeleton main) |
| 1 | `audio.py` | Create (AudioCapture, AudioPlayer, frames_to_bytes, generate_chime) |
| 1 | `wake_word.py` | Create (WakeWordDetector) |
| 1 | `orchestrator.py` | Create (State enum, Orchestrator with LISTENING handler only) |
| 1 | `stt.py` | Create (stub) |
| 1 | `llm.py` | Create (stub) |
| 1 | `tts.py` | Create (stub) |
| 1 | `tests/__init__.py` | Create (empty) |
| 1 | `tests/conftest.py` | Create (shared fixtures) |
| 2 | `stt.py` | Implement (SpeechToText) |
| 2 | `orchestrator.py` | Add _handle_recording, _stream_frames_to_stt |
| 3 | `llm.py` | Implement (Assistant) |
| 3 | `orchestrator.py` | Add _handle_processing |
| 3 | `tests/test_llm.py` | Create |
| 4 | `tts.py` | Implement (TextToSpeech) |
| 4 | `orchestrator.py` | Add _handle_speaking |
| 4 | `tests/test_tts.py` | Create |
| 5 | `orchestrator.py` | Final integration (queue draining, chime timing) |
| 5 | `tests/test_orchestrator.py` | Create (state machine tests) |
