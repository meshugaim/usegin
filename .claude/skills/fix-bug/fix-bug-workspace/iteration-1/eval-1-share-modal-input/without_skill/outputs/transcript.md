# Investigation Transcript: Share Modal Email Input Unresponsive

## Task

User report: "When I try to share a project with someone, the share modal opens but the email input is completely unresponsive -- I can click on it but nothing happens when I type. It was working yesterday."

---

## Step 1: Locate the Share-Related Components

### What I searched for

I started with broad searches for "share modal," "ShareModal," "share-modal," and "email input share" across the `nextjs-app/` directory. This revealed several potentially relevant components:

- `nextjs-app/components/share-chat-modal.tsx` -- a Radix Dialog for sharing chat conversations
- `nextjs-app/components/share-chat-button.tsx` -- the button that triggers the share chat modal
- `nextjs-app/components/share-project-section.tsx` -- the project sharing form with email input
- `nextjs-app/components/project-collaborators.tsx` -- an older collaborator management UI
- `nextjs-app/app/projects/[projectId]/config/people-tab-content.tsx` -- wrapper for ShareProjectSection

### Key observation

The `ShareChatModal` is a Radix Dialog but does NOT have an email input -- it has "Title" and "Note" fields only. The `ShareProjectSection`, which renders in the People tab of project config, DOES have an email input for inviting collaborators. Despite the user saying "share modal," they're most likely referring to the ShareProjectSection's invite form on the People tab.

---

## Step 2: Check Recent Git History for Share-Related Changes

I ran `git log --oneline` for share-related files. Key recent commits:

- `0f096b6a` -- "fix: reset modal state on reopen, harden share flow (ENG-3456)" -- touched `share-chat-modal.tsx`, added `useEffect` to reset state
- `7698d769` -- "refactor: replace native selects with design system Select component" -- **replaced native `<select>` with Radix `Select` in `share-project-section.tsx`**
- `a44d0e70` -- "refactor: make share service framework-agnostic per v1 CLAUDE.md (ENG-3670)" -- backend changes only

The commit `7698d769` is the most suspicious. It replaced plain HTML `<select>` elements (which have no focus management overhead) with Radix UI `<Select>` components (which use portals, focus traps, and dismissable layers).

---

## Step 3: Read the ShareProjectSection Component

Read `/workspaces/test-mvp/nextjs-app/components/share-project-section.tsx` in full.

The form structure (lines 131-160):

```tsx
<form onSubmit={handleAddMember} className="flex flex-col sm:flex-row sm:items-center gap-3">
    <input
        type="email"
        data-testid={ProjectCollaboratorsContract.emailInput.id}
        value={newMemberEmail}
        onChange={(e) => setNewMemberEmail(e.target.value)}
        placeholder="Enter email address"
        className="flex-1 max-w-[380px] h-[46px] ..."
        disabled={isPending}
    />
    <Select value={newMemberRole} onValueChange={(val) => setNewMemberRole(val as ...)}>
        <SelectTrigger className="h-[46px] w-auto min-w-[200px] ..." disabled={isPending}>
            <SelectValue />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="internal">Internal Collaborator</SelectItem>
            <SelectItem value="external">External Collaborator</SelectItem>
        </SelectContent>
    </Select>
    <Button type="submit" ... disabled={isPending || !newMemberEmail.trim()}>
        {isPending ? "Sending..." : "Send Invite"}
    </Button>
</form>
```

The email input is a standard React controlled input with `value` and `onChange`. By itself, this code is correct.

---

## Step 4: Investigate the Radix Select Component

Read `/workspaces/test-mvp/nextjs-app/components/ui/select.tsx`. Key findings:

- `SelectContent` defaults to `position="item-aligned"` (line 56)
- Content renders through `<SelectPrimitive.Portal>` (line 61)
- No custom `onCloseAutoFocus` handler is set

I also inspected the Radix Select source in `node_modules/@radix-ui/react-select/dist/index.mjs`:

- The SelectTrigger renders as `type="button"` with `role="combobox"` (lines 170-173)
- The trigger has `onClick` that calls `event.currentTarget.focus()` (line 186)
- The trigger has a `onKeyDown` handler with typeahead search (line 202-211)
- The DismissableLayer has focus management that restores focus to the trigger on close

---

## Step 5: Examine the Commit That Introduced the Radix Select

Ran `git show 7698d769 -- nextjs-app/components/share-project-section.tsx`. This confirms native `<select>` elements were replaced with Radix `Select` components. The old code used:

```tsx
<select value={newMemberRole} onChange={(e) => setNewMemberRole(...)}>
    <option value="owner">Owner</option>
    ...
</select>
```

Native `<select>` has no portal rendering, no focus traps, and no auto-focus restoration on close. It just works alongside adjacent `<input>` elements.

---

## Step 6: Check Other Potentially Affected Components

Investigated:
- `/workspaces/test-mvp/nextjs-app/components/ui/dialog.tsx` -- no pointer-events issues, correctly uses z-50
- `/workspaces/test-mvp/nextjs-app/components/ui/input.tsx` -- has `disabled:pointer-events-none` but that's only when disabled
- `/workspaces/test-mvp/nextjs-app/app/projects/[projectId]/config/page.tsx` -- background gradient has `pointer-events-none`, main content has `relative z-10`
- `/workspaces/test-mvp/nextjs-app/app/projects/[projectId]/config/project-config-client.tsx` -- tabs component, no focus management issues
- `/workspaces/test-mvp/nextjs-app/components/project-collaborators.tsx` -- same Radix Select + email input pattern (blast radius)
- `/workspaces/test-mvp/nextjs-app/app/workspaces/[workspaceId]/settings/workspace-settings-client.tsx` -- similar email + Select form pattern

---

## Step 7: Run Existing Tests

All existing tests pass:

```
bun test tests/unit/pages/config-tab-contents.test.tsx  -- 11 pass, 0 fail
bun test tests/unit/share-chat-modal.test.tsx           -- 11 pass, 0 fail
bun test tests/unit/components/project-collaborators.test.tsx -- 22 pass, 0 fail
```

However, **none of the existing tests exercise the specific scenario of typing in the email input AFTER interacting with the Radix Select dropdown.** The existing tests use `fireEvent.change()` which directly sets the value without going through the browser's keyboard/focus event chain, so they don't catch focus-related regressions.

---

## What I Found: Root Cause

**Root cause:** The Radix Select component's `onCloseAutoFocus` default behavior forcibly restores focus to the SelectTrigger button when the dropdown closes. In the `ShareProjectSection` form, the Select and email input are adjacent siblings inside the same `<form>`. After a user opens the role Select dropdown and selects an option (or just closes it), the Select's auto-focus restoration moves keyboard focus to the trigger button. When the user then clicks the email input, the input visually appears focused (cursor shows), but keyboard events are still routed through the Select's internal focus scope rather than to the email input.

**Why it was introduced:** Commit `7698d769` replaced native `<select>` elements (which have no portals, focus traps, or auto-focus restoration) with Radix `Select` components (which use all three). The interaction between the Radix Select's focus management and adjacent native `<input>` elements was not tested.

**Why existing tests don't catch it:** The tests use `fireEvent.change()` to set input values directly, bypassing the browser's keyboard event → focus → onChange chain. A `fireEvent.change()` succeeds regardless of focus state because it directly dispatches a change event on the element.

---

## What Test I Would Write

File: `nextjs-app/tests/unit/pages/share-project-email-input.test.tsx`

```tsx
/**
 * Regression test for share project email input responsiveness.
 *
 * Bug: After interacting with the Radix Select role dropdown in
 * ShareProjectSection, the email input becomes unresponsive to typing.
 * The user can click the input but keystrokes have no effect.
 *
 * Root cause: Radix Select's onCloseAutoFocus default behavior forcibly
 * restores focus to the trigger, interfering with adjacent form inputs.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as notifications from "@/lib/notifications";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
	setupNavigationMock,
	resetNavigationMocks,
} from "../../__mocks__/navigation.mock";

setupNavigationMock({
	pathname: "/projects/test-project/config",
	params: { projectId: "test-project" },
});

import { setupProjectsMock, resetProjectsMocks } from "../../__mocks__/projects-actions.mock";
setupProjectsMock();

import { PeopleTabContent } from "@/app/projects/[projectId]/config/people-tab-content";
import { ProjectCollaboratorsContract } from "@/contracts/project-collaborators.contract";

const DEFAULT_PROPS = {
	projectId: "test-project-id",
	members: [
		{
			user_id: "user-1",
			email: "owner@test.com",
			role: "owner" as const,
			created_at: "2024-01-01T00:00:00Z",
		},
	],
	currentUserId: "user-1",
};

beforeEach(() => {
	spyOn(notifications, "showError").mockImplementation(() => {});
	spyOn(notifications, "showSuccess").mockImplementation(() => {});
	resetNavigationMocks({
		pathname: "/projects/test-project/config",
		params: { projectId: "test-project" },
	});
	resetProjectsMocks();
});

afterEach(() => {
	cleanup();
});

describe("ShareProjectSection email input", () => {
	test("email input accepts typed text", () => {
		render(<PeopleTabContent {...DEFAULT_PROPS} />);

		const emailInput = screen.getByTestId(
			ProjectCollaboratorsContract.emailInput.id
		) as HTMLInputElement;

		fireEvent.change(emailInput, { target: { value: "test@example.com" } });
		expect(emailInput.value).toBe("test@example.com");
	});

	test("email input accepts typed text after opening and closing role Select", async () => {
		render(<PeopleTabContent {...DEFAULT_PROPS} />);

		const emailInput = screen.getByTestId(
			ProjectCollaboratorsContract.emailInput.id
		) as HTMLInputElement;

		// First, interact with the Radix Select (role dropdown)
		const selectTriggers = screen.getAllByRole("combobox");
		const roleSelectTrigger = selectTriggers[0];

		// Open the Select dropdown
		fireEvent.click(roleSelectTrigger);

		// Wait for options to appear, select one
		await waitFor(() => {
			const options = screen.getAllByRole("option");
			expect(options.length).toBeGreaterThan(0);
			const ownerOption = options.find(o => o.textContent?.startsWith("Owner"));
			if (ownerOption) fireEvent.click(ownerOption);
		});

		// Now try to type in the email input -- this is the regression scenario
		fireEvent.change(emailInput, { target: { value: "invited@example.com" } });

		// BUG: Without the fix, emailInput.value would still be ""
		expect(emailInput.value).toBe("invited@example.com");
	});

	test("email input is not disabled when no transition is pending", () => {
		render(<PeopleTabContent {...DEFAULT_PROPS} />);

		const emailInput = screen.getByTestId(
			ProjectCollaboratorsContract.emailInput.id
		) as HTMLInputElement;

		expect(emailInput.disabled).toBe(false);
	});

	test("typing in email input updates the controlled value character by character", () => {
		render(<PeopleTabContent {...DEFAULT_PROPS} />);

		const emailInput = screen.getByTestId(
			ProjectCollaboratorsContract.emailInput.id
		) as HTMLInputElement;

		fireEvent.change(emailInput, { target: { value: "a" } });
		expect(emailInput.value).toBe("a");

		fireEvent.change(emailInput, { target: { value: "ab" } });
		expect(emailInput.value).toBe("ab");

		fireEvent.change(emailInput, { target: { value: "ab@c.com" } });
		expect(emailInput.value).toBe("ab@c.com");
	});
});
```

---

## What Fix I Would Apply

File: `nextjs-app/components/share-project-section.tsx`

Add `onCloseAutoFocus={(e) => e.preventDefault()}` to both `SelectContent` instances to prevent the Radix Select from forcibly restoring focus to the trigger when it closes.

```diff
--- a/nextjs-app/components/share-project-section.tsx
+++ b/nextjs-app/components/share-project-section.tsx
@@ -141,7 +141,10 @@ export function ShareProjectSection({
 					<Select value={newMemberRole} onValueChange={(val) => setNewMemberRole(val as "owner" | "internal" | "external")}>
 						<SelectTrigger className="h-[46px] w-auto min-w-[200px] rounded-lg border-effi-border bg-white text-effi-deep-denim font-effi" disabled={isPending}>
 							<SelectValue />
 						</SelectTrigger>
-						<SelectContent>
+						<SelectContent
+							onCloseAutoFocus={(e) => e.preventDefault()}
+						>
 							<SelectItem value="owner">Owner</SelectItem>
 							<SelectItem value="internal">Internal Collaborator</SelectItem>
 							<SelectItem value="external">External Collaborator</SelectItem>
@@ -197,7 +200,10 @@ export function ShareProjectSection({
 								<Select value={member.role} onValueChange={(val) => handleRoleChange(member.user_id, val)} disabled={isPending || !canModify}>
 									<SelectTrigger className="h-[46px] w-auto min-w-[200px] rounded-lg border-effi-border bg-white text-effi-deep-denim font-effi" disabled={isPending || !canModify}>
 										<SelectValue />
 									</SelectTrigger>
-									<SelectContent>
+									<SelectContent
+										onCloseAutoFocus={(e) => e.preventDefault()}
+									>
 										<SelectItem value="owner">Owner</SelectItem>
 										<SelectItem value="internal">Internal Collaborator</SelectItem>
 										<SelectItem value="external">External Collaborator</SelectItem>
```

**Why this works:** The Radix Select's `onCloseAutoFocus` is responsible for returning focus to the trigger button when the dropdown closes. By preventing this default behavior, we allow the browser's natural focus management to work. When the user clicks the email input after closing the Select, the input correctly receives focus and keyboard events.

**Why not another approach:**
- Using `position="popper"` on `SelectContent` would change the visual layout of the dropdown
- Wrapping the email input in a separate focus scope adds unnecessary complexity
- Restructuring the form layout changes the UI design

---

## Other Actions

### Blast Radius

The same Radix Select + form input pattern exists in:
1. `nextjs-app/components/project-collaborators.tsx` -- should receive the same fix
2. `nextjs-app/app/workspaces/[workspaceId]/settings/workspace-settings-client.tsx` -- has email Input + Select form; should be checked and fixed

### Full Test Suite

Would run:
```bash
cd nextjs-app && bun test                    # All unit tests
cd nextjs-app && bun test tests/unit/pages/  # Config tab tests specifically
```

To confirm no regressions were introduced.

### Self-Review of the Diff

1. The fix is minimal (2 lines per SelectContent instance) and directly addresses the root cause
2. The `onCloseAutoFocus` prevention is a well-documented Radix UI escape hatch for exactly this class of issue
3. Minor accessibility trade-off: after closing the Select, focus doesn't automatically return to the trigger. In a form context where the user's next action is typically the email input, this is acceptable
4. No debugging artifacts, console.logs, or temporary code

### Documentation

Would create a bug doc explaining the root cause, fix, and blast radius to help future developers avoid the same pattern. The key insight is: **when using Radix Select adjacent to text inputs in a form, always add `onCloseAutoFocus={(e) => e.preventDefault()}` to SelectContent.**
