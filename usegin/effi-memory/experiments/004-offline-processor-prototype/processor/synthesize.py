"""Stage 3 — synthesize a structured proposal via `effi ask --new --json`.

We use Effi as the synthesis engine because it already has the indexed
content of every cited artifact; the prototype passes only IDs + titles
and lets Effi retrieve bodies as it forms claims.

The model output is a single JSON object the caller parses. Strict-JSON
mode is enforced via explicit prompt instruction; the response is wrapped
in fenced ```json blocks which we strip before json.loads.
"""

from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass

from .filter import AnnotatedItem


PROMPT_TEMPLATE = """You are reconciling a curated team-activity wiki note against \
new artifacts that have arrived after the note's last update. The wiki note \
classifies each tracked person's *cadence* (active / occasional / reduced / \
dormant) with citations.

# CURRENT NOTE

```markdown
{note_text}
```

# WATERMARK

The note was last updated `{watermark}`. The artifacts listed below are \
everything indexed in the project's data corpus after that timestamp.

# NEW ARTIFACTS ({n_items} items)

```json
{items_json}
```

# YOUR TASK

For each tracked person in the note, AND for each new person who appears \
in the new artifacts, propose one of these:

- `no-change` — new-window activity does not shift the person's row in the \
  current-as-of table (cadence, trend, last_email, last_meeting all stand).
- `update` — a specific field needs updating. Specify the field (one of: \
  `activity`, `trend`, `last_email`, `last_meeting`) and the new value.
- `new-person` — someone not in the current note appears with enough \
  activity that they should be added.
- `headline-shift` — a meta-change to the "Headline shifts in the window" \
  section (under the table) is warranted.

Use Effi's retrieval tools to read the full content of any artifact you \
cite. Do NOT make claims about contents you have not retrieved.

## Citation rules (HARD CONSTRAINTS — violations reject the whole proposal)

- Every claim cites at least one artifact ID in one of these shapes:
  - `gmail:<8-hex-chars>` — first 8 chars of the email UUID
  - `fathom:<8-hex-chars>` — first 8 chars of the meeting UUID
  - `drive:<8-hex-chars>` — first 8 chars of the file UUID
- Every cited ID MUST appear either (a) in the NEW ARTIFACTS list above, \
  or (b) already in the current note's body.
- Do NOT invent or paraphrase IDs. If you cannot find a real ID for a \
  claim, you must not make the claim.

## Output format (HARD CONSTRAINT)

Output ONE JSON object inside a single ```json fenced block. No prose \
outside the fence. The object shape:

```
{{
  "proposals": [
    {{
      "person": "<name from note, or 'new: <Name>' for new-person>",
      "kind": "no-change" | "update" | "new-person" | "headline-shift",
      "field": "activity" | "trend" | "last_email" | "last_meeting" | null,
      "current_value": "<verbatim from current note row>" | null,
      "proposed_value": "<new value>" | null,
      "citations": ["gmail:abcdef12", ...],
      "confidence": "high" | "medium" | "low",
      "rationale": "<one sentence — why this proposal, what the evidence shows>"
    }}
  ],
  "headline_shifts": [
    {{
      "kind": "amend" | "new",
      "current": "<verbatim from current note or null>",
      "proposed": "<text>",
      "citations": [...],
      "confidence": "high" | "medium" | "low",
      "rationale": "..."
    }}
  ],
  "summary": "<2-3 sentences on the overall delta>"
}}
```

Confidence rubric:
- `high` — direct evidence in retrieved artifact body, unambiguous.
- `medium` — evidence in title/metadata only, or one inferential step.
- `low` — speculative, weak signal, propose anyway and flag uncertainty.

For each `no-change` proposal, citations may be empty if the absence-of- \
evidence is the evidence (no new artifacts mention the person). Rationale \
should say so explicitly.
"""


@dataclass
class SynthesisResult:
    raw_response: str
    parsed: dict
    session_id: str
    cost_usd: float
    duration_ms: int
    cache_creation_input_tokens: int
    cache_read_input_tokens: int


def build_prompt(
    note_text: str,
    watermark: str,
    annotated: list[AnnotatedItem],
) -> str:
    items_json = json.dumps(
        [
            {
                "id": it.id,
                "id_short": it.id[:8],
                "entity_type": it.entity_type,
                "title": it.title,
                "created_at": it.created_at,
                "matched_names": it.matched_names,
            }
            for it in annotated
        ],
        indent=2,
    )
    return PROMPT_TEMPLATE.format(
        note_text=note_text,
        watermark=watermark,
        n_items=len(annotated),
        items_json=items_json,
    )


_FENCE_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)


def _extract_json(text: str) -> dict:
    m = _FENCE_RE.search(text)
    if not m:
        # tolerate raw JSON without fence
        text_s = text.strip()
        if text_s.startswith("{"):
            return json.loads(text_s)
        raise ValueError(
            "no JSON fence found in model response; first 200 chars:\n"
            + text[:200]
        )
    return json.loads(m.group(1))


def synthesize(
    note_text: str,
    watermark: str,
    annotated: list[AnnotatedItem],
    profile: str = "dogfooding",
) -> SynthesisResult:
    prompt = build_prompt(note_text, watermark, annotated)
    cmd = ["effi", "--profile", profile, "ask", "--new", "--json"]
    proc = subprocess.run(
        cmd,
        input=prompt,
        capture_output=True,
        text=True,
        check=True,
    )
    events = json.loads(proc.stdout)
    content_parts = [e["content"] for e in events if e.get("type") == "content"]
    raw_response = "".join(content_parts)
    result_evt = next((e for e in events if e.get("type") == "result"), {})
    parsed = _extract_json(raw_response)
    return SynthesisResult(
        raw_response=raw_response,
        parsed=parsed,
        session_id=result_evt.get("session_id", ""),
        cost_usd=float(result_evt.get("cost_usd") or 0.0),
        duration_ms=int(result_evt.get("duration_ms") or 0),
        cache_creation_input_tokens=int(
            (result_evt.get("usage") or {}).get("cache_creation_input_tokens") or 0
        ),
        cache_read_input_tokens=int(
            (result_evt.get("usage") or {}).get("cache_read_input_tokens") or 0
        ),
    )
