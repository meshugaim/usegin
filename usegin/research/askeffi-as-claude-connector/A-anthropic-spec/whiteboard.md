---
poll: A — Anthropic remote-MCP / connector spec
date: 2026-05-08
fetched-live: yes (URLs cited inline; all dates 2026-05-08)
---

# Poll A — what Anthropic requires of a remote MCP server addable in claude.ai

## Top — the click

**Anthropic accepts arbitrary HTTPS URLs as custom connectors today, with no
review.** Pro / Max / Team / Enterprise users paste a URL into
`Settings > Connectors > Add custom connector` and it works — the only gates
are technical, not editorial. The minimum viable server is:

1. A single HTTPS endpoint speaking **Streamable HTTP** (POST + GET on one path)
   per MCP spec `2025-06-18` or `2025-11-25`.
2. **OAuth 2.1 with PKCE**, **Dynamic Client Registration (RFC 7591)**,
   **Protected Resource Metadata (RFC 9728)** at
   `/.well-known/oauth-protected-resource`, and **Authorization Server Metadata
   (RFC 8414)** at `/.well-known/oauth-authorization-server`.
3. The server returns `401` with a `WWW-Authenticate` header pointing at the
   protected-resource metadata; tokens are validated with the
   `resource` parameter (RFC 8707) bound to the canonical MCP URL.
4. The redirect URI claude.ai uses is **literally** `https://claude.ai/api/mcp/auth_callback`
   for hosted surfaces (web/desktop/mobile/Cowork). DCR removes the need to
   pre-register — claude.ai self-registers per workspace.

**The directory listing is a separate, optional, ~2-week review track**
(`mcp-review@anthropic.com`). It is not required to be addable; it is required
to appear in the in-product browse list and skip the "unverified" warning.

For AskEffi, "be a Claude connector" splits cleanly into:
- **Day-1 path** (no Anthropic involvement): expose `https://mcp.askeffi.ai/`
  with the four items above. Any user pastes the URL, OAuths into AskEffi,
  done.
- **Listed path** (Anthropic review): submit through the directory form with
  branding, annotations, privacy policy, test account, and a public docs page.

The Day-1 path is unblocked entirely by us; the listed path is unblocked by us
*plus* an Anthropic review queue.

---

## Middle — the body

### 1. Protocol stack

```
claude.ai  (web / Desktop / Cowork / mobile — all hosted)
      |
      v   <- HTTPS only, public internet, Anthropic IP egress
   Anthropic MCP client (in Anthropic cloud, NOT user's device)
      |
      v   POST /mcp + GET /mcp (Streamable HTTP)  +  OAuth 2.1 well-knowns
   our server: https://mcp.askeffi.ai/
```

> "When you add a custom connector, Claude connects to your remote MCP server
> from Anthropic's cloud infrastructure rather than from your local device, and
> this is true across every Claude client including claude.ai, Claude Desktop,
> Cowork, and mobile apps. Your MCP server must be reachable over the public
> internet from Anthropic's IP ranges — servers hosted on a private corporate
> network, behind a VPN, or blocked by a firewall won't connect."
> — Claude Help Center, *Get started with custom connectors using remote MCP*
> ([source](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp))

Implication for AskEffi: **`mcp.askeffi.ai` must be public**. Our existing
"Python is internal-only, Next.js is the public surface" rule means we either
host the MCP endpoint on the Next.js side, or expose a new public host.

### 2. Required transport — Streamable HTTP

Per MCP `2025-06-18` Transports spec
([source](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)):

- **Single endpoint path** that supports both `POST` and `GET` (e.g. `/mcp`).
- **POST** body = one JSON-RPC request / notification / response.
- Server **MUST** return either `application/json` (single response) **or**
  `text/event-stream` (SSE stream) — client must support both.
- **GET** opens an SSE stream for server-initiated messages; or `405` if not
  offered.
- **`Mcp-Session-Id`** header: server **MAY** assign at `initialize`; if it
  does, client **MUST** echo on every subsequent request. `404` → client
  starts new session. Spec quote:
  > "Servers that require a session ID **SHOULD** respond to requests without
  > an `Mcp-Session-Id` header (other than initialization) with HTTP 400 Bad
  > Request."
- **`MCP-Protocol-Version`** header on every non-initialize HTTP call:
  > "If the server receives a request with an invalid or unsupported
  > `MCP-Protocol-Version`, it **MUST** respond with `400 Bad Request`."
- **Resumability**: server **MAY** attach `id:` to SSE events so client can
  reconnect with `Last-Event-ID`. Optional but recommended for our long
  agentic-search calls.
- **`Origin`** header validation **MUST** be implemented to prevent DNS
  rebinding.

claude.ai supports both Streamable HTTP and the legacy HTTP+SSE transport, but
HTTP+SSE is deprecated in favor of Streamable HTTP
([source: claude.com/docs/connectors/building](https://claude.com/docs/connectors/building)).
**We should ship Streamable HTTP and not bother with the legacy transport.**

### 3. Required `initialize` handshake

Per MCP `2025-06-18` Lifecycle
([source](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)):

Client sends:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": { "roots": {...}, "sampling": {}, "elicitation": {} },
    "clientInfo": { "name": "claude.ai", "version": "..." }
  }
}
```

Server **MUST** respond with its capabilities and `serverInfo`:
```json
{
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools":     { "listChanged": true },     // we will declare this
      "resources": { "subscribe": true, "listChanged": true },  // optional
      "prompts":   { "listChanged": true },     // optional
      "logging":   {}                            // optional
    },
    "serverInfo": { "name": "AskEffi", "title": "AskEffi", "version": "1.0.0" }
  }
}
```

For AskEffi: **`tools` is the only required capability**. `resources` and
`prompts` are upside (Poll C territory). The Anthropic Messages-API connector
explicitly only supports `tools/call` today
([source: platform.claude.com mcp-connector docs](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)):
> "Of the feature set of the MCP specification, only tool calls are currently
> supported."

claude.ai itself (the chat surface) supports tools, prompts, and resources
([source: claude.com/docs/connectors/building](https://claude.com/docs/connectors/building))
— so we can offer richer surface there than via the Messages API.

### 4. Required OAuth flow

Per MCP `2025-06-18` Authorization
([source](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)):

Standards stack (RFC numbers, all explicit in spec):
| Standard | Role | Required of us? |
|---|---|---|
| OAuth 2.1 (`draft-ietf-oauth-v2-1-13`) | base flow | **MUST** implement |
| RFC 7591 — Dynamic Client Registration | claude.ai self-registers | **SHOULD** support |
| RFC 8414 — Authorization Server Metadata | `/.well-known/oauth-authorization-server` | **MUST** provide |
| RFC 9728 — Protected Resource Metadata | `/.well-known/oauth-protected-resource` | **MUST** implement |
| RFC 8707 — Resource Indicators | `resource=` param binds token to MCP URL | **MUST** validate |

Required wire behavior:
1. Unauth'd request to `/mcp` → server returns **401** with `WWW-Authenticate`
   header pointing at the protected-resource metadata URL.
2. Client GETs `/.well-known/oauth-protected-resource` → JSON listing
   `authorization_servers: [...]`.
3. Client GETs `/.well-known/oauth-authorization-server` → standard RFC 8414
   metadata document (registration endpoint, authorization endpoint, token
   endpoint, scopes_supported, etc.).
4. Client POSTs to registration endpoint (DCR) → gets a `client_id`.
5. Client opens authorization URL with **PKCE** code_challenge + `resource=`
   param naming the canonical MCP URL.
6. After user consent, redirect to **`https://claude.ai/api/mcp/auth_callback`**
   with code.
7. Client exchanges code + `code_verifier` + `resource=` → access_token (+
   refresh_token).
8. Client retries `/mcp` with `Authorization: Bearer <token>`.

Hard server-side rules from the spec:
- Server **MUST** validate the token's audience matches its canonical URI
  (RFC 8707). Tokens for other resources **MUST** be rejected.
- Server **MUST NOT** pass through the inbound token to upstream APIs (e.g.
  AskEffi must not forward Anthropic-issued tokens to Supabase or Google).
- Tokens **MUST** be in the `Authorization` header, never the URI.
- Authorization **MUST** be included on every HTTP request, even within a
  single MCP session.
- For public clients, refresh tokens **MUST** be rotated on use (OAuth 2.1
  §4.3.1).

The Claude *Software Directory Policy* additionally requires:
> "Remote MCP servers must use secure OAuth 2.0 with certificates from
> recognized authorities."
> ([source](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy))
i.e. valid TLS chain, no self-signed.

### 5. Required well-known endpoints (concrete checklist)

| Endpoint | RFC | What goes in it |
|---|---|---|
| `https://mcp.askeffi.ai/` (POST + GET) | MCP transport | the JSON-RPC MCP endpoint itself |
| `https://mcp.askeffi.ai/.well-known/oauth-protected-resource` | RFC 9728 | `{ "resource": "https://mcp.askeffi.ai", "authorization_servers": ["https://auth.askeffi.ai"], "scopes_supported": [...] }` |
| `https://auth.askeffi.ai/.well-known/oauth-authorization-server` | RFC 8414 | metadata: issuer, authorization_endpoint, token_endpoint, registration_endpoint, code_challenge_methods_supported (must include `S256`), grant_types_supported, etc. |
| `https://auth.askeffi.ai/oauth/register` | RFC 7591 | DCR endpoint — accepts `client_name`, `redirect_uris`, returns `client_id` |
| `https://auth.askeffi.ai/oauth/authorize` | OAuth 2.1 | user-facing consent screen, requires PKCE |
| `https://auth.askeffi.ai/oauth/token` | OAuth 2.1 | code → access_token + refresh_token; rotates refresh tokens |

The auth host can be the same origin as the MCP host (spec allows; many do
both on one domain). **B-poll** owns the actual implementation; this whiteboard
just names the contract.

### 6. Required tool shape (handoff summary, full body in C-poll)

Per MCP `2025-06-18` Tools spec and the Directory Policy:

- Each tool **MUST** declare `name`, `description`, `inputSchema` (JSON Schema).
- Each tool **MUST** declare these annotations to be directory-eligible
  (verbatim from
  [submission docs](https://claude.com/docs/connectors/building/submission)):
  - `title` — human-readable display name
  - `readOnlyHint` — boolean, true if the tool only reads
  - `destructiveHint` — boolean, true if the tool can delete/overwrite
- Optional: `idempotentHint`, `openWorldHint`, `outputSchema`.

Quote from third-party summary of submission docs (we couldn't get the page
direct; the structured policy doc confirms):
> "All tools must include a `title` and the applicable `readOnlyHint` or
> `destructiveHint`. Missing tool annotations account for ~30% of Connectors
> Directory rejections."
> ([source](https://sunpeak.ai/blogs/claude-connector-directory-submission/) —
> third-party blog citing Anthropic's published rejection statistics; corroborated
> by [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy):
> "MCP servers must supply all applicable annotations, in particular
> `readOnlyHint`, `destructiveHint`, and `title`.")

### 7. Resource limits Anthropic enforces (claude.ai surface)

Per [claude.com/docs/connectors/building](https://claude.com/docs/connectors/building):

| Limit | Value | Surface |
|---|---|---|
| Max tool result size | ~150,000 characters | claude.ai / Claude Desktop |
| Max tool result size | 25,000 tokens (configurable via `MAX_MCP_OUTPUT_TOKENS`) | Claude Code |
| Tool call timeout | 300 seconds (5 minutes) | claude.ai / Claude Desktop |
| Tool call timeout | configurable via `MCP_TOOL_TIMEOUT` | Claude Code |

For AskEffi: a search-and-cite answer must fit in 150k chars; our chat-stream
that runs ~30s is well under 5min; **no surprises here**.

### 8. Custom-URL add vs Directory listing

| | **Custom URL (Day-1)** | **Directory-listed** |
|---|---|---|
| User flow | Settings > Connectors > "+ Add custom connector" → paste URL | Settings > Connectors > browse list |
| Anthropic review | none | required, ~2 weeks ([source](https://sunpeak.ai/blogs/claude-connector-directory-submission/)) |
| Plan availability | Free (1 connector limit), Pro, Max, Team, Enterprise | all plans |
| Trust UX | "unverified service" warning | no warning, "verified" badge |
| Branding | none | logo, favicon, screenshots |
| Required from us | URL + the spec items above | URL + branding + privacy policy + test account + 3 use cases + tool annotations + GA-ready (no beta) + public docs page |
| Submission email | n/a | `mcp-review@anthropic.com` |

Top common rejection reasons (Anthropic-published per third-party reporting):
1. Missing tool annotations (~30%)
2. OAuth callback URL errors (forgetting `claude.com` URL)
3. Missing/incomplete privacy policy
4. Incomplete documentation
5. Submitting beta-state servers

### 9. MCP version timeline & claude.ai compatibility

Per [claude.com/docs/connectors/building](https://claude.com/docs/connectors/building):
> "Claude supports the 2025-03-26, 2025-06-18, and 2025-11-25 auth specifications."

| MCP version | Status (May 2026) | Should we target? |
|---|---|---|
| `2024-11-05` (HTTP+SSE) | deprecated | no |
| `2025-03-26` | supported, older | only as fallback |
| `2025-06-18` | supported, well-documented | **yes — target this** |
| `2025-11-25` | supported, newest auth spec | optionally also negotiate |

Recommendation: implement against `2025-06-18` (the version this whiteboard
cites end-to-end), advertise both `2025-06-18` and `2025-11-25` in the
`protocolVersion` negotiation. Skip `2024-11-05` and the legacy HTTP+SSE
transport entirely — they are deprecated and the cost of supporting them is
non-zero (separate POST + SSE endpoints).

### 10. The Messages-API connector path (alternative surface)

Worth knowing, even though not the charter focus: the Anthropic Messages API
exposes an `mcp_servers` array as a beta feature
([source](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)),
beta header `anthropic-beta: mcp-client-2025-11-20`. This means **anyone
running the Messages API can attach AskEffi as an MCP server** — separate
distribution channel from claude.ai itself. Same server contract; different
client. Auth is currently a static `authorization_token` field (caller obtains
the token outside the API). One implication: when we ship the server, we
unlock **two** distribution surfaces (claude.ai users + Anthropic API
developers) for the price of one.

### 11. What Anthropic stores

The docs are explicit on one retention point — and silent on the rest.

Stated:
> "This feature is **not** eligible for [Zero Data Retention (ZDR)]. Data is
> retained according to the feature's standard retention policy."
> — [Messages-API mcp-connector docs](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)

That's about the Messages-API path. For the claude.ai connector path, public
docs do **not** state where Anthropic stores the OAuth tokens it receives from
us, what encryption is used, or retention windows. **This is a known gap.**

Inferable from behavior: Anthropic must persist refresh tokens (otherwise it
couldn't re-auth between sessions); must persist DCR client credentials per
workspace; must persist the `Mcp-Session-Id` association if it wants to resume
across user-session boundaries. None of this is publicly speced.

---

## Bottom — the open ends

### Dilemma 1 — host the MCP endpoint on Next.js or stand up a separate service

- **Decision needed**: which host runs `https://mcp.askeffi.ai/`.
- **Options**:
  - (a) Next.js app routes (`/api/mcp/*`) — leverages existing public surface,
    Supabase auth context already loaded.
  - (b) New Python FastAPI service exposed publicly — keeps Python's agentic
    chat code adjacent, but breaks "Python is internal-only" rule.
  - (c) New thin BFF in front of Python over Railway private network — Next.js
    handles transport + auth, proxies tool calls to internal Python.
- **Lean**: (c). Keeps the rule, reuses Next.js's public-surface posture, lets
  Python keep doing agentic work over the private network.
- **Why**: Streamable HTTP is just HTTP — Next.js can speak it. The heavy
  lifting (search, agentic chat) stays on Python. We don't have to re-do
  auth — Next.js already has session/RLS context.
- **Price**: one more proxy hop per tool call. Small.
- **Risk**: SSE long-poll support on Next.js routes (Vercel/Railway's
  edge-runtime caps on response duration). Needs a wire-probe with our actual
  hosting before committing.

### Dilemma 2 — ship the Day-1 path before pursuing directory listing, or pursue both in parallel

- **Decision needed**: ordering.
- **Options**:
  - (a) Day-1 first, listed later — we get user-pasted URLs working,
    learn from real usage, then submit when polished.
  - (b) Parallel — submit to directory the moment Day-1 works.
  - (c) Listed-only — don't ship Day-1 at all, only the polished version.
- **Lean**: (a).
- **Why**: Day-1 has no Anthropic gate, so it's purely a function of our work.
  Listing requires GA-ready (no beta), 3 use cases, public docs, branding —
  all of which mature naturally during the Day-1 period. Sequencing means each
  rejection-cause-on-the-list (tool annotations, privacy policy, docs) gets
  fixed before review, not after.
- **Price**: ~2-week extra delay before the "verified" badge. Negligible if
  Day-1 already lets users add it.
- **Risk**: directory-policy may include rules we haven't seen yet
  (`mcp-review@anthropic.com` is the escalation channel; published policy is
  partial). Wire-probe by submitting an early version once Day-1 ships.

### Wire-probe questions (only-the-actual-thing-can-answer)

1. **Does claude.ai accept arbitrary HTTPS MCP URLs without listing review,
   today, in May 2026?** Public docs say yes. Probe: stand up a minimal MCP
   server, paste the URL into a Pro account, see if it adds. If yes, the
   Day-1 path is fully unblocked. If no — find out what the gate is.
2. **What is Anthropic's outbound IP range for MCP egress?** Docs say "from
   Anthropic's IP ranges" but don't publish the list. Probe: log inbound
   IPs at the MCP endpoint during testing; ask `mcp-review@anthropic.com`
   for the published range if firewalling is needed.
3. **Does claude.ai's MCP client send `MCP-Protocol-Version` and which
   value?** Probe: log every header on the first POST.
4. **Does claude.ai DCR-register a fresh client per workspace, per user, or
   once globally?** Probe: log registrations during testing.
5. **What's the actual ceiling on SSE stream duration in our Next.js +
   Railway hosting?** Internal infra question — relevant to whether we can
   stream agentic tool calls back as MCP `text/event-stream` or have to
   return single JSON responses.

### Known gaps in this whiteboard

- **Token storage on Anthropic's side**: not publicly speced. Material gap
  for D-poll (security/multitenancy) and any enterprise customer asking
  "where does my access token live."
- **Outbound IP allowlist**: public docs say "Anthropic's IP ranges" without
  publishing them. Hands off to D-poll.
- **MCP `2025-11-25` auth-spec deltas vs `2025-06-18`**: I targeted
  `2025-06-18` because that's the most thoroughly documented public
  spec. The `2025-11-25` revision is referenced by the Messages-API mcp-
  connector docs and the building docs but I didn't fetch its diff.
  Low-risk gap (we'd negotiate down to `2025-06-18`).
- **Origin-header validation requirement**: spec says servers MUST validate
  Origin to prevent DNS rebinding. Implementation specifics (which Origin
  values claude.ai sends) are an empirical question — wire-probe item.
- **Claude Code redirect URI**: docs say "loopback redirect for Claude Code"
  without giving the exact form. Not relevant for the claude.ai path; would
  matter if we wanted Claude Code support too. Hand-off to E-poll.

### Friction zettels captured

None. The Anthropic + MCP spec stack is internally consistent at the
reading depth this charter required. The only friction was that the
support-article URL `support.anthropic.com` 302-redirects to
`support.claude.com` and the original article ID 11503834 has been
moved/superseded by the developer docs at `claude.com/docs/connectors/building` —
a normal docs-migration trail, not a fork worth zettel-ing.

---

## Sources (all fetched 2026-05-08)

- [MCP `2025-06-18` Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP `2025-06-18` Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [MCP `2025-06-18` Lifecycle](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)
- [MCP `2025-06-18` Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [Claude Help Center — Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Claude Help Center — Use connectors to extend Claude's capabilities](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities)
- [Claude Help Center — Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
- [Claude developer docs — Building custom connectors](https://claude.com/docs/connectors/building)
- [Claude developer docs — Submitting to the Connectors Directory](https://claude.com/docs/connectors/building/submission) (couldn't fetch directly; confirmed via Software Directory Policy + third-party reporting)
- [Anthropic API — MCP connector (Messages API)](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)
- [Anthropic API — Remote MCP servers](https://platform.claude.com/docs/en/agents-and-tools/remote-mcp-servers)
- Third-party (used as cross-check on directory rejection stats):
  [sunpeak.ai — Claude Connector Directory Submission](https://sunpeak.ai/blogs/claude-connector-directory-submission/)
- RFCs cited by MCP auth spec: 7591 (DCR), 8414 (AS metadata), 9728 (PR
  metadata), 8707 (Resource Indicators), OAuth 2.1 draft-ietf-oauth-v2-1-13
