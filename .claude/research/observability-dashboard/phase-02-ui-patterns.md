# Phase 02: UI Patterns Research

Research into the Next.js app UI patterns, component library, layout conventions, data fetching,
auth/admin guards, and styling system. Conducted to inform the design of a new admin observability dashboard.

---

## 1. Admin/Analytics Pages

### Existing Admin Routes

The app has a full admin section at `/admin/` with four sub-pages:

| Route | Purpose | Component Style |
|---|---|---|
| `/admin` | Hub page with card links to sub-pages | Server component |
| `/admin/users` | User management, invitations, tier settings | Server page + client table |
| `/admin/chat` | Model selection, auth mode, prompt versions | Server page + client controls |
| `/admin/gfs` | Google File Search store health/sync | Server page + client tabs/tables |
| `/admin/drive` | Drive connections, file pipeline, events | Server page + client panel |
| `/toggles` | Feature toggles (system + browser flags) | Server page + client toggles |

### Admin Hub Pattern (`/admin/page.tsx`)

The admin index page defines a typed array of admin pages and renders them as a 2-column card grid:

```tsx
const adminPages = [
  {
    title: "User Management",
    description: "Invitations, user overview, tier settings",
    href: "/admin/users",
    icon: Users,
    gradient: "from-blue-600 to-purple-600",
  },
  // ... more entries
];
```

Each card uses a gradient-colored icon badge, title, and description. This is the pattern a new
dashboard card would follow to integrate into the admin hub.

### Admin FAB (Floating Action Button)

File: `nextjs-app/components/admin-fab.tsx`

A draggable floating button rendered in the root layout for admin users. It expands radially
("sunflower" pattern) to show quick links to all admin pages. Position persists in localStorage.

The FAB is rendered conditionally in `app/layout.tsx`:
```tsx
<AdminFab isAdmin={isAdmin} />
```

A new admin page should add an entry to the `petals` array in `admin-fab.tsx`:
```tsx
const petals: Petal[] = [
  { route: "/admin/users", icon: Users, label: "Users" },
  { route: "/admin/chat", icon: MessageSquare, label: "Chat" },
  { route: "/admin/gfs", icon: Database, label: "GFS" },
  { route: "/admin/drive", icon: HardDrive, label: "Drive" },
  { route: "/toggles", icon: ToggleLeft, label: "Toggles" },
];
```

### No Usage Dashboards or Analytics Views Yet

There are no existing analytics, metrics, or observability dashboards. The admin pages are all
operational (CRUD, config toggles, health checks). An observability dashboard would be the first
analytics-style view.

---

## 2. Layout Patterns

### Route Organization

```
app/
  layout.tsx                          # Root layout (fonts, Toaster, SentryUserSync, AdminFab)
  page.tsx                            # Landing/redirect
  sign-in/page.tsx                    # Auth
  accept-terms/page.tsx               # Legal
  privacy-policy/page.tsx             # Legal
  open-source-attribution/page.tsx    # Legal
  toggles/page.tsx                    # Feature flags (accessible without workspace)
  admin/                              # Admin section (no nested layout)
    page.tsx                          # Admin hub
    users/page.tsx                    # User management
    chat/page.tsx                     # Chat config
    gfs/page.tsx                      # GFS admin
    drive/page.tsx                    # Drive admin
  workspaces/
    [workspaceId]/
      layout.tsx                      # Sidebar layout (WorkspaceLayoutClient)
      page.tsx                        # Workspace detail
      settings/page.tsx               # Workspace settings
  projects/
    [projectId]/
      layout.tsx                      # Also uses sidebar layout (re-uses WorkspaceLayoutClient)
      page.tsx                        # Project detail
      chat/page.tsx                   # Chat interface
      config/page.tsx                 # Project config
  (standalone)/
    layout.tsx                        # Separate HTML root (no Supabase, no Sentry)
    email-rules/page.tsx              # Standalone experiment
  auth/
    invite/page.tsx                   # Invite flow
    project-invite/page.tsx
    workspace-invite/page.tsx
  api/
    health/route.ts
    supabase-health/route.ts
    chat/stream/route.ts              # SSE proxy to Python API
    drive/callback/route.ts
    webhooks/mailgun/inbound/route.ts
    webhooks/test-sse/[delay]/route.ts
```

### Root Layout (`app/layout.tsx`)

Server component. Provides:
- Three font families: DM Sans (`--font-dm-sans`), Geist Sans (`--font-geist-sans`), Geist Mono (`--font-geist-mono`)
- `<Toaster>` from sonner for toast notifications
- `<SentryUserSync />` for Sentry user identification
- `<AdminFab isAdmin={isAdmin} />` conditionally shown
- Admin check: queries `admins` table via Supabase
- Environment tag in title: `[DEV]`, `[STG]`, or empty

### Workspace Layout (`workspaces/[workspaceId]/layout.tsx`)

Server component that:
1. Authenticates user, redirects to `/sign-in` if not logged in
2. Fetches workspace, projects, workspaces list, sidebar state, tier limits in parallel via `Promise.all`
3. Wraps children in `<WorkspaceDataProvider>` (React context)
4. Wraps in `<WorkspaceLayoutClient>` (sidebar + main area)

### WorkspaceLayoutClient (`components/workspace-layout-client.tsx`)

Client component providing the sidebar layout:
```tsx
<div className="min-h-screen bg-effi-background">
  <WorkspaceSidebar ... />
  <main className={cn(
    "min-h-screen transition-all duration-300 ease-in-out border-l border-effi-border",
    isCollapsed ? "pl-20" : "pl-64"
  )}>
    {children}
  </main>
</div>
```

Sidebar state (collapsed/expanded) persists via cookie.

### Admin Pages Layout Pattern (NO Nested Layout)

Admin pages do NOT use a shared layout.tsx. Each admin page independently renders:
1. A full-page background gradient wrapper
2. A sticky header with back navigation
3. A container-width main area

Repeated header pattern across all admin pages:
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
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-{color}-600 to-{color}-600 flex items-center justify-center">
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Page Title
            </h1>
            <p className="text-xs text-muted-foreground">Subtitle</p>
          </div>
        </div>
      </div>
    </div>
  </header>

  <main className="container mx-auto py-8 px-6">
    <div className="max-w-{width} mx-auto">
      {/* Page content */}
    </div>
  </main>
</div>
```

**Key observation:** A new admin page should follow this exact pattern for visual consistency.
Max widths vary: `max-w-2xl` (chat), `max-w-3xl` (hub), `max-w-4xl` (invitation form),
`max-w-6xl` (GFS, drive), `max-w-7xl` (users). An observability dashboard with tables and
charts would likely use `max-w-7xl` or no max-width constraint.

### Standalone Layout (`(standalone)/layout.tsx`)

Separate HTML document root with no Supabase/Sentry integration. Used for experiments.
Not relevant for the observability dashboard.

---

## 3. UI Component Library

### Component System: shadcn/ui (New York style)

Confirmed by `components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide"
}
```

### Available UI Components (`components/ui/`)

| Component | File | Notes |
|---|---|---|
| Alert | `alert.tsx` | |
| Avatar | `avatar.tsx` | |
| Badge | `badge.tsx` | With `effi` variants |
| Button | `button.tsx` | With `effi`, `effi-secondary`, `effi-ghost` variants |
| Card | `card.tsx` | With `effi` variant, uses CVA |
| Chat Input | `chat-input.tsx` | Specialized |
| Context Card | `context-card.tsx` | |
| Dialog | `dialog.tsx` | Radix-based |
| Dropdown Menu | `dropdown-menu.tsx` | Radix-based |
| Input | `input.tsx` | |
| Label | `label.tsx` | |
| Parallax Background | `parallax-background.tsx` | |
| Progress | `progress.tsx` | Radix-based |
| Project Card | `project-card.tsx` | Specialized |
| Search Input | `search-input.tsx` | |
| Select | `select.tsx` | Radix-based, full component suite |
| Separator | `separator.tsx` | |
| Sheet | `sheet.tsx` | Radix-based (mobile sidebar) |
| Sidebar | `sidebar.tsx` | Full shadcn sidebar system |
| Skeleton | `skeleton.tsx` | |
| Switch | `switch.tsx` | |
| Table | `table.tsx` | Full table system (Table, Header, Body, Row, Head, Cell, Footer, Caption) |
| Tabs | `tabs.tsx` | Radix-based |
| Textarea | `textarea.tsx` | |
| Toggle Card | `toggle-card.tsx` | |
| Tooltip | `tooltip.tsx` | Radix-based |

### Component Patterns

**CVA (class-variance-authority):** Used for variant-based components (Button, Badge, Card, Sidebar menu button).

**Radix UI primitives:** Foundation for Select, Tabs, Dialog, Dropdown, Tooltip, Progress, Avatar, Sheet.

**Data-slot attributes:** All components use `data-slot="component-name"` for testing/styling hooks.

**cn utility:** Standard `clsx` + `tailwind-merge` pattern at `lib/utils.ts`.

### Table Pattern (Used Extensively in Admin)

Tables are built with the base `Table` components from shadcn plus custom patterns:

1. **SortableHeader** - inline component defined per-page (not shared):
```tsx
function SortableHeader({ column, label, currentSort, currentDirection, onSort, className }) {
  const isActive = currentSort === column;
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:bg-muted/50", className)}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    </TableHead>
  );
}
```

2. **Pagination** - custom per-component, typically:
```tsx
<div className="flex items-center justify-between mt-4">
  <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={...}>Previous</Button>
  <span className="text-sm text-muted-foreground">Page {n}</span>
  <Button variant="outline" size="sm" onClick={handleNextPage} disabled={...}>Next</Button>
</div>
```

3. **Search/Filter** - Input with Search icon:
```tsx
<div className="relative flex-1 max-w-sm">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input type="text" placeholder="Search..." value={searchQuery} onChange={...} className="pl-9" />
</div>
```

4. **Status badges** - custom per domain with color-coded Badge components.

### Chart/Visualization Components: NONE

No charting library is installed. No recharts, d3, chart.js, or vizcera in dependencies.
The CSS does define chart color tokens (`--chart-1` through `--chart-5`) which are part of
the shadcn/ui theme, but no charting components exist yet.

**For the observability dashboard:** Would need to add `recharts` (shadcn/ui's recommended
charting library) or build simple visualizations with Tailwind + CSS.

### Icons: Lucide React

All icons come from `lucide-react` (v0.562.0). Common patterns:
- `className="h-4 w-4"` for inline
- `className="h-5 w-5"` for card/header icons
- Used inside gradient icon badges in admin pages

---

## 4. Data Fetching Patterns

### Server Components with Server Actions

The dominant pattern is:

1. **Page (Server Component)** fetches initial data via server actions or direct Supabase queries
2. **Client Component** receives data as props and handles interactivity

Example from GFS admin:
```tsx
// Server page fetches data
export default async function GfsAdminPage() {
  const storesResponse = await getGfsStores();
  const stores = storesResponse.success ? storesResponse.data.stores : [];
  return <GfsAdminTabs stores={stores} />;
}
```

### Server Actions (`app/actions/`)

All admin actions follow this pattern:
```tsx
"use server";

import { createClient } from "@/lib/supabase/server";

export async function getXxx(): Promise<AdminResponse<T>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: adminRecord } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!adminRecord) return { success: false, error: "Admin access required" };

  // Actual data fetching...
  return { success: true, data: result };
}
```

**Sentry instrumentation** is used in some actions:
```tsx
return Sentry.withServerActionInstrumentation(
  "actionName",
  { headers: await headers(), recordResponse: true },
  async () => { /* action body */ }
);
```

### Response Pattern

Consistent `{ success: boolean; data?: T; error?: string }` pattern across admin actions:
```tsx
interface AdminGfsResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Client-Side Refresh

Client components call server actions directly for refresh:
```tsx
const handleRefreshAll = useCallback(async () => {
  setIsLoading(true);
  const result = await getGfsStores(currentPageToken);
  if (result.success) {
    setStores(result.data.stores);
  }
  setIsLoading(false);
}, []);
```

### Real-Time via Supabase Channels

The user overview table subscribes to real-time changes:
```tsx
const channel = supabase
  .channel("admin-invitations-changes")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "admin_invitations",
  }, () => { refreshUsers(); })
  .subscribe();
```

### API Client for Python Service

File: `nextjs-app/lib/api-client.ts`

Used for server-to-server communication with the Python API:
```tsx
export function getPythonApiUrl(): string {
  return process.env.PYTHON_API_PRIVATE_URL || process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:8000";
}
```

GFS admin actions use this to call Python endpoints with user access tokens:
```tsx
const response = await fetchAdminGfsStores(session.access_token, user.id, pageToken);
```

### Supabase Query Patterns

**Direct Supabase queries** (common in page components and actions):
```tsx
const supabase = await createClient();
const { data, error } = await supabase
  .from("table_name")
  .select("columns")
  .eq("filter", value)
  .single();
```

**RPC calls** for complex queries:
```tsx
const { data, error } = await supabase.rpc("function_name", { params });
```

**Promise.all for parallel fetches** (common in layouts):
```tsx
const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()]);
```

---

## 5. Auth/Admin Patterns

### Middleware (`lib/supabase/middleware.ts`)

The middleware:
1. Refreshes Supabase auth session on every request
2. Redirects unauthenticated users to `/sign-in` (except public routes)
3. Checks terms & conditions acceptance if enforcement toggle is enabled
4. Public routes: `/sign-in`, `/auth`, `/toggles`, `/api/webhooks`, `/privacy-policy`, `/privacy`, `/open-source-attribution`

**Note:** No middleware file exists at `nextjs-app/middleware.ts` -- the middleware is at
`lib/supabase/middleware.ts` and is likely imported from a middleware.ts elsewhere or
integrated into the Next.js config. Admin routes are NOT in the public routes list,
so they require authentication.

### Admin Access Check Pattern

Every admin page and action repeats the same guard:

```tsx
// 1. Get authenticated user
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/sign-in");

// 2. Check admin table
const { data: adminRecord } = await supabase
  .from("admins")
  .select("id")
  .eq("user_id", user.id)
  .single();
if (!adminRecord) notFound();
```

**There is no shared middleware or wrapper for admin access.** Each page independently checks
the `admins` table. This is important for the observability dashboard -- it would need to
replicate this pattern.

The `admins` table is a simple user_id lookup table. If a user's ID is in the table, they
are an admin.

### Root Layout Admin Check

The root layout also checks admin status (for the AdminFab):
```tsx
let isAdmin = false;
try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: adminRecord } = await supabase
      .from("admins").select("id").eq("user_id", user.id).single();
    isAdmin = !!adminRecord;
  }
} catch { /* Layout must never crash */ }
```

### Supabase Client Types (Branded)

File: `lib/supabase/types.ts`

```tsx
export type AdminClient = SupabaseClient & { readonly [AdminBrand]: true };  // bypasses RLS
export type AuthClient = SupabaseClient & { readonly [AuthBrand]: true };    // goes through RLS
```

- `createClient()` from `lib/supabase/server.ts` returns `AuthClient` (anon key + session)
- All admin pages use `AuthClient` -- they go through RLS
- The admin check is an application-level check, not a database-level one

---

## 6. Styling

### Tailwind CSS v4

Using Tailwind CSS v4 via PostCSS (`@tailwindcss/postcss`). No `tailwind.config.ts` file --
configuration is done via CSS `@theme` directives in `globals.css`.

### Design System: Dual System

The app has **two design systems** coexisting:

1. **shadcn/ui default** - neutral base colors using oklch, used in admin pages
2. **Effi Design System** - custom branded colors, used in workspace/project pages

### CSS Custom Properties (`globals.css`)

**shadcn/ui tokens (oklch-based):**
```css
--background, --foreground, --card, --popover, --primary, --secondary,
--muted, --accent, --destructive, --border, --input, --ring,
--chart-1 through --chart-5,
--sidebar, --sidebar-foreground, --sidebar-primary, etc.
```

**Effi Design System tokens:**
```css
--effi-primary: #1560BD;
--effi-primary-foreground: #FFFFFF;
--effi-deep-denim: #102E4A;
--effi-background: #FAFBFD;
--effi-gray-text: #646A83;
--effi-border: #E2E6F2;
--effi-card-fill: #F3F1EF;
--effi-accent-orange: #F3693E;
--effi-accent-cyan: #26C2FA;
--effi-gold: #F2BB41;

/* Effi border radii */
--effi-radius-button: 0.5rem;
--effi-radius-card: 0.75rem;
--effi-radius-pill: 1.875rem;

/* Effi typography sizes */
--effi-text-xs through --effi-text-xl

/* Effi spacing */
--effi-space-1 through --effi-space-7
```

### Admin Pages Use shadcn/ui Default System

Admin pages use the zinc/neutral palette with gradient backgrounds:
```tsx
className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950"
```

Headers use backdrop blur:
```tsx
className="border-b bg-white/80 backdrop-blur-md dark:bg-zinc-950/80 shadow-sm sticky top-0 z-50"
```

Cards use the default (non-effi) variant. This is the correct system for a new admin page.

### Dark Mode

Dark mode is defined via `.dark` class selector. Admin pages include dark mode classes
throughout (e.g., `dark:bg-zinc-950/80`, `dark:text-zinc-100`). The observability dashboard
should include dark mode variants.

### Fonts

Three font families available:
- **DM Sans** (`font-effi`) - Effi brand font, used in Effi-variant components
- **Geist Sans** (`font-sans`) - Default body font
- **Geist Mono** (`font-mono`) - Monospace font, used for IDs, hashes, code

### Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `class-variance-authority` | ^0.7.1 | Variant-based component styling |
| `clsx` | ^2.1.1 | Conditional classnames |
| `tailwind-merge` | ^3.4.0 | Tailwind class deduplication |
| `lucide-react` | ^0.562.0 | Icon library |
| `sonner` | ^2.0.7 | Toast notifications |
| `@radix-ui/*` | Various | Primitive UI components |
| `tw-animate-css` | ^1.4.0 | Animation utilities |
| `@tailwindcss/typography` | ^0.5.19 | Prose styling |

---

## Summary: Key Patterns for the Observability Dashboard

### Must Follow

1. **Admin guard pattern**: Check `admins` table in server component, `redirect`/`notFound` for unauthorized
2. **Page structure**: `bg-gradient-to-br from-zinc-50...` wrapper, sticky header with back nav + icon badge, `container mx-auto` main area
3. **Server/client split**: Server component fetches initial data, passes to client component as props
4. **Server action pattern**: `"use server"`, admin check, `{ success, data, error }` return type
5. **Component library**: Use existing shadcn/ui components (Table, Card, Badge, Button, Tabs, Select, Dialog)
6. **Icons**: Lucide React only
7. **Utility**: `cn()` from `@/lib/utils` for conditional classes
8. **Dark mode**: Include `dark:` variants on all custom styles

### Should Add

1. **Admin hub entry**: Add card to `adminPages` array in `admin/page.tsx`
2. **FAB petal**: Add entry to `petals` array in `admin-fab.tsx`
3. **Chart library**: Install `recharts` (shadcn/ui recommended) for time-series and distribution charts
4. **Reusable SortableHeader**: Currently duplicated across 3 files -- consider extracting to shared component

### Should NOT Do

1. Do not use Effi design system tokens for admin pages (those are for user-facing workspace pages)
2. Do not create a shared admin layout.tsx (existing pages don't use one; keep consistent)
3. Do not use the Sidebar component for admin navigation (admin uses the hub + FAB pattern)
4. Do not import chart components in server components (they need `"use client"`)

### File Structure Recommendation

```
app/admin/observability/
  page.tsx                    # Server component: auth guard + data fetch
nextjs-app/components/admin/observability/
  dashboard-client.tsx        # Client component: main dashboard shell
  metrics-cards.tsx           # Summary stat cards
  latency-chart.tsx           # Time-series chart (recharts)
  error-rate-chart.tsx        # Error visualization
  request-table.tsx           # Sortable, filterable request log
  filters.tsx                 # Date range, service, status filters
app/actions/
  admin-observability.ts      # Server actions for fetching metrics
```
