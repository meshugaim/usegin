# Phase 05 — Implementation Spec: Usage Dashboard

> Spec date: 2026-02-21
> Source: phase-03-converged-design.md (authoritative design)
> Audience: Implementer (liaison agent). Build from this document alone.

---

## 1. Overview

Build a two-page admin dashboard at `/admin/usage` that shows agent usage metrics, a sortable paginated conversation table, per-tool RED metrics, and a conversation detail view with a CSS-based waterfall timeline. The audience is 3 internal admins debugging latency, cost, and errors across ~714 conversations and ~33 users. No new dependencies (no recharts). No new migrations. All data comes from the existing `agent_usage`, `turns`, and `tool_observations` tables.

---

## 2. Routes & Pages

### 2.1 `/admin/usage` — Main Page

**File:** `nextjs-app/app/admin/usage/page.tsx`
**Type:** Server component (RSC)

**Responsibilities:**
1. Auth guard (authenticate user, verify admin status)
2. Read URL search params: `range`, `project`, `sort`, `dir`, `page`
3. Call four server actions in parallel via `Promise.all`
4. Pass all data as props to `<UsagePageClient>`

```tsx
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getUsageStats,
  getConversations,
  getToolBreakdown,
  getProjectOptions,
} from "@/app/actions/admin-usage";
import { UsagePageClient } from "@/components/admin/usage/usage-page-client";

interface SearchParams {
  range?: string;
  project?: string;
  sort?: string;
  dir?: string;
  page?: string;
}

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: adminRecord } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!adminRecord) notFound();

  const params = await searchParams;
  const range = params.range || "7d";
  const projectId = params.project || null;
  const sort = params.sort || "created_at";
  const dir = (params.dir || "desc") as "asc" | "desc";
  const page = parseInt(params.page || "1", 10);

  const [statsResult, conversationsResult, toolsResult, projectsResult] =
    await Promise.all([
      getUsageStats(range, projectId),
      getConversations(range, projectId, sort, dir, page),
      getToolBreakdown(range, projectId),
      getProjectOptions(),
    ]);

  return (
    // ... admin page shell (see Section 2.3)
    <UsagePageClient
      stats={statsResult.success ? statsResult.data : null}
      conversations={conversationsResult.success ? conversationsResult.data : null}
      toolBreakdown={toolsResult.success ? toolsResult.data : null}
      projects={projectsResult.success ? projectsResult.data : []}
      filters={{ range, projectId, sort, dir, page }}
      error={
        !statsResult.success ? statsResult.error :
        !conversationsResult.success ? conversationsResult.error : null
      }
    />
  );
}
```

### 2.2 `/admin/usage/[id]` — Conversation Detail Page

**File:** `nextjs-app/app/admin/usage/[id]/page.tsx`
**Type:** Server component (RSC)

**Responsibilities:**
1. Auth guard (same pattern)
2. Read `id` from route params
3. Call `getConversationDetail(id)` server action
4. Pass result to `<ConversationDetailClient>`

```tsx
export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Auth guard (same as main page)
  // ...

  const { id } = await params;
  const result = await getConversationDetail(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    // ... admin page shell
    <ConversationDetailClient detail={result.data} />
  );
}
```

### 2.3 Page Shell (Both Pages)

Both pages render the standard admin page shell. Copy the exact pattern from `admin/gfs/page.tsx`:

```tsx
<div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
  <header className="border-b bg-white/80 backdrop-blur-md dark:bg-zinc-950/80 shadow-sm sticky top-0 z-50">
    <div className="container mx-auto flex h-16 items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Usage
            </h1>
            <p className="text-xs text-muted-foreground">
              Agent usage and tool analytics
            </p>
          </div>
        </div>
      </div>
    </div>
  </header>

  <main className="container mx-auto py-8 px-6">
    <div className="max-w-7xl mx-auto">
      {/* Page-specific content */}
    </div>
  </main>
</div>
```

For the detail page, the back link changes:
```tsx
<Link href="/admin/usage">
  <Button variant="ghost" size="sm" className="gap-2">
    <ArrowLeft className="h-4 w-4" />
    Usage
  </Button>
</Link>
```

And the header title changes to "Conversation Detail".

---

## 3. Server Actions

**File:** `nextjs-app/app/actions/admin-usage.ts`

All server actions follow the same pattern:
1. `"use server"` directive
2. Authenticate via `createClient()` (AuthClient) to verify the user is logged in
3. Check admin status via `admins` table query
4. Use `getSupabaseAdmin()` (AdminClient, service-role) for data queries that need `auth.users` or need to bypass RLS for cross-table joins
5. Return `{ success: boolean; data?: T; error?: string }`
6. Wrap in `Sentry.withServerActionInstrumentation`

### 3.0 Shared Auth Helper

Define a private helper at the top of the file (NOT exported, since it uses server-only imports):

```typescript
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { AdminClient } from "@/lib/supabase/types";

interface AdminUsageResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function verifyAdmin(): Promise<
  { adminClient: AdminClient; error?: never } | { adminClient?: never; error: string }
> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "Not authenticated" };
  }

  const { data: adminRecord } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!adminRecord) {
    return { error: "Admin access required" };
  }

  const adminClient = getSupabaseAdmin();
  if (!adminClient) {
    return { error: "Admin client not configured" };
  }

  return { adminClient };
}
```

### 3.1 `getUsageStats`

```typescript
export async function getUsageStats(
  range: string,
  projectId: string | null,
): Promise<AdminUsageResponse<UsageStats>>
```

**Parameters:**
- `range`: `"24h" | "7d" | "30d" | "all"`
- `projectId`: UUID string or `null`

**Return type:** `UsageStats` (see Section 6)

**Logic:**
1. Verify admin.
2. Compute `rangeStart` and `compareStart`/`compareEnd` from `range`:
   - `"24h"`: current = last 24h, compare = 24-48h ago
   - `"7d"`: current = last 7d, compare = 7-14d ago
   - `"30d"`: current = last 30d, compare = 30-60d ago
   - `"all"`: current = all time, compare = `null` (no delta)
3. Run two raw SQL queries in parallel via `adminClient.rpc("exec_sql", ...)` — **No. Use the Supabase `.from()` query builder.** Since `agent_usage` has admin-only RLS SELECT, the admin client can read it directly.

**Query approach — use Supabase client query builder, NOT raw SQL:**

For the current period:
```typescript
// Current period stats
const { data: currentRows } = await adminClient
  .from("agent_usage")
  .select("duration_ms, cost_usd, is_error, created_at")
  .gte("created_at", rangeStart.toISOString())
  .eq(projectId ? "project_id" : "id", projectId || /* skip filter */);
```

**Problem:** The Supabase JS client does not support `PERCENTILE_CONT` or aggregate functions directly. We need a different approach.

**Revised approach — use `.rpc()` with a SQL function, OR compute aggregates client-side:**

Since we do NOT want new migrations (no new SQL functions), compute aggregates in the server action from the raw rows. For ~714 total rows with the admin client filtering by time range, we fetch the relevant columns and compute in TypeScript:

```typescript
// Fetch all rows in the time range (max ~714 rows total, usually much fewer)
let query = adminClient
  .from("agent_usage")
  .select("duration_ms, cost_usd, is_error, created_at");

if (rangeStart) {
  query = query.gte("created_at", rangeStart);
}
if (projectId) {
  query = query.eq("project_id", projectId);
}

const { data: currentRows, error } = await query;
```

Then compute stats in TypeScript:
```typescript
function computeStats(rows: AgentUsageRow[]): PeriodStats {
  const total = rows.length;
  const errors = rows.filter(r => r.is_error).length;
  const errorRate = total > 0 ? (errors / total) * 100 : 0;
  const durations = rows
    .map(r => r.duration_ms)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  const medianDuration = percentile(durations, 0.5);
  const p95Duration = percentile(durations, 0.95);
  const totalCost = rows.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayRows = rows.filter(r => new Date(r.created_at) >= today);
  const todayCount = todayRows.length;
  const todayCost = todayRows.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0);

  return { total, errors, errorRate, medianDuration, p95Duration, totalCost, todayCount, todayCost };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
```

Run current and comparison period fetches in parallel:
```typescript
const [currentRows, compareRows] = await Promise.all([
  fetchRows(adminClient, rangeStart, null, projectId),
  compareStart ? fetchRows(adminClient, compareStart, compareEnd, projectId) : null,
]);
```

**Error handling:** If any query fails, return `{ success: false, error: error.message }`.

### 3.2 `getConversations`

```typescript
export async function getConversations(
  range: string,
  projectId: string | null,
  sort: string,
  dir: "asc" | "desc",
  page: number,
): Promise<AdminUsageResponse<ConversationsPage>>
```

**Parameters:**
- `range`: `"24h" | "7d" | "30d" | "all"`
- `projectId`: UUID string or `null`
- `sort`: `"created_at" | "num_turns" | "duration_ms" | "cost_usd"`
- `dir`: `"asc" | "desc"`
- `page`: 1-based page number

**Return type:** `ConversationsPage` (see Section 6)

**Logic:**
1. Verify admin.
2. Validate `sort` against allowed columns (whitelist: `created_at`, `num_turns`, `duration_ms`, `cost_usd`). Default to `created_at` if invalid.
3. Validate `dir` is `asc` or `desc`. Default to `desc`.
4. Compute offset: `(page - 1) * 25`.
5. Two parallel queries:

**Query A — Paginated conversations:**
```typescript
let query = adminClient
  .from("agent_usage")
  .select(`
    id,
    created_at,
    model,
    num_turns,
    duration_ms,
    cost_usd,
    is_error,
    user_id,
    project_id
  `)
  .order(sort, { ascending: dir === "asc" })
  .range(offset, offset + 24); // 0-indexed, inclusive

if (rangeStart) {
  query = query.gte("created_at", rangeStart);
}
if (projectId) {
  query = query.eq("project_id", projectId);
}
```

**Query B — Total count for pagination:**
```typescript
let countQuery = adminClient
  .from("agent_usage")
  .select("id", { count: "exact", head: true });

if (rangeStart) {
  countQuery = countQuery.gte("created_at", rangeStart);
}
if (projectId) {
  countQuery = countQuery.eq("project_id", projectId);
}
```

**Query C — Tool call aggregates for returned conversation IDs:**
After query A returns, collect the IDs and fetch tool stats:
```typescript
const ids = rows.map(r => r.id);
// Get all turns for these conversations, then tool observations for those turns
const { data: turnRows } = await adminClient
  .from("turns")
  .select("id, agent_usage_id")
  .in("agent_usage_id", ids);

const turnIds = (turnRows || []).map(t => t.id);
const { data: toolRows } = await adminClient
  .from("tool_observations")
  .select("turn_id, error")
  .in("turn_id", turnIds);
```

Then aggregate in TypeScript — group tool observations by `turn_id`, then by `agent_usage_id` (via the turns mapping), to produce `{ totalToolCalls, failedToolCalls }` per conversation.

**Query D — User emails and project names:**
```typescript
const userIds = [...new Set(rows.map(r => r.user_id))];
const projectIds = [...new Set(rows.map(r => r.project_id).filter(Boolean))];

const [usersResult, projectsResult] = await Promise.all([
  adminClient.auth.admin.listUsers({ perPage: 100 }),
  projectIds.length > 0
    ? adminClient.from("projects").select("id, name").in("id", projectIds)
    : Promise.resolve({ data: [] }),
]);

// Build lookup maps
const emailMap = new Map(
  usersResult.data.users
    .filter(u => userIds.includes(u.id))
    .map(u => [u.id, u.email])
);
const projectMap = new Map(
  (projectsResult.data || []).map(p => [p.id, p.name])
);
```

**Note:** `adminClient.auth.admin.listUsers()` requires the service-role client. If user count exceeds 100, paginate. At 33 users this is not an issue for v1. If the page has fewer than 25 unique user IDs (common), we could also use `adminClient.auth.admin.getUserById(id)` in a loop, but `listUsers` is simpler.

**Alternative for user emails (simpler):** Since we have at most 25 unique user_ids per page, we can fetch them individually:
```typescript
const emailMap = new Map<string, string>();
await Promise.all(
  userIds.map(async (uid) => {
    const { data } = await adminClient.auth.admin.getUserById(uid);
    if (data?.user?.email) {
      emailMap.set(uid, data.user.email);
    }
  })
);
```

Use this approach. It avoids pagination issues and the full user listing.

**Assemble and return:** Map the raw rows into `ConversationRow[]` with emails, project names, and tool stats attached.

**Error handling:** Return `{ success: false, error }` on failure.

### 3.3 `getToolBreakdown`

```typescript
export async function getToolBreakdown(
  range: string,
  projectId: string | null,
): Promise<AdminUsageResponse<ToolBreakdownRow[]>>
```

**Parameters:**
- `range`: `"24h" | "7d" | "30d" | "all"`
- `projectId`: UUID string or `null`

**Return type:** `ToolBreakdownRow[]` (see Section 6)

**Logic:**
1. Verify admin.
2. Fetch all tool_observations in the time range. If `projectId` is set, first get the agent_usage IDs, then turns, then tool observations (chain).
3. Compute aggregates in TypeScript grouped by `tool_name`.

**Queries:**

If no project filter:
```typescript
let query = adminClient
  .from("tool_observations")
  .select("tool_name, duration_ms, error, created_at");

if (rangeStart) {
  query = query.gte("created_at", rangeStart);
}
```

If project filter is set, we need to filter through the join chain:
```typescript
// Get agent_usage IDs for this project in range
const { data: usageRows } = await adminClient
  .from("agent_usage")
  .select("id")
  .gte("created_at", rangeStart)
  .eq("project_id", projectId);

const usageIds = (usageRows || []).map(r => r.id);

// Get turn IDs for those usages
const { data: turnRows } = await adminClient
  .from("turns")
  .select("id")
  .in("agent_usage_id", usageIds);

const turnIds = (turnRows || []).map(r => r.id);

// Get tool observations for those turns
const { data: toolRows } = await adminClient
  .from("tool_observations")
  .select("tool_name, duration_ms, error")
  .in("turn_id", turnIds);
```

**Aggregate in TypeScript:**
```typescript
function aggregateTools(rows: ToolObsRow[]): ToolBreakdownRow[] {
  const groups = new Map<string, ToolObsRow[]>();
  for (const row of rows) {
    const existing = groups.get(row.tool_name) || [];
    existing.push(row);
    groups.set(row.tool_name, existing);
  }

  return Array.from(groups.entries())
    .map(([toolName, group]) => {
      const callCount = group.length;
      const errorCount = group.filter(r => r.error !== null).length;
      const errorRate = callCount > 0 ? (errorCount / callCount) * 100 : 0;
      const durations = group
        .map(r => r.duration_ms)
        .filter((d): d is number => d !== null)
        .sort((a, b) => a - b);

      return {
        toolName,
        callCount,
        errorCount,
        errorRate: Math.round(errorRate * 10) / 10,
        p50Ms: percentile(durations, 0.5),
        p95Ms: percentile(durations, 0.95),
      };
    })
    .sort((a, b) => b.callCount - a.callCount);
}
```

**Error handling:** Return `{ success: false, error }` on failure. If tool_observations table is empty, return `{ success: true, data: [] }`.

### 3.4 `getProjectOptions`

```typescript
export async function getProjectOptions(): Promise<
  AdminUsageResponse<ProjectOption[]>
>
```

**Return type:** `ProjectOption[]` — `{ id: string; name: string }[]`

**Logic:**
1. Verify admin.
2. Query distinct project_ids from agent_usage, join with projects table.

```typescript
const { data: usageRows } = await adminClient
  .from("agent_usage")
  .select("project_id")
  .not("project_id", "is", null);

const projectIds = [...new Set((usageRows || []).map(r => r.project_id))];

if (projectIds.length === 0) {
  return { success: true, data: [] };
}

const { data: projects } = await adminClient
  .from("projects")
  .select("id, name")
  .in("id", projectIds)
  .order("name", { ascending: true });

return { success: true, data: projects || [] };
```

### 3.5 `getConversationDetail`

```typescript
export async function getConversationDetail(
  id: string,
): Promise<AdminUsageResponse<ConversationDetail>>
```

**Parameters:**
- `id`: UUID of the `agent_usage` row

**Return type:** `ConversationDetail` (see Section 6)

**Logic:**
1. Verify admin.
2. Three parallel queries:

```typescript
const [conversationResult, turnsResult, userResult] = await Promise.all([
  // Query 1: Conversation metadata + project name
  adminClient
    .from("agent_usage")
    .select(`
      id,
      created_at,
      model,
      num_turns,
      duration_ms,
      duration_api_ms,
      cost_usd,
      is_error,
      user_id,
      project_id,
      auth_mode,
      input_tokens,
      output_tokens,
      cache_read_input_tokens,
      cache_creation_input_tokens,
      claude_session_id
    `)
    .eq("id", id)
    .single(),

  // Query 2: Turns
  adminClient
    .from("turns")
    .select("*")
    .eq("agent_usage_id", id)
    .order("turn_index", { ascending: true }),

  // Placeholder for user — resolved after we have user_id
  Promise.resolve(null),
]);
```

After getting the conversation:
```typescript
// Get user email
const { data: userData } = await adminClient.auth.admin.getUserById(
  conversationResult.data.user_id
);
const userEmail = userData?.user?.email || null;

// Get project name
let projectName: string | null = null;
if (conversationResult.data.project_id) {
  const { data: project } = await adminClient
    .from("projects")
    .select("name")
    .eq("id", conversationResult.data.project_id)
    .single();
  projectName = project?.name || null;
}

// Get tool observations for all turns
const turnIds = (turnsResult.data || []).map(t => t.id);
let toolObs: ToolObservationRow[] = [];
if (turnIds.length > 0) {
  const { data } = await adminClient
    .from("tool_observations")
    .select("*")
    .in("turn_id", turnIds)
    .order("sequence", { ascending: true });
  toolObs = data || [];
}
```

**Assemble the nested structure:**
```typescript
// Group tool observations by turn_id
const toolsByTurn = new Map<string, ToolObservationRow[]>();
for (const obs of toolObs) {
  const existing = toolsByTurn.get(obs.turn_id) || [];
  existing.push(obs);
  toolsByTurn.set(obs.turn_id, existing);
}

const turns = (turnsResult.data || []).map(turn => ({
  turn,
  toolCalls: toolsByTurn.get(turn.id) || [],
}));

// Find first sentry_trace_id across turns
const sentryTraceId = turns
  .map(t => t.turn.sentry_trace_id)
  .find(id => id !== null) || null;

return {
  success: true,
  data: {
    conversation: {
      ...conversationResult.data,
      projectName,
      userEmail,
      sentryTraceId,
    },
    turns,
  },
};
```

**Error handling:** If conversation not found (`.single()` returns null), return `{ success: false, error: "Conversation not found" }`. The page component will call `notFound()`.

---

## 4. Components

### File Structure

```
nextjs-app/components/admin/usage/
  usage-page-client.tsx
  kpi-cards.tsx
  conversations-table.tsx
  conversation-row.tsx
  status-dot.tsx
  tool-breakdown-table.tsx
  filter-bar.tsx

  detail/
    conversation-detail-client.tsx
    conversation-header.tsx
    waterfall-timeline.tsx
    waterfall-turn-row.tsx
    waterfall-tool-row.tsx
    timing-bar.tsx
    time-axis.tsx
    tool-detail-panel.tsx
    copy-button.tsx
```

All components are `"use client"` unless stated otherwise.

### 4.1 Main Page Components

#### `usage-page-client.tsx`

**Props:**
```typescript
interface UsagePageClientProps {
  stats: UsageStats | null;
  conversations: ConversationsPage | null;
  toolBreakdown: ToolBreakdownRow[] | null;
  projects: ProjectOption[];
  filters: {
    range: string;
    projectId: string | null;
    sort: string;
    dir: "asc" | "desc";
    page: number;
  };
  error: string | null;
}
```

**Behavior:**
- Renders FilterBar, KpiCards, ConversationsTable, ToolBreakdownTable vertically.
- Uses `useRouter()` and `useSearchParams()` for URL state management.
- When filters change, navigates to new URL with updated params (triggering server re-render).
- Changing time range or project resets page to 1.
- Shows error alert if `error` is non-null.

#### `filter-bar.tsx`

**Props:**
```typescript
interface FilterBarProps {
  range: string;
  projectId: string | null;
  projects: ProjectOption[];
  onRangeChange: (range: string) => void;
  onProjectChange: (projectId: string | null) => void;
}
```

**Behavior:**
- Horizontal flex row with two controls.
- **Time range:** Four buttons styled as a toggle group: `24h`, `7d`, `30d`, `All`. Active button has `bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`. Inactive: `bg-white dark:bg-zinc-800` with border.
- **Project dropdown:** Uses shadcn `Select` component. First option: "All projects" (value: empty string). Remaining options populated from `projects` prop. Searchable is not natively supported by shadcn Select — use a standard Select for v1. Consider adding a filter input inside the Select content if project count exceeds 15.

**Styling:** `flex items-center justify-between gap-4 mb-6`. The toggle group is on the left, the Select is on the right.

#### `kpi-cards.tsx`

**Props:**
```typescript
interface KpiCardsProps {
  stats: UsageStats;
}
```

**Behavior:** Renders 4 cards in a row using `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`.

Each card structure:
```tsx
<div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
  <p className="text-sm font-medium text-muted-foreground">{label}</p>
  <p className="text-2xl font-bold mt-1">{primaryValue}</p>
  {delta !== null && (
    <p className={cn("text-sm mt-1", deltaColorClass)}>
      {deltaIcon} {deltaValue} vs prev
    </p>
  )}
  <p className="text-xs text-muted-foreground mt-1">{secondaryValue}</p>
</div>
```

**Card definitions:**

| Card | Label | Primary | Delta | Secondary |
|------|-------|---------|-------|-----------|
| Exchanges | "Exchanges" | `stats.current.total` formatted with `toLocaleString()` | `current.total - compare.total` (absolute, gray) | `stats.current.todayCount` + " today" |
| Error Rate | "Error Rate" | `stats.current.errorRate` + "%" | `current.errorRate - compare.errorRate` + "pp". Red if positive, green if negative. | `stats.current.errors` + " errors" |
| Median Latency | "Median Latency" | `formatDuration(stats.current.medianDuration)` | `current.medianDuration - compare.medianDuration` formatted. Red if positive, green if negative. | "P95: " + `formatDuration(stats.current.p95Duration)` |
| Total Cost | "Total Cost" | "$" + `stats.current.totalCost.toFixed(2)` | "$" + absolute difference (gray) | "$" + `stats.current.todayCost.toFixed(2)` + " today" |

**Delta color rules:**
- Error rate, latency: green if delta < 0 (improvement), red if delta > 0 (regression). Use `text-green-600 dark:text-green-400` and `text-red-600 dark:text-red-400`.
- Exchanges, cost: always `text-muted-foreground` (neutral).
- Arrow: `"\u2191"` (up arrow) if positive, `"\u2193"` (down arrow) if negative.
- When `range === "all"`, do not show delta line.

#### `conversations-table.tsx`

**Props:**
```typescript
interface ConversationsTableProps {
  conversations: ConversationRow[];
  totalCount: number;
  page: number;
  sort: string;
  dir: "asc" | "desc";
  onSort: (column: string) => void;
  onPageChange: (page: number) => void;
}
```

**Behavior:**
- Uses shadcn `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`.
- Renders `ConversationRow` for each item.
- Sortable columns: Time (`created_at`), Turns (`num_turns`), Duration (`duration_ms`), Cost (`cost_usd`). Use inline `SortableHeader` component (defined within this file, following the pattern from `user-overview-table.tsx`).
- Pagination: "Previous" / "Next" buttons below the table with "Page X of Y" center text. Y = `Math.ceil(totalCount / 25)`.
- Row click navigates to `/admin/usage/${row.id}`. Use `router.push()`.
- P75 and P95 for duration heat coloring are computed from the current page's `conversations` data, in this component.

**SortableHeader (inline):**
```typescript
function SortableHeader({
  column,
  label,
  currentSort,
  currentDirection,
  onSort,
  className,
}: {
  column: string;
  label: string;
  currentSort: string;
  currentDirection: "asc" | "desc";
  onSort: (column: string) => void;
  className?: string;
}) {
  const isActive = currentSort === column;
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:bg-muted/50", className)}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentDirection === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    </TableHead>
  );
}
```

**Duration heat coloring:**
```typescript
const durations = conversations
  .map(c => c.durationMs)
  .filter((d): d is number => d !== null)
  .sort((a, b) => a - b);

const p75 = percentile(durations, 0.75);
const p95 = percentile(durations, 0.95);

function durationColorClass(ms: number | null): string {
  if (ms === null || p75 === null || p95 === null) return "";
  if (ms >= p95) return "text-red-600 dark:text-red-400";
  if (ms >= p75) return "text-amber-600 dark:text-amber-400";
  return "";
}
```

#### `conversation-row.tsx`

**Props:**
```typescript
interface ConversationRowProps {
  row: ConversationRow;
  durationColorClass: string;
  onClick: () => void;
}
```

**Behavior:** A single `<TableRow>` with `onClick` and `className="cursor-pointer hover:bg-muted/50"`. Renders all 9 columns.

**Column rendering:**

| Column | Implementation |
|--------|---------------|
| Status | `<StatusDot status={row.status} />` |
| Time | `formatRelativeTime(row.createdAt)` in text. Full date in `<Tooltip>`. |
| User | Truncate email to ~20 chars with ellipsis. Full email in `title` attribute. |
| Project | `row.projectName \|\| "--"` |
| Model | `<Badge>` with color per model. "sonnet" = `bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`, "haiku" = `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`, "opus" = `bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200`. Extract short name from model string (e.g., `model.includes("sonnet")` -> "sonnet"). |
| Turns | `row.numTurns` right-aligned |
| Tools | `row.totalToolCalls !== null ? \`${row.totalToolCalls - row.failedToolCalls}/${row.totalToolCalls}\` : "--"`. Red text class if `row.failedToolCalls > 0`. |
| Duration | `formatDuration(row.durationMs)` with `durationColorClass` applied. |
| Cost | `row.costUsd !== null ? \`$${row.costUsd.toFixed(3)}\` : "--"` |

#### `status-dot.tsx`

**Props:**
```typescript
interface StatusDotProps {
  status: "ok" | "error" | "partial" | "incomplete";
}
```

**Behavior:** Renders a small circle.
- `"ok"`: `<div className="h-2.5 w-2.5 rounded-full bg-green-500" />`
- `"error"`: `<div className="h-2.5 w-2.5 rounded-full bg-red-500" />`
- `"partial"`: `<div className="h-2.5 w-2.5 rounded-full bg-amber-500" />`
- `"incomplete"`: `<div className="h-2.5 w-2.5 rounded-full border-2 border-zinc-400 dark:border-zinc-500" />` (ring, no fill)

**Status derivation (in conversations-table or usage-page-client):**
```typescript
function deriveStatus(row: ConversationRow): "ok" | "error" | "partial" | "incomplete" {
  if (row.durationMs === null) return "incomplete";
  if (row.isError) return "error";
  if (row.failedToolCalls !== null && row.failedToolCalls > 0) return "partial";
  return "ok";
}
```

#### `tool-breakdown-table.tsx`

**Props:**
```typescript
interface ToolBreakdownTableProps {
  tools: ToolBreakdownRow[];
  range: string;
}
```

**Behavior:**
- Section header: `"Tool Breakdown ({range})"` with a `<Separator>` or `border-t` above.
- Standard shadcn Table with 5 columns (Tool, Calls, Errors, P50, P95).
- Tool name in `font-mono text-sm`.
- Errors column: `"{errorCount} ({errorRate}%)"`. Red text class (`text-red-600`) if `errorRate > 5`.
- P95 column: Red text class if value > 5000ms.
- No pagination, no sort (pre-sorted by call count desc from server).
- **Empty state:** When `tools.length === 0`, show: "No tool data yet. Tool observations are recorded after the next deployment." in a muted paragraph.

**Styling note:** Place this section below the conversations table with `mt-8` margin.

### 4.2 Detail Page Components

#### `conversation-detail-client.tsx`

**Props:**
```typescript
interface ConversationDetailClientProps {
  detail: ConversationDetail;
}
```

**Behavior:** Renders `ConversationHeader` and `WaterfallTimeline` vertically. No state management needed beyond what the waterfall handles internally (expand/collapse).

#### `conversation-header.tsx`

**Props:**
```typescript
interface ConversationHeaderProps {
  conversation: ConversationMeta;
}
```

**Behavior:** Key-value pairs laid out in a responsive grid.

```tsx
<div className="space-y-4 mb-8">
  {/* ID row */}
  <div className="flex items-center gap-2">
    <span className="font-mono text-sm text-muted-foreground truncate">
      {conversation.id}
    </span>
    <CopyButton value={conversation.id} label="Copy ID" />
  </div>

  {/* Metadata grid */}
  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm">
    <div><span className="text-muted-foreground">User:</span> {conversation.userEmail || "--"}</div>
    <div><span className="text-muted-foreground">Project:</span> {conversation.projectName || "--"}</div>
    <div><span className="text-muted-foreground">Model:</span> <ModelBadge model={conversation.model} /></div>
    <div><span className="text-muted-foreground">Duration:</span> {formatDuration(conversation.durationMs)}</div>
    <div><span className="text-muted-foreground">Cost:</span> {formatCost(conversation.costUsd)}</div>
    <div><span className="text-muted-foreground">Turns:</span> {conversation.numTurns}</div>
    <div><span className="text-muted-foreground">Status:</span> {conversation.isError ? "Error" : "OK"}</div>
    <div><span className="text-muted-foreground">Auth:</span> {conversation.authMode || "--"}</div>
  </div>

  {/* Created */}
  <div className="text-sm text-muted-foreground">
    Created: {new Date(conversation.createdAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "UTC",
    })} UTC
  </div>

  {/* Tokens */}
  <div className="text-sm">
    <span className="text-muted-foreground">Tokens:</span>{" "}
    {conversation.inputTokens.toLocaleString()} in |{" "}
    {conversation.outputTokens.toLocaleString()} out
    {conversation.cacheReadInputTokens > 0 && (
      <> | {conversation.cacheReadInputTokens.toLocaleString()} cache read</>
    )}
    {conversation.cacheCreationInputTokens > 0 && (
      <> | {conversation.cacheCreationInputTokens.toLocaleString()} cache creation</>
    )}
  </div>

  {/* Sentry link */}
  {conversation.sentryTraceId && (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sentry:</span>
      <span className="font-mono text-xs truncate max-w-[200px]">
        {conversation.sentryTraceId}
      </span>
      <CopyButton value={conversation.sentryTraceId} label="Copy trace ID" />
      <a
        href={`https://effi-ai.sentry.io/performance/trace/${conversation.sentryTraceId}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline dark:text-blue-400 inline-flex items-center gap-1"
      >
        Open in Sentry <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )}
</div>
```

**Sentry constant:** `const SENTRY_ORG_SLUG = "effi-ai";` — hardcoded at the top of the file (or in a shared constants file in the usage directory).

#### `copy-button.tsx`

**Props:**
```typescript
interface CopyButtonProps {
  value: string;
  label?: string; // tooltip text, defaults to "Copy"
}
```

**Behavior:**
- Renders a small button with a `Copy` icon (from `lucide-react`).
- On click, calls `navigator.clipboard.writeText(value)`.
- After copy, changes icon to `Check` for 2 seconds, then reverts.
- Uses `useState` for the copied state and `setTimeout` for revert.
- Size: `h-6 w-6 p-1` with `variant="ghost"` styling.

```tsx
"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ value, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}
```

---

## 5. Waterfall Timeline

This is the hero component. It deserves its own section.

### 5.1 Props Interface

```typescript
// waterfall-timeline.tsx
interface WaterfallTimelineProps {
  totalDurationMs: number;
  turns: WaterfallTurn[];
}

interface WaterfallTurn {
  turnIndex: number;
  durationMs: number;
  textPreview: string | null;
  thinkingPreview: string | null;
  sentryTraceId: string | null;
  isError: boolean; // derived: true if any tool call has error, or if turn itself errored
  toolCalls: WaterfallToolCall[];
}

interface WaterfallToolCall {
  id: string;
  sequence: number;
  toolName: string;
  toolInput: Record<string, unknown> | null;
  resultCount: number | null;
  error: string | null;
  durationMs: number;
}
```

**Derivation from `ConversationDetail`:**
The server action returns `ConversationDetail`. The detail page component transforms it into `WaterfallTimelineProps`:

```typescript
const waterfallProps: WaterfallTimelineProps = {
  totalDurationMs: detail.conversation.durationMs || 0,
  turns: detail.turns.map(({ turn, toolCalls }) => ({
    turnIndex: turn.turn_index,
    durationMs: turn.duration_ms || 0,
    textPreview: turn.text_preview,
    thinkingPreview: turn.thinking_preview,
    sentryTraceId: turn.sentry_trace_id,
    isError: toolCalls.some(tc => tc.error !== null),
    toolCalls: toolCalls.map(tc => ({
      id: tc.id,
      sequence: tc.sequence,
      toolName: tc.tool_name,
      toolInput: tc.tool_input,
      resultCount: tc.result_count,
      error: tc.error,
      durationMs: tc.duration_ms || 0,
    })),
  })),
};
```

### 5.2 Layout Algorithm

The waterfall has two logical columns:
1. **Label area** (~250px, `min-w-[250px]`): Contains turn/tool metadata text.
2. **Timeline area** (flex-1, remaining width): Contains timing bars.

```
[---- Label area (250px) ----][------------ Timeline area (flex-1) ------------]
```

The overall layout uses CSS grid or flex:
```tsx
<div className="space-y-1">
  <TimeAxis totalDurationMs={totalDurationMs} />
  {turns.map(turn => (
    <WaterfallTurnRow key={turn.turnIndex} ... />
  ))}
</div>
```

### 5.3 Positioning Math

All positioning uses percentage of `totalDurationMs`.

```typescript
// Compute cumulative start times for turns
function computeTurnLayout(turns: WaterfallTurn[], totalMs: number) {
  let cumulativeMs = 0;
  return turns.map(turn => {
    const startMs = cumulativeMs;
    const startPct = totalMs > 0 ? (startMs / totalMs) * 100 : 0;
    const widthPct = totalMs > 0 ? (turn.durationMs / totalMs) * 100 : 100;
    cumulativeMs += turn.durationMs;
    return {
      ...turn,
      startPct,
      widthPct: Math.max(widthPct, 0.5), // min 0.5% for visibility
      startMs,
    };
  });
}

// Compute sequential positions for tool calls within a turn
function computeToolLayout(
  toolCalls: WaterfallToolCall[],
  turnStartMs: number,
  totalMs: number,
) {
  let toolCumulativeMs = turnStartMs;
  return toolCalls.map(tool => {
    const startPct = totalMs > 0 ? (toolCumulativeMs / totalMs) * 100 : 0;
    const widthPct = totalMs > 0 ? (tool.durationMs / totalMs) * 100 : 0;
    toolCumulativeMs += tool.durationMs;
    return {
      ...tool,
      startPct,
      widthPct: Math.max(widthPct, 0.5), // min 0.5% (4px min via CSS)
    };
  });
}
```

**Known limitation:** Tool calls are laid out sequentially within each turn. If tools actually ran in parallel, positions are inaccurate. This is acceptable for v1 since we lack explicit start timestamps.

### 5.4 Color Coding

| Element | Success | Error |
|---------|---------|-------|
| Turn bar | `bg-blue-500` | `bg-red-500` |
| Tool bar | `bg-teal-500` | `bg-red-500` |
| Track background | `bg-zinc-100 dark:bg-zinc-800` | Same |

All bars: `rounded-sm`, min-width `4px` (via CSS `min-w-[4px]`).

### 5.5 Sub-Components

#### `time-axis.tsx`

**Props:**
```typescript
interface TimeAxisProps {
  totalDurationMs: number;
}
```

**Behavior:** Renders 5 tick marks at 0%, 25%, 50%, 75%, 100% of totalDurationMs.

```tsx
export function TimeAxis({ totalDurationMs }: TimeAxisProps) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    pct: pct * 100,
    label: formatAxisLabel(totalDurationMs * pct),
  }));

  return (
    <div className="flex items-end mb-2">
      {/* Spacer for label column */}
      <div className="min-w-[250px] shrink-0" />
      {/* Timeline area */}
      <div className="flex-1 relative h-6 border-b border-zinc-200 dark:border-zinc-700">
        {ticks.map(tick => (
          <div
            key={tick.pct}
            className="absolute bottom-0 flex flex-col items-center"
            style={{ left: `${tick.pct}%` }}
          >
            <span className="text-[10px] text-muted-foreground mb-0.5 -translate-x-1/2">
              {tick.label}
            </span>
            <div className="h-2 w-px bg-zinc-300 dark:bg-zinc-600" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Label formatting:**
```typescript
function formatAxisLabel(ms: number): string {
  if (ms === 0) return "0s";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
```

#### `waterfall-turn-row.tsx`

**Props:**
```typescript
interface WaterfallTurnRowProps {
  turn: WaterfallTurn & { startPct: number; widthPct: number; startMs: number };
  totalDurationMs: number;
  defaultExpanded: boolean; // true on initial render
}
```

**Behavior:**
- Click chevron to expand/collapse (toggle visibility of tool call rows beneath it).
- State: `const [expanded, setExpanded] = useState(defaultExpanded)`.
- Turn row is always visible (never collapsed away).

```tsx
<div className="space-y-0.5">
  {/* Turn row */}
  <div className="flex items-center gap-2 group">
    {/* Label area */}
    <div className="min-w-[250px] shrink-0 flex items-center gap-2 pr-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="p-0.5 hover:bg-muted rounded"
      >
        <ChevronRight className={cn(
          "h-4 w-4 transition-transform text-muted-foreground",
          expanded && "rotate-90"
        )} />
      </button>
      <span className="font-mono text-xs text-muted-foreground">TURN {turn.turnIndex}</span>
      <span className="text-sm truncate flex-1">{turn.textPreview || "(no text)"}</span>
      <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
        {formatDuration(turn.durationMs)}
      </span>
      {turn.sentryTraceId && (
        <a
          href={`https://effi-ai.sentry.io/performance/trace/${turn.sentryTraceId}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-blue-600"
          title="Open in Sentry"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
    {/* Timing bar */}
    <div className="flex-1">
      <TimingBar
        startPct={turn.startPct}
        widthPct={turn.widthPct}
        colorClass={turn.isError ? "bg-red-500" : "bg-blue-500"}
        label={`Turn ${turn.turnIndex}: ${formatDuration(turn.durationMs)}`}
      />
    </div>
  </div>

  {/* Thinking preview (visible when expanded) */}
  {expanded && turn.thinkingPreview && (
    <div className="ml-[250px] pl-6 text-xs italic text-muted-foreground truncate">
      [thinking] {turn.thinkingPreview}
    </div>
  )}

  {/* Tool call rows (visible when expanded) */}
  {expanded && turn.toolCalls.map(tool => (
    <WaterfallToolRow
      key={tool.id}
      tool={tool}
      turnIndex={turn.turnIndex}
      totalDurationMs={totalDurationMs}
    />
  ))}

  {/* No tool calls message */}
  {expanded && turn.toolCalls.length === 0 && (
    <div className="ml-[250px] pl-6 text-xs text-muted-foreground">(no tool calls)</div>
  )}
</div>
```

#### `waterfall-tool-row.tsx`

**Props:**
```typescript
interface WaterfallToolRowProps {
  tool: WaterfallToolCall & { startPct: number; widthPct: number };
  turnIndex: number;
  totalDurationMs: number;
}
```

**Behavior:**
- Indented under parent turn (left padding in label area).
- Click anywhere on the row to toggle inline detail panel.
- State: `const [expanded, setExpanded] = useState(false)`.

```tsx
<div className="space-y-0">
  {/* Tool row */}
  <div
    className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded-sm py-0.5"
    onClick={() => setExpanded(!expanded)}
  >
    {/* Label area (indented) */}
    <div className="min-w-[250px] shrink-0 flex items-center gap-2 pr-2 pl-8">
      <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="font-mono text-xs truncate">{tool.toolName}</span>
      <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
        {formatDuration(tool.durationMs)}
      </span>
      {tool.error ? (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
          ERR
        </span>
      ) : (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          OK
        </span>
      )}
      {tool.error === null && tool.resultCount !== null && (
        <span className="text-xs text-muted-foreground">{tool.resultCount}</span>
      )}
    </div>
    {/* Timing bar */}
    <div className="flex-1">
      <TimingBar
        startPct={tool.startPct}
        widthPct={tool.widthPct}
        colorClass={tool.error ? "bg-red-500" : "bg-teal-500"}
        label={`${tool.toolName}: ${formatDuration(tool.durationMs)}`}
      />
    </div>
  </div>

  {/* Inline detail panel */}
  {expanded && (
    <ToolDetailPanel
      tool={tool}
      turnIndex={turnIndex}
    />
  )}
</div>
```

#### `timing-bar.tsx`

**Props:**
```typescript
interface TimingBarProps {
  startPct: number;
  widthPct: number;
  colorClass: string; // e.g. "bg-blue-500", "bg-teal-500", "bg-red-500"
  label: string; // for aria-label and tooltip
}
```

**Behavior:** A small horizontal bar positioned within a track.

```tsx
export function TimingBar({ startPct, widthPct, colorClass, label }: TimingBarProps) {
  return (
    <div
      className="relative h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-sm"
      title={label}
    >
      <div
        className={cn(
          "absolute h-full rounded-sm min-w-[4px]",
          colorClass,
        )}
        style={{
          left: `${startPct}%`,
          width: `${widthPct}%`,
        }}
        role="img"
        aria-label={label}
      />
    </div>
  );
}
```

#### `tool-detail-panel.tsx`

**Props:**
```typescript
interface ToolDetailPanelProps {
  tool: WaterfallToolCall;
  turnIndex: number;
}
```

**Behavior:** An inline expansion panel shown when a tool call row is clicked.

```tsx
export function ToolDetailPanel({ tool, turnIndex }: ToolDetailPanelProps) {
  return (
    <div className="ml-8 mr-4 mb-2 border rounded-lg bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">{tool.toolName}</span>
          <span className="text-xs text-muted-foreground">
            (Turn {turnIndex}, Seq {tool.sequence})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatDuration(tool.durationMs)}
          </span>
          {tool.error ? (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
              ERROR
            </span>
          ) : (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              OK
            </span>
          )}
        </div>
      </div>

      {/* Error (shown first if present, above input) */}
      {tool.error && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-red-600 dark:text-red-400">Error</span>
            <CopyButton value={tool.error} label="Copy error" />
          </div>
          <pre className="text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-48">
            {tool.error}
          </pre>
        </div>
      )}

      {/* Input */}
      {tool.toolInput && Object.keys(tool.toolInput).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Input</span>
            <CopyButton value={JSON.stringify(tool.toolInput, null, 2)} label="Copy input" />
          </div>
          <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 border rounded p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-64">
            {JSON.stringify(tool.toolInput, null, 2)}
          </pre>
        </div>
      )}

      {/* Results */}
      <div className="text-xs text-muted-foreground">
        Results: {tool.resultCount !== null ? tool.resultCount : "--"}
      </div>
    </div>
  );
}
```

### 5.6 Interaction States

| State | Behavior |
|-------|----------|
| **Page load** | All turns expanded (showing tool call rows). No tool detail panels open. |
| **Collapse turn** | Click chevron. Tool rows and thinking preview under that turn disappear. Turn row + timing bar remain visible. |
| **Expand tool** | Click tool row. `ToolDetailPanel` appears inline below the tool row. |
| **Hover timing bar** | Native `title` attribute shows duration string. |

### 5.7 Edge Cases

| Case | Handling |
|------|----------|
| **totalDurationMs = 0** | All bars get 100% width. Time axis shows "0s" at all ticks. |
| **totalDurationMs = null** | Show message: "Duration not recorded. Stream may not have completed." No waterfall rendered. |
| **No turns** | Show message: "No turn data recorded for this conversation." |
| **Turn with durationMs = 0** | Bar gets minimum 0.5% width (min 4px via CSS). Still clickable. |
| **Tool with durationMs = 0** | Same minimum width treatment. |
| **Only one turn, no tools** | Single turn bar spanning full width. "(no tool calls)" message below. |
| **Cumulative turn durations exceed totalDurationMs** | Bars may overflow past 100%. Clip with `overflow-hidden` on the timeline container. This can happen due to measurement imprecision. |
| **tool_input is `'{}'` (empty)** | Show "Input: (empty)" instead of the `<pre>` block. |
| **tool_input is null** | Show "Input: --". |

---

## 6. Data Types

All TypeScript interfaces for data flowing between server actions and components.

**File:** Define these in `nextjs-app/app/actions/admin-usage.ts` (server action file) and export them. Components import types from there.

```typescript
// === Response wrapper ===
export interface AdminUsageResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// === Stats ===
export interface PeriodStats {
  total: number;
  errors: number;
  errorRate: number; // percentage, e.g. 2.1
  medianDuration: number | null; // ms
  p95Duration: number | null; // ms
  totalCost: number; // USD
  todayCount: number;
  todayCost: number; // USD
}

export interface UsageStats {
  current: PeriodStats;
  compare: PeriodStats | null; // null when range="all"
}

// === Conversations Table ===
export interface ConversationRow {
  id: string;
  createdAt: string; // ISO 8601
  model: string;
  numTurns: number;
  durationMs: number | null;
  costUsd: number | null;
  isError: boolean;
  userId: string;
  userEmail: string | null;
  projectId: string | null;
  projectName: string | null;
  totalToolCalls: number | null; // null if no tool data exists
  failedToolCalls: number | null;
}

export interface ConversationsPage {
  conversations: ConversationRow[];
  totalCount: number;
  page: number;
  pageSize: number; // always 25
}

// === Tool Breakdown ===
export interface ToolBreakdownRow {
  toolName: string;
  callCount: number;
  errorCount: number;
  errorRate: number; // percentage
  p50Ms: number | null;
  p95Ms: number | null;
}

// === Project Options ===
export interface ProjectOption {
  id: string;
  name: string;
}

// === Conversation Detail ===
export interface ConversationMeta {
  id: string;
  createdAt: string;
  model: string;
  numTurns: number;
  durationMs: number | null;
  durationApiMs: number | null;
  costUsd: number | null;
  isError: boolean;
  userId: string;
  userEmail: string | null;
  projectId: string | null;
  projectName: string | null;
  authMode: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  claudeSessionId: string | null;
  sentryTraceId: string | null; // first available from turns
}

export interface TurnRow {
  id: string;
  agentUsageId: string;
  turnIndex: number;
  textPreview: string | null;
  thinkingPreview: string | null;
  toolCallCount: number;
  durationMs: number | null;
  sentryTraceId: string | null;
  createdAt: string;
}

export interface ToolObservationRow {
  id: string;
  turnId: string;
  sequence: number;
  toolName: string;
  toolInput: Record<string, unknown>;
  resultCount: number | null;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface ConversationDetail {
  conversation: ConversationMeta;
  turns: Array<{
    turn: TurnRow;
    toolCalls: ToolObservationRow[];
  }>;
}
```

**Important:** The Supabase client returns snake_case column names. The server action must transform to camelCase before returning. Do this mapping explicitly in the server action:

```typescript
function mapConversationRow(raw: any): ConversationRow {
  return {
    id: raw.id,
    createdAt: raw.created_at,
    model: raw.model,
    numTurns: raw.num_turns,
    durationMs: raw.duration_ms,
    costUsd: raw.cost_usd ? Number(raw.cost_usd) : null,
    isError: raw.is_error,
    userId: raw.user_id,
    userEmail: null, // filled in later
    projectId: raw.project_id,
    projectName: null, // filled in later
    totalToolCalls: null, // filled in later
    failedToolCalls: null, // filled in later
  };
}
```

Same pattern for `TurnRow` and `ToolObservationRow`. The `cost_usd` column is `NUMERIC(10,6)` which Supabase returns as a string — parse with `Number()`.

---

## 7. Integration Points

### 7.1 Admin Hub Card

**File:** `nextjs-app/app/admin/page.tsx`

Add `Activity` to the lucide-react imports:
```diff
import {
  ArrowLeft,
+ Activity,
  Database,
  HardDrive,
  MessageSquare,
  Users,
} from "lucide-react";
```

Add to `adminPages` array (at the end, or in a logical position):
```typescript
{
  title: "Usage",
  description: "Agent usage, latency, cost, and tool analytics",
  href: "/admin/usage",
  icon: Activity,
  gradient: "from-amber-600 to-orange-600",
},
```

### 7.2 Admin FAB Petal

**File:** `nextjs-app/components/admin-fab.tsx`

Add `Activity` to the lucide-react imports:
```diff
import {
  ArrowLeft,
+ Activity,
  Database,
  HardDrive,
  MessageSquare,
  ShieldCheck,
  ToggleLeft,
  Users,
} from "lucide-react";
```

Add to `petals` array:
```typescript
{ route: "/admin/usage", icon: Activity, label: "Usage" },
```

---

## 8. Edge Cases & Empty States

### Main Page

| Condition | What to show |
|-----------|-------------|
| **No agent_usage rows in time range** | KPI cards all show 0 / "--" / "$0.00". Conversations table shows "No conversations found for this time range." Tool breakdown shows "No tool data yet." |
| **No tool_observations at all** | Tools column in conversations table shows "--" for every row. Tool breakdown section shows: "No tool data yet. Tool observations are recorded after the next deployment." |
| **No turns data** | Does not affect the main page (turns are only used on the detail page). |
| **cost_usd is null** | Show "--" in Cost column. Exclude from KPI aggregation (treat as 0 for sum). |
| **duration_ms is null** | Show "--" in Duration column. Exclude from percentile computation. Status dot shows "incomplete" (gray ring). |
| **Project filter returns 0 results** | Same empty state as "no rows in time range." |
| **Server action fails** | Show a red alert at the top of the page: "Failed to load usage data: {error message}". |

### Detail Page

| Condition | What to show |
|-----------|-------------|
| **Conversation not found** | Server component calls `notFound()` — renders Next.js 404 page. |
| **No turns** | Show conversation header. Where waterfall would be: "No turn data recorded for this conversation." |
| **No tool observations for any turn** | Waterfall shows turns with their timing bars. Each expanded turn shows "(no tool calls)". |
| **duration_ms is null on conversation** | Show "Duration: --" in header. Waterfall: "Duration not recorded. Stream may not have completed." |
| **All token counts are 0** | Show "Tokens: 0 in | 0 out" (still show the row). |
| **No sentry_trace_id on any turn** | Omit the Sentry section entirely from the conversation header. |
| **tool_input is empty `{}`** | In the detail panel: "Input: (empty)" in muted text instead of `<pre>` block. |

---

## 9. Utility Functions

Define shared formatting utilities. Place in `nextjs-app/components/admin/usage/utils.ts` (not a component, just helpers):

```typescript
/**
 * Format milliseconds into a human-readable duration.
 * Returns "--" for null.
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "--";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Format cost as USD string.
 * Returns "--" for null.
 */
export function formatCost(usd: number | null): string {
  if (usd === null) return "--";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/**
 * Format a date as relative time (e.g., "2h ago", "3d ago").
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Compute a percentile from a sorted array of numbers.
 * Returns null for empty arrays.
 */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Compute range start date from a range string.
 * Returns null for "all".
 */
export function computeRangeStart(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "all":
      return null;
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Compute comparison period dates from a range string.
 * Returns null for "all".
 */
export function computeComparisonRange(range: string): { start: Date; end: Date } | null {
  const rangeStart = computeRangeStart(range);
  if (!rangeStart) return null;

  const now = new Date();
  const periodMs = now.getTime() - rangeStart.getTime();
  return {
    start: new Date(rangeStart.getTime() - periodMs),
    end: rangeStart,
  };
}

/**
 * Extract short model name for badge display.
 */
export function shortModelName(model: string): string {
  if (model.includes("opus")) return "opus";
  if (model.includes("sonnet")) return "sonnet";
  if (model.includes("haiku")) return "haiku";
  return model;
}
```

---

## 10. Implementation Order

Build in this order for the fastest feedback loop (each step produces visible output):

### Step 1: Scaffolding + Integration Points
1. Create directory structure: `nextjs-app/app/admin/usage/`, `nextjs-app/app/admin/usage/[id]/`, `nextjs-app/components/admin/usage/`, `nextjs-app/components/admin/usage/detail/`.
2. Add the hub card to `admin/page.tsx` and the FAB petal to `admin-fab.tsx`.
3. Create the two `page.tsx` server components with auth guards and placeholder content ("Usage page coming soon", "Detail page coming soon").
4. **Verify:** Navigate to `/admin`, see the Usage card. Click through to `/admin/usage`, see placeholder. Admin FAB shows Usage petal.

### Step 2: Server Actions + Data Types
1. Create `admin-usage.ts` with all type definitions.
2. Implement `verifyAdmin()` helper.
3. Implement `getUsageStats()` — the simplest action (single table, aggregate in TypeScript).
4. Implement `getProjectOptions()`.
5. Implement `getConversations()` — the most complex action (multi-table, pagination).
6. Implement `getToolBreakdown()`.
7. Implement `getConversationDetail()`.
8. **Verify:** Call actions from page.tsx, log results to console. Confirm data shape.

### Step 3: Main Page — Filter Bar + KPI Cards
1. Create `utils.ts` with all formatting/utility functions.
2. Create `filter-bar.tsx`.
3. Create `kpi-cards.tsx`.
4. Create `usage-page-client.tsx` that renders FilterBar + KpiCards (without table yet).
5. Wire up the main page server component to call actions and pass data.
6. **Verify:** See KPI cards with real data. Toggle time ranges and see values change.

### Step 4: Main Page — Conversations Table
1. Create `status-dot.tsx`.
2. Create `conversation-row.tsx`.
3. Create `conversations-table.tsx` with sort and pagination.
4. Add to `usage-page-client.tsx`.
5. **Verify:** See sortable, paginated table with real data. Click rows to navigate.

### Step 5: Main Page — Tool Breakdown
1. Create `tool-breakdown-table.tsx`.
2. Add to `usage-page-client.tsx`.
3. **Verify:** See tool metrics below the conversations table.

### Step 6: Detail Page — Header
1. Create `copy-button.tsx`.
2. Create `conversation-header.tsx`.
3. Create `conversation-detail-client.tsx` with header only.
4. Wire up the detail page server component.
5. **Verify:** Click a conversation row, see metadata + Sentry link.

### Step 7: Detail Page — Waterfall Timeline (The Big One)
1. Create `timing-bar.tsx` (simplest sub-component).
2. Create `time-axis.tsx`.
3. Create `tool-detail-panel.tsx`.
4. Create `waterfall-tool-row.tsx`.
5. Create `waterfall-turn-row.tsx`.
6. Create `waterfall-timeline.tsx` (orchestrator).
7. Add to `conversation-detail-client.tsx`.
8. **Verify:** See the full waterfall with expand/collapse and inline tool details.

### Step 8: Polish
1. Dark mode pass — verify all components look correct in dark mode.
2. Empty states — test with no data, no tools, null durations.
3. Responsive check — verify layout at narrow widths.
4. Accessibility — `aria-expanded`, `aria-label` on timing bars, keyboard navigation on turn chevrons.

---

## Appendix A: Sentry Constants

```typescript
// Used in conversation-header.tsx and waterfall-turn-row.tsx
const SENTRY_ORG_SLUG = "effi-ai";
const SENTRY_TRACE_URL = (traceId: string) =>
  `https://${SENTRY_ORG_SLUG}.sentry.io/performance/trace/${traceId}/`;
```

Place this in `utils.ts` or a constants file within the usage directory.

## Appendix B: URL State Schema

All filter state lives in URL search params on the main page:

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `range` | `"24h" \| "7d" \| "30d" \| "all"` | `"7d"` | Time range preset |
| `project` | UUID string | (absent) | Project filter. Absent = all projects. |
| `sort` | `"created_at" \| "num_turns" \| "duration_ms" \| "cost_usd"` | `"created_at"` | Sort column |
| `dir` | `"asc" \| "desc"` | `"desc"` | Sort direction |
| `page` | positive integer | `1` | 1-based page number |

The detail page has no URL search params (path param `[id]` only). Expanded tool calls are client-side state only.

## Appendix C: Sort Column Whitelist

To prevent SQL injection, the server action must validate the `sort` parameter against a whitelist:

```typescript
const ALLOWED_SORT_COLUMNS = new Set(["created_at", "num_turns", "duration_ms", "cost_usd"]);

function validateSortColumn(sort: string): string {
  return ALLOWED_SORT_COLUMNS.has(sort) ? sort : "created_at";
}
```

## Appendix D: Dependencies

**No new npm dependencies.** All visualization is pure CSS + Tailwind.

Uses only what is already installed:
- `@supabase/supabase-js` — database queries
- `@sentry/nextjs` — server action instrumentation
- `lucide-react` — icons (`Activity`, `ArrowLeft`, `ArrowUp`, `ArrowDown`, `ArrowUpDown`, `ChevronRight`, `Copy`, `Check`, `ExternalLink`, `Wrench`)
- `next/navigation` — `useRouter`, `useSearchParams`, `usePathname`
- shadcn/ui components: `Table`, `Badge`, `Button`, `Select`, `Separator`
- `@/lib/utils` — `cn()` utility
