---
name: team-people
description: Use this when an agent needs to know who's on the AskEffi team — names, emails, Slack handles, roles, who owns what. Triggered by "who's Lihu", "who works on X", "who do I @ for Y", "is N on the team". NOT for: agent personas in `oria-crazy-world/ground/personas/`, AskEffi product user records, AskEffi customers/design partners (those go in `team-customers`).
---

# Team people

The humans building AskEffi. This skill is the agent's roster lookup — names, emails, roles, working patterns, who owns what. Slim by design; expand as gaps surface.

## Core team (as of 2026-05-06)

| Name | Email | Slack ID | Role | Owns |
|---|---|---|---|---|
| Guy Levit | guy@askeffi.ai | U09N676471B | Co-Founder & CEO | GTM, design-partner outreach, weekly status updates |
| Lihu Berman | lihu@askeffi.ai | U09P3TPJPJL | Co-Founder & CTO | Engineering depth, product/architecture pushback, security/compliance |
| Nitsan Avni | nitsan@askeffi.ai | U09N9M3SB50 | Engineering | Dev tooling, agent infra, UseGin/Gin, monorepo stewardship |
| Oria | oria@askeffi.ai | U0AUQA6QW77 | Engineering | Integration QA, slack-effi promotion, oria-crazy-world substrate |

Time zones: Guy = US Pacific; Lihu = Europe/Amsterdam; Nitsan = Madrid; Oria = Asia/Jerusalem.

## Adjacent

| Name | Email | Relation |
|---|---|---|
| Chris Baum | chris.baum@gmail.com | **Design Advisor** — joined Nov 2025, formalized 2025-12-10. Unpaid. Active UX/wireframes work through Apr 2026. Recurring 1:1 with Guy + Thursday team check-in. CC'd on weekly status threads |
| Courtney Hughes-McKlveen | courtney@askeffi.ai | **Quietly disengaged** — last email 2026-03-12 ("out of pocket the rest of the week"); absent from Apr 30+ status threads. Slack still provisioned. No formal status documented — confirm with Guy/Lihu before referencing as active |

## Mailbox-not-person

`effi@askeffi.ai` is **not** a person — it's a team Cc address Effi indexes, used to feed the dogfooding canon. The four core humans Cc it routinely on internal threads. The product's transactional sender is `noreply@mail.askeffi.ai`, also not a human.

## Looking someone up

```bash
# Densest path — Effi indexes our emails + Drive
effi --profile dogfooding ask "Who is <Name>? What's their relationship to AskEffi?"

# Slack identity (search by first name; askeffi.ai email returns nothing)
mcp__claude_ai_Slack__slack_search_users query='lihu'

# Gmail thread participation pattern
mcp__claude_ai_Gmail__search_threads query='from:<email> newer_than:60d'
```

## Working patterns worth knowing

- **Weekly status update** — Guy emails most weekends, Effi-generated. Recipients: Lihu, Nitsan, Oria, Chris Baum, `effi@askeffi.ai`. Lately rotates "<Name> Edition" with prompts tuned to a teammate.
- **Critical Loop Friday** — recurring meeting Fridays 6:30–7pm CEST: Nitsan + Lihu + Oria + Andrew Grinalds (Critical Loop's COO, **customer**, NOT team).
- **Engineering split (informal)**: Lihu = security/compliance + architecture pushback; Nitsan = dev tooling + agent infra; Oria = integration QA + world substrate; Guy = GTM narrative.

## Not to be confused with

- **Agent personas** (`oria-crazy-world/ground/personas/`) — Mark, Wes, Ron, Tim, Sam, Poll, Yohai, Zisser, etc. Those are roles for *Claude/Gin instances*, not team humans.
- **`.dx/config.json` users** — mechanical roster (`lihu`, `nitsan`, `oria`) for `dx identify` plumbing. Adjacent but for code, not for "who's Lihu".
- **AskEffi customers** — design partners, prospects, paying. Live in `team-customers`. Critical Loop's Andrew, Mkenga's Elsante, Epsilon's Ricky, etc. — NOT in this skill.
- **AskEffi product user records** — production database users are different scope.

## Source queries (re-run for freshness)

```bash
# High-density single shot
effi --profile dogfooding ask --new "Give me a complete list of everyone on the AskEffi team — name, email, role, what they typically work on. Include any advisors, contractors, or recently-departed."

# Triangulation
mcp__claude_ai_Gmail__search_threads query='subject:"Weekly Status update" from:guy newer_than:60d'
mcp__claude_ai_Slack__slack_search_public query='from:@<id>' sort=timestamp   # per teammate
```
