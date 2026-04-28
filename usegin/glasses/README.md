# Glasses

Different ways of *seeing* the codebase.

A "glass" is a metaphorical lens you put on. The codebase doesn't change; what you *notice* about it does. Each glass has its own vocabulary, its own signals, its own things to flag and things to ignore. You wear one glass at a time, intentionally — to feel a thing about the codebase you wouldn't feel by reading raw files.

## Why glasses

Source code is too dense to feel directly. The eye glazes over. We rely on tooling — linters, type-checkers, tests — but those answer narrow yes/no questions. The wider questions ("does this area feel healthy?", "where is the danger?", "what smells off?") need a different shape. That's what a glass is.

Each glass is **autonomous and standalone**: its own vocabulary, its own personas, its own signals, its own scan reports. Glasses don't import each other. They can clone patterns; they don't share state.

## Current glasses

| Glass | What you see when you wear it |
|---|---|
| [`wild/`](wild/) | The codebase as a jungle. Sounds, smells, water, food, predators, weather. Animals (the herd) live in patches and report what they hear. |

More glasses can be added. Each is a sub-directory under `usegin/glasses/`, built like its own repo (per `usegin/CLAUDE.md` standalone-sub-app rule).

## How to add a glass

1. Pick a metaphor strong enough that things in the codebase map to things in the metaphor *unforced*. If you have to push the analogy, drop it.
2. Create `usegin/glasses/<name>/`.
3. Add `README.md` (the world) and `CLAUDE.md` (the agent operating manual).
4. Define the vocabulary, the actors (personas), the signals, the trigger shapes.
5. Open-to-empty everything else (z003) — let the glass accumulate as it gets worn.

## Wearing a glass

Tell Zisser (or any agent): "look at X through the wild glasses". The agent reads the glass's `CLAUDE.md` and operates from inside that vocabulary for the turn. Take the glasses off when the turn ends — different glasses don't blend.
