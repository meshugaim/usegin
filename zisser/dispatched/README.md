# dispatched/

Record of every spawn — charter + outcome. One file per dispatch:
`<YYYY-MM-DD>-<topic>.md`.

The charter file is the SOT for what was asked. It's pasted (or a derivative)
into the `Agent` tool's prompt; the agent's return goes back into the same
file as a follow-up.

## Shape

See `agents.md` (`zisser/agents.md`) for the full charter shape. Short form:

```markdown
# Charter — <topic>

## Goal
## Background
## Constraints
## Deliverable
## Stop condition

## Dispatched
- when: ...
- to: ...
- expected back: ...

## Returned
- when: ...
- summary: ...
- next: closed / re-dispatched / waiting on Lihu
```

## archive/

When a dispatch has been closed and ignored for several pours (per principle
4 — "don't loop forever"), move it to `archive/`. Lihu can recover it via
search; it's not on the active surface.

(Open-to-empty per z003.)
