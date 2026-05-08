---
date: 2026-05-08
speaker: oria
captured-by: zisser
context: 20-min Aurelius brainstorm (Wispr-dictated) + direct dispatch to Zisser
status: placed → space/app-factory/intake/2026-05-08-copilot-personal-tutor.md
---

# pour — copilot personal tutor (oria, 20-min Aurelius brainstorm + dispatch)

## the raw substance

Oria spent ~20 min with Aurelius (external persona, see his self-defining
text in the brainstorm) distilling a POC pitch. Then handed it to Zisser
with a directive: build it in OCW app-factory, separate from product,
prove to the boss that AI can leverage personalized teaching.

## the goal (oria, his words)

> "We want to prove that it's easy, that we can leverage AI, that we
> can teach persons personally without investigating them."

Prove-to-boss POC. Not a product. The artifact is the demo + the
pipeline-record showing how cheaply it was built.

## the product (compressed from Aurelius transcript)

A platform that sits next to **Copilot in Word** (Oria oscillated Word ↔
Excel; bulk of pour was Word, last sentence of dispatch said Excel —
captured as open question). User brings a real task he's already
working on. No upload. Platform consults + helps + teaches AI literacy
*as a side effect of solving the actual task.*

**Two personas:**
- No-AI: knows Word, zero AI
- Know-AI: knows AI exists, doesn't apply it in workflow

**Onboarding (silent, not interrogation):** five small reveal-questions
+ one slider (open-Qs vs MCQ). Boss provides demographics + familiarity
scores; user provides task-shape and prompt-instinct via smart questions:
- "Describe a document you're working on right now in one sentence"
- "Show me your last AI prompt or write one now"
- "What frustrates you most about your current workflow"
- "If you could ask Word to do one thing smarter, what would it be"
- "If you had to leave the office and hand this task to someone, what
  would you tell them" (Oria's specific addition late in the pour —
  reveals task decomposition + thinking style)

**Core loop:**
1. User's task displayed at top, always visible (anchor).
2. Two AI-ranked priority cards: most relevant capability + skill.
3. Open buffet of remaining lessons, sorted by task-relevance.
4. Lessons compose from four step types:
   - **video** (30–90s, specific)
   - **orientation** (click-tutor showing where in Word)
   - **open question** (single iteration, AI feedback)
   - **multiple-choice** (quick check)
5. After lesson: "Try in your document. What happened?" → free-text
   report → AI compares intent / prompt / output → identifies gap →
   suggests next step.

**Capabilities vs Skills:**
- *Capabilities* = what Copilot can do (find it, draft, summarize, analyze)
- *Skills* = how to use AI (prompting, role-swapping, iterating, breaking
  tasks down)

Oria explicitly flagged both Word **and** Excel mid-pour but the bulk
of substance was Word. Use case for the video he'll provide is in Excel.

## five POC variants Aurelius surfaced

1. Task-first, AI-ranked priority cards + open buffet (default)
2. Conversational diagnostic (chat-tutor opens, asks, recommends)
3. Capability-skill split buffet
4. Prompting-first diagnostic (write a prompt → analyze → route)
5. Lesson composition choice (user picks watch/do/talk/mixed)

Aurelius recommended **Variant 1 + Variant 4** in parallel. Open
question for Mark/architects.

## what oria explicitly committed to provide later

- Video for grounding (a real video Oria has in mind, in Excel
  context — he'll send the link/topic)
- Site password so an agent can find that video (manual browse needed)
- "Stuff" on the go

## what oria explicitly de-scoped

- No upload of user's actual document into our system. "Just consulting
  and resolving."
- No full Word integration for POC — mock or iframe Copilot output.
- Not building "the real product" — just proving the loop.

## key principles (oria's framing)

- **Embedded.** Learning is a byproduct of solving the user's real task.
- **Don't investigate, observe.** Smart-gather, watch how the user
  works, never interrogate.
- **Buffet + recommendation, both at once.** Recommendation alone
  feels prescribed; buffet alone is decision-fatigue. Show both.
- **Resources are appetizers, never mandatory meals.**

## oria's stated team context

- "We worked on this for a year, with AI" — proving complexity wasn't
  needed; we can leverage AI more than we thought.
- Use what we have (Supabase, etc.) — but build the running code
  *separate from* the product.
- "I want it in OCW" — meant the **factory record** lives in OCW; the
  running code lives wherever (new repo / Railway service / etc.)
- Consult with v_oria, Aurelius (text-defined), Zisser, OCW team.
  "Use teams to ground things, build a product."

## decision rights envelope (oria, verbatim)

> "Come to me only if you need things, only if you need keys. … Just
> create it. … You still need to ask me questions. You do it on the go,
> but questions are: I want to verify this is the direction, or I cannot
> work without this key. All the rest, resolve, consult with me."

So: resolve aggressively. Verify direction at load-bearing artifacts.
Block only on missing keys/credentials.
