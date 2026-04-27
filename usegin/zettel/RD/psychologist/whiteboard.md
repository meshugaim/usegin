# Psychologist's Whiteboard — what cognitive science says about a shared 2nd brain

**Audience.** A developer who is about to start designing this system and needs
the cognitive-psychology constraints and affordances *before* writing schemas
and UIs.

**Frame.** The user's stated intent is to *mimic the associative way the brain
works, and to enhance and leverage and enable it.* That is a real cognitive
target, not a metaphor. Memory, learning and creative thought have measured
properties. If the system fights those properties, it dies. If it leans on
them, it amplifies them. This whiteboard is the constraint set.

---

## TOP — Design implications (the ten things)

Each implication names a cognitive mechanism, the design move it forces, and
the project Principle (`gin/zettel/principles/`) it ties to. Read this
section alone and you can start designing.

### 1. Capture friction is the system-killer. Cut it below the abandonment threshold.

Working memory is tiny (3–5 chunks) and decays in seconds. Any capture
ceremony that adds steps between *thought* and *recorded zettel* burns the
exact resource the thought is occupying — the user either drops the thought or
drops the system. The Fogg behavior model is brutal here: B = Motivation ×
Ability × Prompt, and Ability dominates because motivation is volatile.

**Move.** Capture must be one gesture from wherever the user already is — a
chat slash command, a CLI verb, a single keystroke, an inline `/zet` while
talking to Claude. No "open the app, choose folder, pick tags, hit save". The
zettel can be *reshaped* later (placement, threading, distillation) but the
*recording* moment must cost almost nothing.

→ **Principle 1 (intuitive workflows).** This *is* the principle, expressed
as a hard psychological constraint.

### 2. Retrieval is cued, not searched. Build cues, not a search box.

Human recall is not a query language. It is *spreading activation* (Collins &
Loftus, 1975) over a semantic network — touching one node activates its
neighbors, those activate theirs, and the rope surfaces. The user's "pull a
wire and find the rope" intuition is literally the right model.

Coupled to Tulving's encoding-specificity principle (1973): a cue helps
retrieval *to the extent it overlaps the encoding context.* The cues that
work best are the ones present *when the zettel was written*.

**Move.** When a developer (or Claude) is touching code/files/tickets/people
that were present at the encoding of some zettel, that zettel must surface
*unprompted*. The retrieval surface is the *current working context*, not a
search query. Tags and titles are weak cues compared to: file paths touched,
people mentioned, error messages seen, tickets cited, code symbols around the
authoring moment.

→ **Principle 1.** Also enables Principle 4 — the "fighting" detector
(see #6) only works if frustration zettels can re-surface when the same area
is touched.

### 3. Distillation is consolidation, not organization.

The Zettelkasten move of *writing the note in your own words, in light of its
neighbors* is not filing — it's *elaborative encoding* (Craik & Lockhart,
levels-of-processing; Bradshaw & Anderson, 1982). Restating an idea while
relating it to existing knowledge produces a deeper memory trace than any
amount of rereading. Mueller & Oppenheimer (2014) found verbatim laptop
note-takers learned worse than slower longhand note-takers *because the slow
hand forced reframing.*

**Move.** The system should *invite* and *reward* the distillation pass,
without making it the price of capture. Two phases:
1. **Capture** — cheap, raw, possibly transcribed.
2. **Distill** — surface neighbors next to the raw zettel and prompt:
   "rewrite this in light of these. What is the one atomic claim?"

Distillation may happen later, by a human or by Claude, but the system must
make the *neighbors visible at distillation time* — that is what makes the
encoding elaborative rather than just rewording.

→ **Principles 1 & 3.** Also leans into Principle 2 — distillation
*preserves* the raw original; it does not overwrite.

### 4. Atomic + threaded *is* the right shape. One claim per zettel.

A zettel that bundles three claims cannot be cued by any of them cleanly —
spreading activation needs distinct nodes to spread between. Atomicity is not
neatness; it is *cue surface area*. Threading then provides the edges along
which activation spreads.

**Move.** Lightweight enforcement — a zettel is one paragraph or smaller, one
claim, one mood ("decision", "frustration", "ID", "lesson"). Compound captures
get split during distillation, with the original preserved as the trail
(Principle 2).

→ **Principle 1**, structurally enforces it.

### 5. Don't let capture become offloading-as-amnesia. Use the system to *strengthen* the team's memory, not replace it.

Sparrow et al. (2011, *Science*, the "Google effect") showed that when people
*expect* to be able to look something up, they remember the *location* of the
information instead of the information itself. Storm & Stone showed
offloading frees capacity for new learning — but the offloaded material
itself fades.

This cuts both ways. We *want* offloading for things we shouldn't be paying
to remember (IDs, ticket numbers, "where did we put the staging URL"). We
*don't* want it for the things we want strong: judgment, intuition,
decisions-and-why.

**Move.** Two zettel classes by intent, not by schema:
- **Reference zettels** — IDs, URLs, "what does this command do" — fine to
  fully offload, just make them cheap to surface.
- **Judgment zettels** — decisions, lessons, frustrations, "this approach was
  wrong because…" — these should *re-surface to the writer* at relevant
  moments, so the writer re-encounters their own past thought (testing
  effect, see #7), not just retrieves it dead from a file.

→ **Principle 3.** "Pull Claude into our world" — Claude is the
re-surfacer for the management layer; we don't store our judgment in Claude's
world (the code), we keep it active in ours.

### 6. Tension degrades both retrieval and creative association. Make the system *detect* the fighting state, not add to it.

The Yerkes–Dodson inverted-U is well-replicated: moderate arousal helps
focused tasks, but high arousal *narrows attention* ("tunnel vision"),
*downregulates the hippocampus*, and impairs episodic recall and creative
divergence. Stress hurts exactly the modes the 2nd brain is trying to
augment.

The flip side — Baird et al. (2012), incubation research — shows that
*relaxed mind-wandering* boosts associative creativity by allowing
spreading-activation to roam. The same network the system is trying to
mimic.

**Move.** Two consequences:
- **Do no harm.** A capture/retrieval surface that itself induces friction
  (modal dialogs, mandatory fields, "did you tag this correctly?") *creates*
  the stress state it should be helping the user escape. Every micro-friction
  is a tax on the creative mode.
- **Detect the shift.** Clusters of frustration zettels in an area are a
  measurable signal — surface that signal back to the user. "You have logged
  4 frustrations against the auth pipeline this week. You are fighting it.
  Step back?" That is Principle 4 wired into the data structure.

→ **Principle 4** (this is its operational form) and **Principle 1** (the
system must not be the source of the stress it's meant to reveal).

### 7. Re-surfacing is a learning event. Treat retrieval as practice, not lookup.

The testing effect (Roediger & Karpicke, 2006) is one of the most robust
findings in memory research: *retrieving* information strengthens it more
than rereading does. Spacing those retrievals further compounds the effect.
Bjork's "desirable difficulties" extends this — a small effort at retrieval
is what consolidates.

**Move.** When the system surfaces a past zettel during current work,
that re-encounter is itself an encoding event. Two design implications:
- A re-surface should sometimes be a *prompt* ("you wrote this 3 weeks ago —
  does it still hold?") rather than a passive display. The act of confirming,
  refining, or superseding *is* the consolidation.
- Versioning matters (Principle 2): a refined re-encounter creates a new
  zettel that links back, so the trajectory is preserved and the next
  re-surface has *more* to spread from.

### 8. Open loops want closure. Use the Zeigarnik effect, don't fight it.

The Zeigarnik effect (1927) — unfinished tasks stay active in working memory
and "tug" at attention. Recent meta-analyses temper the strong claim, but the
weaker version is solid: open loops generate cognitive tension that the brain
seeks to resolve.

**Move.** A zettel marked "open question", "unresolved", "decision pending"
should be a *first-class* type, and re-surfacing it should feel like *closing
the loop*, not adding to it. Conversely, the system should be willing to
*hold* open loops on the user's behalf (offloading their tension) so the user
can stop ruminating — which is the *healthy* form of cognitive offloading
(see #5).

### 9. The brain is shared. Design for transactive memory and common ground.

Wegner's transactive memory (1985) and Hutchins' distributed cognition (1995)
describe how teams cognize: each member is partially a memory store *for the
others*, and what holds the team together is the *common ground* about who
knows what. Effi the team is a distributed cognitive system. Claude is now a
member of it.

**Move.** A zettel must carry *who* (human or Claude session ID) and
*context* (what they were doing). Re-surfacing must respect authorship —
"Lihu wrote this 2 weeks ago about your current area" reads very differently
from a context-free fact. This also supports the *cultural* function of the
2nd brain: it's not just memory, it's how the team builds common ground
about how it thinks.

→ **Principle 3.** Pulling Claude *into our world* requires that Claude
participates as a member of the transactive system, not as an oracle outside
it. Claude both writes zettels (its own discoveries) and receives them (our
judgment).

### 10. Abandonment is the default outcome. Design against the known failure modes.

Across the PKM literature and reflective practice writing, the same handful
of failure patterns recur:
- Capture friction past the abandonment threshold (#1).
- Over-engineered taxonomies that demand maintenance (the system becomes a
  job).
- Hoarding without re-encounter (the "downloaded e-books never opened"
  pattern) — the system stores but never resurfaces.
- Loss of presence — the user starts experiencing the world *as input to the
  system* rather than experiencing the world (the therapist who stopped
  taking notes because she was filtering clients through her tagging system).
- The system becomes a parallel *to-do list* with everything that implies.

**Move.**
- Re-surfacing must do disproportionate work — if we capture but don't
  resurface, abandonment is guaranteed.
- Taxonomy must be emergent and lightweight, not pre-imposed.
- The capture surface must *not* be a mode the user enters — it has to be
  embedded in modes they're already in.
- Frustration capture (Principle 4) is a built-in escape valve against
  "another to-do list" framing — this is explicitly *not* a productivity
  tool, it is a thinking tool.

---

## MIDDLE — The science (with citations)

### Spreading activation — how recall actually works

Collins & Loftus (1975) replaced earlier strict-hierarchy semantic-memory
models with an interconnected network of concept nodes linked by weighted,
psychologically meaningful associations. When a node is activated (by
perception, by thought, by a cue), activation spreads to neighbors at a rate
inversely related to their psychological distance, and the level of activation
across the network determines what comes to mind. Semantic priming
experiments are the standard empirical demonstration: hearing "doctor" speeds
recognition of "nurse" before you can consciously will it.

This is the literal mechanism behind "pull a wire and surface the rope." It
also predicts that the *quality* of the rope depends on *how richly
interconnected* the nodes are — which is exactly what Zettelkasten threading
builds. A note with 5 incoming and 5 outgoing links has 10 spreading-activation
neighbors at distance 1; an isolated note has zero, no matter how brilliant its
content.

> *Key reference:* Collins, A.M., & Loftus, E.F. (1975). A spreading-activation
> theory of semantic processing. *Psychological Review*, 82(6), 407–428.

### Encoding-specificity — cues only work if they were there at encoding

Tulving & Thomson (1973) showed that the effectiveness of a retrieval cue
depends on its overlap with the encoding context. Famously, even a *weak*
associate present at encoding outperforms a *strong* associate that was not.
The familiar "studied while drunk, recall while drunk" demonstration is the
extreme form (state-dependent recall); the everyday form is "the smell of the
coffee shop where I had the idea brings the idea back."

For our system, this means the cues that will actually reactivate a zettel
weeks later are the *contextual particulars present when the zettel was
written* — file paths, error messages, the ticket open at the time, the
person being talked to. Tagging schemes, applied later in cold blood, are
weaker cues than the ambient context the system can capture for free.

> *Key reference:* Tulving, E., & Thomson, D.M. (1973). Encoding specificity
> and retrieval processes in episodic memory. *Psychological Review*, 80(5),
> 352–373.

### Levels of processing & elaborative encoding — why distillation works

Craik & Lockhart's levels-of-processing framework (1972) and Bradshaw &
Anderson's (1982) elaborative-encoding work show that information processed
*deeply* — connected to existing knowledge, restated, related to other
material — is retained far better than information processed shallowly
(verbatim copy, simple repetition). The hippocampus binds disparate elements
into integrated traces; elaboration multiplies the binding sites.

Luhmann's Zettelkasten practice operationalizes this without naming it. He
did not copy quotations; he restated, in his own words, into a network of
prior cards. Every permanent note was an act of elaborative encoding by
construction.

Mueller & Oppenheimer (2014, *Psych Sci.*) showed the inverse case directly:
laptop note-takers, who can transcribe verbatim, performed *worse* on
conceptual recall than longhand note-takers, whose slower hand forced
selective reframing. The slowness *was* the encoding.

For our design: a system that lets you append-only-capture is fine for raw,
but the *distillation pass*, where you rewrite the zettel in light of its
threaded neighbors, is where memory consolidation actually happens. The
neighbors must be *visible* during that pass.

> *Key references:* Craik, F.I.M., & Lockhart, R.S. (1972). Levels of
> processing: A framework for memory research. *Journal of Verbal Learning &
> Verbal Behavior*, 11(6), 671–684.
> Bradshaw, G.L., & Anderson, J.R. (1982). Elaborative encoding as an
> explanation of levels of processing. *JVLVB*, 21, 165–174.
> Mueller, P.A., & Oppenheimer, D.M. (2014). The pen is mightier than the
> keyboard. *Psychological Science*, 25(6), 1159–1168.

### Cognitive load — why capture must be cheap

Sweller's cognitive load theory (1988, ongoing) divides working-memory load
into intrinsic (the inherent difficulty of the material), extraneous
(everything imposed by the *presentation* of the material), and germane (the
load that actually builds schemas). Working memory is small; extraneous load
crowds out germane load.

The implication for capture is direct: every UI step, every required field,
every "did you mean…" between the thought and the recorded zettel is
extraneous load *on the very moment the user is trying to think*. They are
either thinking or operating the tool, not both. The Fogg model adds that
even motivated users won't perform a behavior whose ability cost is too high
— motivation is volatile, ability is the lever.

> *Key references:* Sweller, J. (1988). Cognitive load during problem
> solving. *Cognitive Science*, 12, 257–285.
> Fogg, B.J. (2009). A behavior model for persuasive design. *Persuasive '09*.

### Stress, attention narrowing, and the inverted-U

The Yerkes–Dodson law (1908; refined by many since — see Diamond et al.,
2007) describes performance as an inverted-U function of arousal. Past the
peak, attention narrows ("tunneling"), working-memory capacity shrinks, the
hippocampus is downregulated by glucocorticoids, and episodic-memory
retrieval suffers (semantic memory is more stress-resilient). Creative
divergence — which depends on broad attention and freely spreading activation
— is hit hardest.

Conversely, Baird et al. (2012, *Psych Sci.*) showed that letting the mind
wander during incubation periods (especially during *undemanding* tasks)
significantly improves performance on creative-association problems
encountered before the break. The mechanism is exactly spreading activation
operating offline.

For our design: a stressed user is in the worst state to produce or use a
2nd brain. A relaxed user is in the *best* state. So the system has to (a)
not contribute to stress, and (b) detect when the user is in the fighting
state — Principle 4 — and surface that as data.

> *Key references:* Yerkes, R.M., & Dodson, J.D. (1908).
> Diamond, D.M., Campbell, A.M., Park, C.R., Halonen, J., & Zoladz, P.R.
> (2007). The temporal dynamics model of emotional memory processing.
> *Neural Plasticity*, 2007.
> Baird, B., Smallwood, J., Mrazek, M.D., Kam, J.W.Y., Franklin, M.S., &
> Schooler, J.W. (2012). Inspired by distraction: Mind wandering facilitates
> creative incubation. *Psychological Science*, 23(10), 1117–1122.

### Testing effect & desirable difficulties — re-surface as practice

Roediger & Karpicke (2006, *Psych Sci.* and follow-ups) demonstrated that
*retrieving* studied material strengthens long-term retention more than
*rereading* it does — even when the retrieval attempt is unsuccessful, the
effort is consolidating. Bjork's "desirable difficulties" frame (1994; Bjork
& Bjork 2011) generalizes this: making retrieval slightly effortful (by
spacing, varying the cue, interleaving) increases storage strength, which is
what predicts long-term accessibility.

For our design: a re-surfaced zettel is not just a lookup — it is a
*practice trial*. If the system always shows the full zettel passively, that
is rereading and the consolidation benefit is small. If the system surfaces a
*prompt* ("you wrote about this — does it still apply here? confirm /
refine / supersede"), that is retrieval practice on the team's own knowledge.

> *Key references:* Roediger, H.L., & Karpicke, J.D. (2006). Test-enhanced
> learning. *Psychological Science*, 17(3), 249–255.
> Bjork, E.L., & Bjork, R.A. (2011). Making things hard on yourself, but in a
> good way: Creating desirable difficulties to enhance learning.

### Cognitive offloading & transactive memory — the double-edged sword

Sparrow, Liu & Wegner (2011, *Science*) — the "Google effect" paper — showed
that when people expect future access to information, they remember the
*location* better than the *content*. Wegner's earlier transactive memory
work (1985, 1995) had already framed couples and teams as systems that
distribute *who-remembers-what*, so each individual brain is partial but the
*system* is whole. Storm & Stone (2015) added that offloading can be net
*beneficial* — saving an old file frees capacity for new learning — but the
offloaded material itself decays.

For our design: be deliberate about which zettels we *want* to offload (so
heads are freer) and which we want to keep *active* in heads (because the
team's judgment lives there). Reference zettels — offload aggressively.
Judgment zettels — re-encounter regularly so the *human* still owns them; the
system is a backup, not a replacement.

> *Key references:* Sparrow, B., Liu, J., & Wegner, D.M. (2011). Google
> effects on memory. *Science*, 333(6043), 776–778.
> Wegner, D.M. (1995). A computer network model of human transactive memory.
> *Social Cognition*, 13(3), 319–339.

### Distributed cognition — how teams (and team-plus-Claude) actually think

Hutchins' *Cognition in the Wild* (1995) and the broader distributed-cognition
program reframe the unit of cognition: not the individual brain, but a system
of brains, artifacts and procedures coordinating to do mental work. Common
ground (Clark, 1996) — the mutually known ground that lets two people refer,
predict, and coordinate — is what holds the system together; without it,
every interaction has to renegotiate from zero.

For our design: the 2nd brain is *the artifact* that constitutes the team's
distributed cognitive system. Authorship and context are not metadata, they
are the substrate of common ground. When Claude reads a zettel, Claude is
joining the distributed system as a member, not consulting a database.

> *Key references:* Hutchins, E. (1995). *Cognition in the Wild*. MIT Press.
> Clark, H.H. (1996). *Using Language*. Cambridge University Press.

### Why people quit (the negative case)

The PKM-abandonment literature (much of it reflective rather than
experimental) converges on a small handful of failure modes:
1. **Setup tax** — the system demands more curation than it returns.
2. **Hoarding without retrieval** — zettels go in, nothing surfaces, the user
   loses faith that the investment pays back.
3. **Mode-switching cost** — capture requires entering a separate app/mode,
   which loses the thought.
4. **Loss of presence** — the user starts experiencing life as *input to the
   system*, which is alienating; they quit to return to being present.
5. **It becomes another to-do list** — the system accrues unread items, guilt
   accumulates, abandonment follows.

The cognitive frame on all of these is the same: capture is cheap to
*intend* and expensive to *do*; retrieval is the only thing that justifies the
cost; presence is the resource being protected. Any design that doesn't
protect presence and doesn't pay back through retrieval will be abandoned,
no matter how elegant.

> *Key references:* Otherlife, "Personal Knowledge Management Is Bullshit"
> (and similar reflective writing across the PKM space — these are not peer
> reviewed but they describe the abandonment pattern consistently).
> Theme also appears in Andy Matuschak's notes on evergreen-note systems
> and the friction of "writing inbox" maintenance.

---

## BOTTOM — Sources

### Primary sources

- Collins, A.M., & Loftus, E.F. (1975). A spreading-activation theory of
  semantic processing. *Psychological Review*, 82(6), 407–428.
  https://www.semanticscholar.org/paper/A-spreading-activation-theory-of-semantic-Collins-Loftus/61374d14a581b03af7e4fe0342a722ea94911490
- Tulving, E., & Thomson, D.M. (1973). Encoding specificity and retrieval
  processes in episodic memory. *Psychological Review*, 80(5), 352–373.
  https://en.wikipedia.org/wiki/Encoding_specificity_principle
- Craik, F.I.M., & Lockhart, R.S. (1972). Levels of processing: A framework
  for memory research. *Journal of Verbal Learning and Verbal Behavior*, 11(6),
  671–684.
- Bradshaw, G.L., & Anderson, J.R. (1982). Elaborative encoding as an
  explanation of levels of processing. *JVLVB*, 21(2), 165–174.
  https://act-r.psy.cmu.edu/wordpress/wp-content/uploads/2012/12/154JVLVB82.BradshawJRA.pdf
- Mueller, P.A., & Oppenheimer, D.M. (2014). The pen is mightier than the
  keyboard: Advantages of longhand over laptop note taking. *Psychological
  Science*, 25(6), 1159–1168.
  https://journals.sagepub.com/doi/abs/10.1177/0956797614524581
- Sweller, J. (1988). Cognitive load during problem solving: Effects on
  learning. *Cognitive Science*, 12(2), 257–285.
- Roediger, H.L., & Karpicke, J.D. (2006). Test-enhanced learning: Taking
  memory tests improves long-term retention. *Psychological Science*, 17(3),
  249–255. https://pubmed.ncbi.nlm.nih.gov/16507066/
- Bjork, E.L., & Bjork, R.A. (2011). Making things hard on yourself, but in a
  good way: Creating desirable difficulties to enhance learning.
  https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf
- Sparrow, B., Liu, J., & Wegner, D.M. (2011). Google effects on memory:
  Cognitive consequences of having information at our fingertips. *Science*,
  333(6043), 776–778. https://pubmed.ncbi.nlm.nih.gov/21764755/
- Wegner, D.M. (1995). A computer network model of human transactive memory.
  *Social Cognition*, 13(3), 319–339.
- Diamond, D.M., Campbell, A.M., Park, C.R., Halonen, J., & Zoladz, P.R.
  (2007). The temporal dynamics model of emotional memory processing: a
  synthesis on the neurobiological basis of stress-induced amnesia, flashbulb
  and traumatic memories, and the Yerkes-Dodson law.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC1906714/
- Baird, B., Smallwood, J., Mrazek, M.D., Kam, J.W.Y., Franklin, M.S., &
  Schooler, J.W. (2012). Inspired by distraction: Mind wandering facilitates
  creative incubation. *Psychological Science*, 23(10), 1117–1122.
  https://journals.sagepub.com/doi/abs/10.1177/0956797612446024
- Zeigarnik, B. (1927). On finished and unfinished tasks. (See modern review:
  https://pubmed.ncbi.nlm.nih.gov/32291585/)
- Hutchins, E. (1995). *Cognition in the Wild*. MIT Press.
  https://arl.human.cornell.edu/linked%20docs/Hutchins_Distributed_Cognition.pdf
- Clark, H.H. (1996). *Using Language*. Cambridge University Press.
- Fogg, B.J. (2009). A behavior model for persuasive design. *Persuasive '09*.
  https://www.behaviormodel.org/

### Practitioner sources

- Ahrens, S. *How to Take Smart Notes* — the canonical English-language
  treatment of Luhmann's Zettelkasten with explicit links to the cognitive
  literature on elaborative encoding.
- Matuschak, A. *Evergreen Notes* and *Notes on Note-Taking* —
  https://notes.andymatuschak.org/Evergreen_notes
- Zettelkasten.de introduction — https://zettelkasten.de/introduction/
- Reflective PKM-abandonment writing — Otherlife "Personal Knowledge
  Management Is Bullshit"; Elizabeth Butler "The Problem with PKM";
  Carlos Perez "Forgetting is Not a Bug"; etc. Useful as failure-mode
  catalogue, not as evidence.

### Quotes worth keeping

> "If you cannot restate the idea in your own words, you do not understand it
> well enough — which is valuable diagnostic information."
> — paraphrasing the Zettelkasten/Ahrens distillation principle.

> "Working memory narrows, attentional tunneling crowds out relevant cues,
> motor control deteriorates, and the stress response begins to actively
> impair the very behavior the stress is supposed to produce."
> — on the downward leg of the Yerkes-Dodson curve (modern restatement).

> "Tests enhance later retention more than additional study of the material,
> even when tests are given without feedback."
> — Roediger & Karpicke (2006).

> "When people expect to have future access to information, they have lower
> rates of recall of the information itself and enhanced recall instead for
> where to access it."
> — Sparrow, Liu & Wegner (2011).

---

## A note to the developer reader

The single most important thing on this page: **the system you are about to
design has to obey the brain it is augmenting.** That brain is small in
working memory, fast at spreading activation, easy to stress, and lazy in the
healthiest possible way — it offloads ruthlessly to anything that earns its
trust by paying back through cued resurfacing.

If you only optimize for capture, you'll get a hoard. If you only optimize
for retrieval, there'll be nothing to retrieve. The system lives or dies on
the *loop*: cheap capture → distillation in light of neighbors → cued
re-surface during related work → confirm/refine/supersede → richer
network for next time. Every one of the ten implications above is a
consequence of that loop being either honored or violated.

Stay relaxed. Build something the team's brain reaches for.
