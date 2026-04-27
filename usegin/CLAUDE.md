# UseGin — agent instructions for the umbrella

You are working inside `usegin/` — the permissive zone. Read `Gin.md` for the
philosophy in full. The short form:

- **Process over outcome.** The session is the unit of study, not the diff.
- **Unlimited resources, your best every turn** (z027). No "save tokens", no
  "skip verification".
- **Laconic** (z032 / z036). Investigate without limit, output the click.

## Sub-apps are standalone

Each sub-app under `usegin/` is built like its own repo. They sit side-by-side
in this monorepo but they are **independent**:

- Each has its own `README.md` and `CLAUDE.md`.
- Each owns its own conventions, structure, and growing artifacts.
- They **do not import each other**. They may **clone** patterns (copy a file,
  adapt it locally) — that's the point. Cross-link by reference (`see
  usegin/zettel/zettels/zXXX`), never by relative-path imports.
- When you walk into one of them, work as if it's its own repo. The sub-app's
  `CLAUDE.md` is the operating manual; this umbrella file is just the spirit.

Current sub-apps:

| Sub-app | What it is |
|---|---|
| `zettel/` | The team's shared 2nd brain. Atomic, threaded notes. ENG-5379. |
| `consultant/` | External-consultant-instantiated Gin. Friction & solutions. |
| `translators/` | Cross-domain term maps (physics→dev, etc.). |
| `wispr-flow-corrector/` | Word-level dictionary for Wispr Flow mishearings. |
| `research/` | Cross-cutting investigations that don't belong to one sub-app. |

The agent **Zisser** lives at `/zisser/` (repo root, peer to `usegin/`). Zisser
is Lihu's chief-of-staff for his whole life; UseGin is the dev agent. They are
peers and call each other.

## Conventions in usegin/ (apply everywhere here)

- **Open-to-empty** (z003): create the address before you have the content.
- **Find or make a comfortable place** (z037): placement-friction is yours to
  dissolve. Same turn, never "later" (z002).
- **Two faces when suitable** (z022): human-facing and Gin-facing where both
  consume the artifact.
- **Pre-game manual** (z015): only systematize what we've done by hand once.
- **Decision shape** (z020): emit "decided X because Y; price Z; risk W;
  alternatives rejected …" without being asked.
- **Not Linear-everything** (z024): UseGin's own work uses lighter,
  code-adjacent forms. Linear is for shipped product.

## What stays out of usegin/

- Production code (`nextjs-app/`, `python-services/`).
- Anything that affects customers, deploys, billing, or other people's envs.
- Secrets.

Everything else: green light.
