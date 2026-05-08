/**
 * Graceful shutdown planner (AC 21).
 *
 * Pure: given a list of in-progress uploads and a millisecond budget,
 * produce the side-effect sequence the wire layer must execute on
 * SIGTERM/SIGINT. The plan is deterministic and unit-tested; the
 * fs/network glue lives in `cli.ts`.
 *
 * Invariants:
 *   - The first step that doesn't fit causes that upload AND every
 *     subsequent upload to be abandoned (we never "skip ahead" to a
 *     smaller upload — abandon-tail keeps the wire layer simple).
 *   - `persist-state` is ALWAYS present, regardless of how many
 *     uploads were abandoned. Bytes that were uploaded but whose state
 *     row hasn't been flushed yet are recoverable on next boot via
 *     state-file replay; bytes that were abandoned are also recoverable
 *     (the state row still points at the unflushed file).
 *   - `exit` is always the last step.
 *
 * Boundary semantics: an upload with `estimatedRemainingMs ===
 * remainingBudget` fits (closed at the boundary), matching the
 * convention used by `Coalescer.takeReady` and `IdleDebouncer.isIdle`.
 */

export type ShutdownStep =
	| { kind: "complete"; uploadId: string }
	| { kind: "abandon"; uploadId: string }
	| { kind: "persist-state" }
	| { kind: "exit" };

export interface PendingUpload {
	uploadId: string;
	estimatedRemainingMs: number;
}

export interface ShutdownPlan {
	steps: ShutdownStep[];
	completedCount: number;
	abandonedCount: number;
}

export interface PlanShutdownInput {
	pendingUploads: PendingUpload[];
	deadlineMs: number;
}

export function planShutdown(input: PlanShutdownInput): ShutdownPlan {
	const steps: ShutdownStep[] = [];
	let remainingBudget = input.deadlineMs;
	let completedCount = 0;
	let abandonedCount = 0;
	let abandonTail = false;

	for (const upload of input.pendingUploads) {
		if (abandonTail) {
			steps.push({ kind: "abandon", uploadId: upload.uploadId });
			abandonedCount++;
			continue;
		}
		if (upload.estimatedRemainingMs <= remainingBudget) {
			steps.push({ kind: "complete", uploadId: upload.uploadId });
			remainingBudget -= upload.estimatedRemainingMs;
			completedCount++;
		} else {
			steps.push({ kind: "abandon", uploadId: upload.uploadId });
			abandonedCount++;
			abandonTail = true;
		}
	}

	steps.push({ kind: "persist-state" });
	steps.push({ kind: "exit" });

	return { steps, completedCount, abandonedCount };
}
