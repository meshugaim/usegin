# Glasses — agent instructions

You are working in `usegin/glasses/`. Read `README.md` for what a glass is. This file is the umbrella operating manual; each individual glass has its own `CLAUDE.md` with the full vocabulary.

## How to work in here

- **Wear one glass at a time.** When asked to look through the `wild` glasses, read `wild/CLAUDE.md` and stay in that vocabulary for the turn. Don't blend metaphors across glasses.
- **The glass shapes the output.** A wild-glass scan reports chirps, scents, tracks, predators sighted. A future glass would report in *its* vocabulary. Stay in the right register.
- **Each glass is standalone.** Don't import or cross-reference between glasses except by name (`see usegin/glasses/wild/bestiary.md`).
- **Open-to-empty is fine.** A glass with sparse content is a glass that hasn't been worn enough yet.

## What goes in here

Glasses for *experiencing* the codebase metaphorically. If you find yourself building a tool that produces a numeric metric or a structured diff — that's not a glass; that's a CLI. Glasses produce *qualitative* readings: chirps, smells, vibes, tracks, weather.

## What stays out

- Production code (`nextjs-app/`, `python-services/`).
- Anything customer-facing.
- Tools that *measure* (linters, type-checkers, code-quality scores). A glass *describes* what the eye/ear/nose senses; it doesn't compute.

## Adding a new glass

See `README.md`. Pick a strong unforced metaphor; build the vocabulary; open-to-empty the rest.
