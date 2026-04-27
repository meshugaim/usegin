# consult — Skill Lab

## Intent

Make fresh-eyes consultation a repeatable lateral move — different shape from the parallel-team skills (rnd / brainstorm / refine / prioritize). Consult is single-agent, depth-driven, opinionated. Per z025 — external in role, internal in team.

The skill exists because we already have a persistent consultant (`usegin/consultant/`) but no formal lifecycle for "I want a fresh-eyes pass on this specific thing." Consultations happened ad-hoc; the skill captures the shape so future consultations inherit the lessons (charter discipline, deliverable shape, reply discipline).

The skill sits *laterally* — reachable from any phase of the pipeline. After R&D and not sure if you got the angles right? Consult. Before spec and want a sanity check on the prioritize output? Consult. Mid-implementation and something feels off? Consult.

Success means: consultations run end-to-end (frame → charter → spawn → memo → reply → bring back) without re-deriving the lifecycle, with memos that name a click in ≤1 paragraph rather than performing thoroughness, and with replies that close the loop so the consultation contributes to the corpus.

## Success Signals

When retroing a session that used this skill:

### Mode selection
- [ ] Mode A (persistent) used when the question was open-ended or in a domain the persistent consultant has touched
- [ ] Mode B (one-shot) used when the question was narrow and self-contained
- [ ] Mode confusion absent (Mode A writes to `usegin/consultant/`, Mode B to `<topic-root>/consult/`)

### Framing
- [ ] question.md exists, ≤10 lines
- [ ] Read-first list named (2–5 files / zettels)
- [ ] Explicit "what I want from you" statement (not just open-ended "tell me what you think")

### Charter
- [ ] Charter encoded the external-in-role, internal-in-team stance
- [ ] Charter permitted the consultant to push back on the framing itself
- [ ] Charter included the friction-capture pointer (`dx zettel add --as=consultant`)
- [ ] Charter set the memo shape (click → evidence → push-back → won't-claim)
- [ ] Charter explicitly forbade performative thoroughness ("don't perform")

### Memo
- [ ] Click landed in ≤1 paragraph at the top
- [ ] Evidence section concrete (file paths, line numbers, zettel ids, quoted snippets — not abstract)
- [ ] Push-back section present (or explicitly declined)
- [ ] Won't-claim section present (consultant honest about scope of assessment)
- [ ] Memo ≤2 pages — laconic, not exhaustive

### Reply
- [ ] reply.md written
- [ ] Accept / push-back / will-do sections present
- [ ] Pushback honored if the consultant reframed the question (not dismissed)
- [ ] Concrete actions named (idea-ids in ideas.md, new pipeline rounds, etc.)

### Friction capture
- [ ] Frictions captured as `--as=consultant` zettels
- [ ] If charter ambiguity hit, named live (not retrofitted)

### Hand-off
- [ ] Closing zettel naming the consultation + outcome (accept / pushback / reframe)
- [ ] If consultation triggered a new pipeline round, named explicitly

### Multi-consultant variant (if used)
- [ ] 2-3 consultants spawned with the same charter (not aggregated algorithmically)
- [ ] Convergence and divergence read by orchestrator, not by Borda
- [ ] Each consultant's memo treated as full read, not a vote

## Known Limitations

- **Mode A vs Mode B distinction is judgment-driven.** No tool tells you which to use. The persistent consultant has more context but his prior may dominate; the one-shot has less context but more independence. Default to one-shot for narrow questions; reach for persistent for open-ended-in-his-domain.

- **Charter ambiguity is the most common failure.** A vague charter produces a vague memo. The skill enforces "what I want from you" as an explicit field but doesn't catch underspecification. Mitigation: spot-check before spawn.

- **Persona drift across sessions.** A new one-shot consultant for question N may have different priors than the one-shot for question N+1. Inconsistency in the consultant role across rounds is real. Mitigation: include "you are an external consultant brought in by the Gin team" verbatim in every charter — anchors the persona.

- **Reply discipline is honor-system.** The skill says write a reply; if the orchestrator skips, the consultation is half-shipped. No mechanical enforcement.

- **Persistent consultant session-id management.** Mode A depends on `usegin/consultant/session-id.txt` being valid. If it expires or the session is unreachable, Mode A fails. Currently no fallback ("session expired? spawn one-shot Mode B with a charter that says 'you are picking up where the persistent consultant left off, here's his last memo'"). Could codify.

- **No multi-consultant aggregation tooling.** When N>1 consultants are spawned, reading their memos manually for convergence/divergence is the only path. For ≥3 consultants this gets unwieldy. Same gap as prioritize across-rounds — closes when retrieval lands.

- **Sub-Gin can't fan out (z029 inherited).** A consultant can't run his own sub-investigation via the Agent tool. He can use Bash, Read, Grep, but not delegate. For complex questions where the consultant needs to fan out (e.g. "audit all our skills"), the orchestrator pre-decomposes (R&D shape) — defeating the lateral simplicity of consult. Open question.

- **Friction-capture is honor-system.**

## Retro Guide

When `skill-retro` triggers a retro for `consult`:

**1. Check mode appropriateness**
Was Mode A used for a narrow question, or Mode B for an open-ended one? Mismatch = signal.

**2. Check framing tightness**
Was question.md ≤10 lines with explicit "what I want from you"? Or was it a wall of context the consultant had to mine? Wall = signal that the orchestrator didn't do the framing work.

**3. Check the click**
Sample the memo. Was the click in the first paragraph, ≤1 paragraph, naming a single most-load-bearing finding? Or was it a "five things I noticed" list? List-shape = consultant performed instead of converged.

**4. Check evidence concreteness**
Did the evidence section name file paths / line numbers / zettel ids? Or was it abstract claims? Abstract = consultant didn't read the read-first list, or read but didn't anchor.

**5. Check push-back**
Did the consultant push back on framing? If not, was that because the framing was solid, or because the charter discouraged pushback? Read the charter to find out.

**6. Check the reply**
Was reply.md written? Accept / push-back / will-do sections? Concrete actions? Or was the memo just left to die?

**7. Check the closing**
Closing zettel + outcome named? If consultation triggered a new round, was it named?

## Retros

| Date | Round | What happened | What the round taught us |
|---|---|---|---|
| *(pending)* | | | |

## Ideas / Notes

- **Consult-after-prioritize default.** As a pipeline default, run a consult between prioritize and spec. Cheap insurance — the consultant either validates the top-K (zero cost, modest signal) or flags a flaw (high value). Worth trying as auto-step.

- **Multi-consultant convergence as signal.** Spawn 3 one-shots with the same charter; if they all flag the same click independently, that's high-confidence. If they diverge wildly, the question itself is open. Both are signal.

- **Cross-mode consult.** Use Mode A (persistent) and Mode B (one-shot) on the same question, compare. The persistent consultant's prior contributes one read; the fresh-eyes contributes another. Synthesizing across modes is a meta-move worth trying once.

- **Consult-on-consultations.** Meta: spawn a consultant whose charter is "review the last N consultations and tell me what we're systematically missing." Recursive but bounded.

- **Persistent consultant continuity protocol.** If the persistent consultant's session expires, we have no formal recovery. Codify: "if Mode A session is unreachable, spawn a Mode B with charter 'pick up where the persistent consultant left off, his last memo is at usegin/consultant/findings/...'" — and update session-id.txt to the new one.

- **Charter library.** A small set of recurring consultant charters (architecture review, DX audit, friction-cluster review) that can be parameterized and reused. Risk: institutionalization (z023 says spawn-as-instantiation is one-shot; static charters erode it).

- **Consult in the implement phase.** Currently positioned pre-spec. But mid-implement is also a natural fit — when something feels off and you want fresh eyes before going deeper. Try.

- **Reply-as-zettel.** When a consult reply produces a durable claim (an accepted insight or a justified pushback), the reply itself is zettel-shaped. Capture as `--as=usegin` zettel with thread to the consultation.

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-04-27 | Skill created. Lab seeded. The lateral skill in the pipeline (reachable from any phase). Two modes — persistent (z025 pattern, `usegin/consultant/`) and one-shot fresh-eyes. | Lihu / Oria asked for the four team-skills. Consult is the non-team-shaped one — single-agent depth-driven, complementing the parallel-team skills (rnd / brainstorm / refine / prioritize). Z025 provides the philosophical anchor: external in role, internal in team. |
