"""Run the offline-processor prototype against a single wiki note.

Default target: usegin/effi-memory/askeffi-app-really/notes/activity.md
Override via --note <path>.

Output: runs/<timestamp>/{proposal.json, proposal.md, report.md} and, if
verification fails, rejected.md alongside proposal.md.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from processor.fetch import fetch
from processor.filter import annotate, extract_tracked_names
from processor.render import render
from processor.synthesize import synthesize
from processor.verify import verify


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_NOTE = (
    SCRIPT_DIR.parent.parent / "askeffi-app-really" / "notes" / "activity.md"
).resolve()


def _utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def _to_dict(obj):
    if dataclasses.is_dataclass(obj):
        return dataclasses.asdict(obj)
    return obj


def main() -> int:
    parser = argparse.ArgumentParser(description="Run exp 004 offline-processor prototype")
    parser.add_argument("--note", type=Path, default=DEFAULT_NOTE,
                        help="Path to the wiki note (default: notes/activity.md)")
    parser.add_argument("--profile", default="dogfooding",
                        help="effi profile (default: dogfooding)")
    args = parser.parse_args()

    if not args.note.exists():
        print(f"error: note not found: {args.note}", file=sys.stderr)
        return 2

    stamp = _utc_stamp()
    run_dir = SCRIPT_DIR / "runs" / stamp
    run_dir.mkdir(parents=True, exist_ok=True)

    print(f"[run] target: {args.note}")
    print(f"[run] output: {run_dir}")

    t0 = time.monotonic()

    # ------------------------------------------------------------------ stage 1
    print("[stage 1] fetch — read note + project-delta")
    f = fetch(args.note)
    (run_dir / "delta.json").write_text(json.dumps(f.delta, indent=2))
    print(f"  watermark: {f.watermark}")
    print(f"  total_new: {f.delta.get('total_new')}")

    # ------------------------------------------------------------------ stage 2
    print("[stage 2] filter — annotate items with tracked-name matches")
    names = extract_tracked_names(f.note_text)
    annotated = annotate(f.delta, names)
    matched_count = sum(1 for it in annotated if it.matched_names)
    print(f"  tracked names: {len(names)}")
    print(f"  items annotated: {len(annotated)} ({matched_count} title-matched)")
    (run_dir / "annotated.json").write_text(
        json.dumps([dataclasses.asdict(it) for it in annotated], indent=2)
    )

    # ------------------------------------------------------------------ stage 3
    print("[stage 3] synthesize — effi ask --new --json")
    if not annotated:
        print("  no new items — emitting empty proposal and exiting")
        (run_dir / "proposal.json").write_text(json.dumps({
            "proposals": [],
            "headline_shifts": [],
            "summary": "No new artifacts since watermark; no proposal generated.",
        }, indent=2))
        (run_dir / "proposal.md").write_text(
            "# Proposal — `notes/activity.md`\n\nNo new artifacts since watermark; no proposal generated.\n"
        )
        (run_dir / "report.md").write_text(_report_md(
            note_path=args.note, watermark=f.watermark, annotated=annotated,
            synthesis=None, verify_report=None, runtime_s=time.monotonic() - t0,
        ))
        return 0

    synth = synthesize(f.note_text, f.watermark, annotated, profile=args.profile)
    (run_dir / "proposal.json").write_text(json.dumps(synth.parsed, indent=2))
    (run_dir / "raw_response.md").write_text(synth.raw_response)
    print(f"  effi session_id: {synth.session_id}")
    print(f"  cost_usd: ${synth.cost_usd:.4f}")
    print(f"  duration_ms: {synth.duration_ms}")
    n_props = len(synth.parsed.get("proposals", []) or [])
    n_hs = len(synth.parsed.get("headline_shifts", []) or [])
    print(f"  proposals: {n_props}, headline_shifts: {n_hs}")

    # ------------------------------------------------------------------ stage 4
    print("[stage 4] render — proposal.md")
    proposal_md = render(synth.parsed, f.watermark, len(annotated))
    (run_dir / "proposal.md").write_text(proposal_md)

    # ------------------------------------------------------------------ stage 5
    print("[stage 5] verify — citation resolution")
    vr = verify(synth.parsed, f.delta, f.note_text)
    print(f"  citations: {len(vr.all_citations)} total, {len(vr.failures)} unresolved")
    if vr.rejected:
        rej = ["# Proposal REJECTED — unresolved citations\n"]
        rej.append(f"{len(vr.failures)} citation(s) did not resolve to either a delta item or the current note:\n")
        for cite in vr.failures:
            rej.append(f"- `{cite.kind}:{cite.short_id}` — not in delta, not in note")
        rej.append("\nSee `proposal.md` for the model's full proposal (advisory only).")
        (run_dir / "rejected.md").write_text("\n".join(rej) + "\n")
        print("  ❌ REJECTED — see rejected.md")
    else:
        print("  ✅ all citations resolved")

    runtime_s = time.monotonic() - t0

    # ------------------------------------------------------------------ report
    (run_dir / "report.md").write_text(_report_md(
        note_path=args.note, watermark=f.watermark, annotated=annotated,
        synthesis=synth, verify_report=vr, runtime_s=runtime_s,
    ))
    print(f"[done] {runtime_s:.1f}s — {run_dir}")
    return 0


def _report_md(*, note_path, watermark, annotated, synthesis, verify_report, runtime_s) -> str:
    lines: list[str] = []
    lines.append(f"# Run report — exp 004\n")
    lines.append(f"- note: `{note_path}`")
    lines.append(f"- watermark: `{watermark}`")
    lines.append(f"- runtime: **{runtime_s:.1f}s**")
    lines.append(f"- new artifacts: **{len(annotated)}**")
    if synthesis is not None:
        lines.append(f"- effi session_id: `{synthesis.session_id}`")
        lines.append(f"- cost: **${synthesis.cost_usd:.4f}**")
        lines.append(
            f"- tokens — cache_creation: {synthesis.cache_creation_input_tokens}, "
            f"cache_read: {synthesis.cache_read_input_tokens}"
        )
        n_props = len(synthesis.parsed.get("proposals", []) or [])
        n_hs = len(synthesis.parsed.get("headline_shifts", []) or [])
        lines.append(f"- proposals: {n_props}")
        lines.append(f"- headline_shifts: {n_hs}")
    if verify_report is not None:
        lines.append(f"- citations: {len(verify_report.all_citations)} total, "
                     f"{len(verify_report.failures)} unresolved")
        lines.append(f"- verification: **{'REJECTED' if verify_report.rejected else 'PASS'}**")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    sys.exit(main())
