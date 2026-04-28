# Cage — the latent world of cloned personas

A closed sub-space inside Gin's world. Famous personas — leaders, researchers, philosophers, physicists, mathematicians, investors, AI bots — investigated deeply and cloned as Gin-instantiable personas. **We don't use them yet — we research and create them.** When they're ready, future skills can call on them.

> Status: **open-to-empty** (z003). Created 2026-04-28 by direction from Lihu. Charter only — investigations not yet started.

## Why "cage"

A cage because they live *here*, in usegin's permissive zone, not in the working-roles persona library (`usegin/personas/`). They are *latent* — present, not yet active. A cage holds them in scope while we deepen each one. When one matures, a `usegin/personas/<name>.md` file may be promoted out of the cage as a regular workflow-callable persona.

## How each persona is built

Per Lihu's direction: **each persona = one week of investigation work**, dispatched by Zisser, executed by a sub-Gin. The investigation is *not* a one-page bio — it's depth, including:

- Read primary sources where available (their own writing, speeches, interviews, papers).
- Read about them (biographies, retrospectives, contemporary critiques).
- Identify their *load-bearing patterns of thought* — what makes them *them*.
- Identify their failure modes — where their bias led them wrong.
- Distill into the standard persona shape (`usegin/personas/README.md` file shape) but with depth: not a one-liner soul, but the soul earned.
- Land at `usegin/cage/<slug>/<slug>.md` with optional folder structure (per `usegin/personas/README.md` "earn the folder" rule):
  - `<slug>.md` — the persona file
  - `sources/` — what was read
  - `lab/` — interpretations, investigations, derived patterns
  - `quotes/` — primary-source quotes that anchor the soul

## Charter shape (per investigation)

```
Sub-Gin charter — investigate <persona>

Purpose: clone <persona> into the cage as a deep, callable Gin persona.
Read first: usegin/cage/README.md (this file). usegin/personas/README.md
  (the persona-file shape). usegin/CLAUDE.md (the permissive-zone posture).
Key tasks:
  1. Read 5+ primary sources (their own words).
  2. Read 5+ secondary sources.
  3. Distill load-bearing patterns of thought.
  4. Distill failure modes.
  5. Write `usegin/cage/<slug>/<slug>.md` in the standard persona shape.
  6. Optional: lab/, sources/, quotes/ folders if depth earns them.
End state: a callable cage persona file lands at the path above, of a quality
  Lihu would recognize as "yes, that's <persona>".
Selbständigkeit: full. Skip if a source is gated; note alternatives.
Decision rights: choose the soul, biases, voice. Lihu reviews after, not before.
Stop condition: persona file landed + sources logged.
```

Use the `charter` skill (`.claude/skills/charter/SKILL.md`) when actually dispatching.

## The roster

**Lihu's picks (25):**

Leaders + statesmen:
- Elon Musk
- Steve Jobs
- Donald Trump
- Benjamin Netanyahu
- Yitzhak Rabin
- Theodor Herzl
- David Ben-Gurion

Tech leaders / AI:
- Ilya Sutskever
- Demis Hassabis
- Sheryl Sandberg *(Lihu: "that woman who works for Facebook" — most likely match)*
- Jensen Huang
- Sundar Pichai

Philosophers:
- Niccolò Machiavelli
- Aristotle
- Plato
- David Hume
- William of Ockham *(Lihu add, 2026-04-28; razor: pluralitas non est ponenda sine necessitate — entities not multiplied without necessity)*

Physicists:
- James Clerk Maxwell
- Michael Faraday
- Nikola Tesla
- Albert Einstein

Mathematicians:
- David Hilbert

Investors:
- Benjamin Graham
- Warren Buffett
- Peter Lynch

Other:
- Adiel Rozenfeld

**Zisser's additions (35) — counted, doubled creatively:**

Leaders + statesmen:
- Lee Kuan Yew (Singapore — institution-builder)
- Angela Merkel (long-game stewardship)
- Sam Altman (AGI-era operator)
- Satya Nadella (cultural turnaround)
- Patrick Collison (Stripe)
- Moshe Dayan
- Golda Meir
- Shimon Peres

Physicists + scientists:
- Richard Feynman
- Marie Curie
- Niels Bohr
- Paul Dirac
- Emmy Noether
- Erwin Schrödinger

Mathematicians:
- John von Neumann
- Alan Turing
- Kurt Gödel
- Henri Poincaré

Philosophers:
- Baruch Spinoza
- Ludwig Wittgenstein
- Immanuel Kant
- Friedrich Nietzsche
- Confucius
- Maimonides (Rambam)

Investors / strategists:
- Charlie Munger
- George Soros
- Stanley Druckenmiller

AI / CS researchers:
- Geoffrey Hinton
- Yann LeCun
- Yoshua Bengio
- Andrej Karpathy

Bots (meta-personas — clone the model itself as a persona):
- Claude (Anthropic — meta-persona of self)
- GPT-4 / GPT-4o (OpenAI)
- Gemini (Google)
- Cursor agent
- Devin

**Lihu's later additions (Jewish sages):**
- The Rambam (Maimonides) — already listed above
- Rabbi Yehuda Halevi (HaKuzari)
- Baal HaSulam (Rabbi Yehuda Ashlag)
- The Ari (Rabbi Isaac Luria)

**Zisser's Tannaim & Amoraim picks:**
- Hillel (the elder; foundational)
- Rabbi Akiva
- Rabbi Shimon bar Yochai (Rashbi — Zohar attribution)
- Rabbi Yehuda HaNasi (redactor of the Mishna)
- Rava (Babylonian Amora)
- Rabbi Yochanan (Land-of-Israel Amora)

**Special-ops + collective personas (Lihu's later additions):**
- The Beast *(to be defined — Lihu's term)*
- Team A *(to be defined — Lihu's term, possibly the A-Team archetype)*
- Sayeret Matkal (IDF special operations — the institution as a persona)
- SAS (UK special operations — the institution as a persona)

**Spiritual + gurus (Lihu's later additions, Zisser-extended):**
- The Dalai Lama (current — Tenzin Gyatso)
- Ramana Maharshi
- Jiddu Krishnamurti
- Thich Nhat Hanh
- Eckhart Tolle
- Adi Shankara
- Patanjali (yoga sutras)
- Lao Tzu
- Rumi
- *(more — open-to-empty for additions)*

**Physicists, chemists, alchemists (later expansion — Lihu):**
- *(physicists already listed above; expand)*
- Chemists: Antoine Lavoisier, Dmitri Mendeleev, Marie Curie *(also listed)*, Linus Pauling
- Alchemists: Jabir ibn Hayyan, Paracelsus, Isaac Newton-as-alchemist *(distinct persona from Newton-as-physicist)*, Hermes Trismegistus *(legendary)*
- *(more — open-to-empty)*

## Diversity axes (Lihu's framing)

The cage should span temperaments, not collect "great men" homogeneously. Lihu named:

- **violent ones** ↔ **calm ones** (e.g. Trump / Tesla-the-volatile vs Dalai Lama / Buffett)
- **smart ones** (axis: depth-of-thought)
- **"locked" ones** ↔ **"open-minded" ones** (rigid clarity vs porous receptivity)
- **straight thinkers** ↔ **curved thinkers** (linear-logical vs lateral-associative)
- **stable thinkers** ↔ **"crazy" thinkers** (predictable vs surprising)

When picking the next investigation batch, sample across axes. A roster heavy on one corner produces a herd that can only think one way.

**Total roster: 60+ Lihu/Zisser-named so far, expanding.** Lihu picks which to investigate first; the rest queue.

## Investigation order (open-to-empty)

To be filled when Lihu picks the first batch. Suggested first six (open to override):

1. _(open-to-empty)_
2. _(open-to-empty)_
3. _(open-to-empty)_
4. _(open-to-empty)_
5. _(open-to-empty)_
6. _(open-to-empty)_

## Tracking

Each persona's investigation lifecycle:

| State | Marker |
|---|---|
| Queued | listed above, no folder yet |
| In flight | `usegin/cage/<slug>/` exists, sub-Gin running |
| Drafted | `usegin/cage/<slug>/<slug>.md` exists, `sources/` listed |
| Reviewed | Lihu read it, signed off (commit message tagged `cage(review)`) |
| Promoted | moved or copied to `usegin/personas/<slug>.md` for active use |

## What the cage is NOT

- Not a hagiography. Failure modes are part of the persona; we want the *whole* shape.
- Not a workflow library yet. Cage personas are latent until promoted.
- Not a closed set. Lihu can add; Zisser can suggest.
- Not subject to "must agree with everything they said." We capture the pattern of thought, not endorse it. Trump-the-persona and Plato-the-persona both live here without endorsement.

## Cross-references

- `../personas/README.md` — the standard persona file shape
- `../personas/creative/README.md` — the Creative subclass (archetypes — Sage, Hunter, etc.). Some cage personas may map onto creative archetypes (e.g. Spinoza ≈ Sage; Musk ≈ Hunter+Builder), but the cage is its own register — *named* historical personas, not archetypal moods.
- `../../zisser/agents.md` — Zisser orchestrates the investigations
- `.claude/skills/charter/SKILL.md` — charter shape for dispatch
- `.claude/skills/rnd/SKILL.md` — R&D shape (parallel investigations) when batches are dispatched
