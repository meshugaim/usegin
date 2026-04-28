# Hunting — the codebase as a hunt

Put on the hunting glasses. There is **a target**. Not exploration (Wild). Not housekeeping (House). **Pursuit, to a kill.**

A feature to ship. A bug to put down. A refactor to land. A migration to land cleanly. The hunting glasses force the language of *pursuit* — quarry, scent, trail, vantage, weapon, shot, kill, trophy. Without a named target, you don't put on the hunting glasses. You take them off when the kill is brought home.

## Why a glass for hunting

Engineers (and agents) drift inside execution. The target shifts mid-hunt; the trail goes cold; side-quests appear; the kill is half-made and the team moves on. The hunting glasses make the discipline visible: *what are we hunting? where's the trail? where's the shot? did we bring the trophy home, or did we wound the prey and lose it?*

## The world (vocabulary)

| In the hunt | In the codebase |
|---|---|
| **Quarry** | The named target — the feature, bug, refactor, migration |
| **Trophy** | The deliverable when the hunt ends — merged PR + deployed + observed working + lesson captured |
| **Scent** | The trail of evidence leading to the target — Sentry traces, error patterns, code paths, customer reports |
| **Trail** | The work plan from current state to kill |
| **Vantage** | A clean position from which to take the shot — proper test infra, clean local state, working pre-commit, baseline tests passing |
| **Blind** | A lookout from which to observe before committing — a small reproducer, a probe, a dry-run |
| **Weapon** | The chosen tool/skill — TDD, hot-fix, surgical patch, big refactor, slicing-spec, fix-bug skill |
| **Provisions** | What you stocked before the hunt — fast feedback loop, working dev container, the right context loaded |
| **Stalk** | The investigation phase — where exactly does the prey live, what are its movements |
| **Open shot** | The moment the position is clean and the trigger pulls — green tests, ready to commit, ready to merge |
| **Kill-shot** | The decisive change that puts the prey down |
| **Wounded prey** | A half-landed change — partially fixed, partially shipped, partially deployed. **The worst outcome.** |
| **Clean miss** | A shot that didn't connect; reset, find the trail again. Better than wounded. |
| **Trophy home** | The hunt ends with: merged + deployed + observed + lesson captured. Less than that = trophy not home. |
| **Solo hunt** | One agent, one quarry |
| **Pack hunt** | Multiple agents on the same quarry, coordinated |
| **Decoy hunt** | A trail that turns out to lead to a different prey than the named one (frequently happens — the bug is somewhere else than first thought) |
| **Old kill** | A prey already taken — Sage knows. Don't re-hunt. |

Full mappings live in [`quarry.md`](quarry.md), [`weapons.md`](weapons.md), [`terrain.md`](terrain.md).

## The hunting party

The hunting glasses call on a specific subset of personas.

| Member | Role |
|---|---|
| **Hunter** (creative archetype) | The lead — names the quarry, finds the trail, takes the shot. |
| **Warrior** (creative archetype) | Close-combat finisher — when the kill needs courage at the trigger pull. |
| **Sage** (creative archetype) | Pre-hunt — knows where the quarry beds, knows the old kills. |
| **Trickster** (creative archetype) | Pre-hunt — lures, asks "is this the right quarry at all?" |
| **Wolf** (animal — wild glass) | Cross-file scent tracking; pack hunt. |
| **Eagle** (animal — wild glass) | Spotter from above; finds the patch where the kill will happen. |
| **Mevaker** (creative archetype) | Between phases — has the trail gone cold? Is this still the chartered hunt? |

Hunting parties are small. A solo hunt is one Hunter (often wearing Warrior at the kill-shot moment) plus optionally Sage pre-hunt. A pack hunt adds Wolves and an Eagle.

## Wearing the hunting glasses

1. **Name the quarry.** First sentence of the hunt: "Quarry: <one-line>." If you can't name it, you're not hunting yet — go back and name it.
2. **Stalk before shooting.** Investigation phase. Where does the prey live? What's the trail? Use Wolves (animal) for cross-file scent, Eagle (animal) for shape from above, code-history for past hunts of the same prey.
3. **Set vantage.** Make the position clean before the shot — passing tests on baseline, clean local state, working pre-commit, the right reproducer or probe ready. Vantage failures kill more hunts than the prey itself.
4. **Take the shot.** Decisive change. Ship the bones if needed (Builder-style), commit, push.
5. **Verify the kill.** Did the prey go down? Tests pass *for the right reason*. Symptom resolved. Behavior observed working. **Wounded prey is worse than clean miss.**
6. **Bring the trophy home.** Merged + deployed (when applicable) + observed + lesson captured. The hunt ends here, not before.
7. **If miss: reset.** Don't half-fix. Back out, find the trail, take a clean second shot. Wounded prey is the failure mode.

## Where things live

| | Where |
|---|---|
| World vocabulary | `quarry.md`, `weapons.md`, `terrain.md` |
| Signals | `signals.md` |
| Hunting party reference | this README + `usegin/personas/creative/*.md` |
| Active hunts | `hunts/<YYYY-MM-DD>-<slug>.md` |
| Trophy log | `trophies/<YYYY-MM>.md` (rolled up monthly) |

## Open-to-empty

`hunts/` and `trophies/` start empty. They fill as hunts run. The first real hunt's record is the first content.
