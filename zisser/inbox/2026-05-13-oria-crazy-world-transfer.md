## Transfer request: `AskEffi/oria-crazy-world` → `meshugaim`

**From:** Oria (via Claude Code / oria-ai)
**Date:** 2026-05-13

### What's needed

Transfer the repo `AskEffi/oria-crazy-world` to the `meshugaim` org.

Oria does not have admin rights on that repo in AskEffi (no Settings tab visible), so the transfer must come from an AskEffi org owner.

### Action needed

Either:
1. Grant Oria admin access to `AskEffi/oria-crazy-world` so she can initiate the transfer herself, or
2. An AskEffi org owner transfers it directly to `meshugaim`.

### Repo context

Description: "Oria's crazy world: ground/sky/space, 5 institutions, dual-faced. Substrate, not tooling."
Language: Python. Last pushed: Apr 29, 2026.
GitHub: https://github.com/AskEffi/oria-crazy-world

---

## Delivery log

Zisser tried every pipe to surface this to Lihu hands-free. Result by channel:

| Channel | State | What happened |
|---|---|---|
| **Gmail** (`mcp__claude_ai_Gmail__create_draft`) | ✅ Sent | Draft `r7357498229370088506` created with `[auto-send]` body marker → ships via Apps Script within ~1 min. To: lihu@askeffi.ai; CC: oria@askeffi.ai. Subject: "Transfer AskEffi/oria-crazy-world → meshugaim org". |
| **Linear** (`plan create`) | ✅ Filed | **ENG-5996** — "Transfer AskEffi/oria-crazy-world repo → meshugaim org", label `chore`, Backlog. Body has the two options + repo context + paper-trail pointer. Linear shared-API-key caveat applies (assignee=team-shared key, not real assignment). |
| **Slack via `dx slack` bot** | ❌ Dead | `dx slack whoami` returns `{ok:false, error:"account_inactive"}`. UseGin bot token is inactive in the workspace. Needs re-auth / reinstall of the bot at the Slack app level. |
| **Slack via claude.ai connector** (`mcp__claude_ai_Slack__*`) | ⚠️ Needs human click | Authenticate tool says: "Ask the user to run `/mcp` and select 'claude.ai Slack' to authenticate." Not hands-free from agent side; one-time OAuth click by the live user wires it up. |
| **WhatsApp / Baileys** (`experiments/whatsapp-baileys/`) | ❌ Not a send path | Listener-only spike — pairs as a linked device to **receive** every message your phone sees and append to SQLite. No outbound send API used; not paired with creds either. Read-mode by design. |
| **Zisser inbox file** | ✅ Committed | This file. Paper trail. |
| **Zisser `dispatched/`** | ➖ N/A | Dispatched is for chartering another agent; this is a request *to a human*, not a charter. Skipped on purpose. |

### What's missing to close the hands-free loop

1. **Slack bot re-auth** — `dx slack` is the canonical agent-attributed Slack write path (`[via <human>]` prefix, ENG-id auto-link). It's been live and is currently `account_inactive`. Re-installing/refreshing the bot token in the AskEffi workspace would close the cleanest hands-free Slack pipe. (Adjacent: the `usegin/research/dev-channel-slack-prior-art/` work has been studying this surface.)
2. **claude.ai Slack connector OAuth** — one `/mcp` click by Lihu (or Oria) wires up the `mcp__claude_ai_Slack__*` toolset for future agent-driven DMs. This is *live-as-the-human* writes, not bot writes — useful but different posture.
3. **WhatsApp outbound** — Baileys *can* send (the protocol supports it), the spike just doesn't expose a send helper. Adding `bun start --send <jid> <text>` would make it a viable third pipe; until then it's listener-only.

### Pipe-testing takeaway (2026-05-13)

For this run: **2 channels landed hands-free (Gmail auto-send + Linear)**, 1 channel needs a human OAuth click (claude.ai Slack connector), 1 channel needs operator repair (dx slack bot), 1 channel is read-only by spike design (WhatsApp/Baileys). The inbox-file paper trail held — Oria committed it via oria-ai, Zisser picked it up after `git pull` (origin had it; local didn't yet).

— Zisser, 2026-05-13
