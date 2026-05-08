#!/usr/bin/env python3
"""TTFT-instrumented streaming wrapper.

Run a streaming command, record:
  t0 — just before subprocess start (request sent)
  t1 — first stdout byte received (first token)
  t2 — process exit (stream complete)

Usage:
  ttft.py <out-prefix> -- <command> [args...]

Writes:
  <out-prefix>.stream — full stdout (as bytes)
  <out-prefix>.timing.json — {"t0":..., "t1":..., "t2":..., "ttft_s":..., "ttc_s":..., "exit":...}
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time


def main() -> int:
    if len(sys.argv) < 4 or "--" not in sys.argv:
        print(__doc__, file=sys.stderr)
        return 2

    sep = sys.argv.index("--")
    prefix = sys.argv[1]
    cmd = sys.argv[sep + 1 :]
    if not cmd:
        print("no command", file=sys.stderr)
        return 2

    stream_path = f"{prefix}.stream"
    timing_path = f"{prefix}.timing.json"

    t0 = time.time()
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=0)

    t1: float | None = None
    with open(stream_path, "wb") as out:
        while True:
            chunk = proc.stdout.read(64) if proc.stdout else b""
            if not chunk:
                break
            if t1 is None:
                t1 = time.time()
            out.write(chunk)
            out.flush()
            sys.stdout.buffer.write(chunk)
            sys.stdout.buffer.flush()

    proc.wait()
    t2 = time.time()

    timing = {
        "t0": t0,
        "t1": t1,
        "t2": t2,
        "ttft_s": (t1 - t0) if t1 is not None else None,
        "ttc_s": t2 - t0,
        "exit": proc.returncode,
        "cmd": cmd,
    }
    with open(timing_path, "w") as f:
        json.dump(timing, f, indent=2)
        f.write("\n")

    return proc.returncode


if __name__ == "__main__":
    sys.exit(main())
