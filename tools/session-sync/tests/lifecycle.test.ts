import { describe, expect, test } from "bun:test";
import { planShutdown } from "../src/lifecycle.ts";

describe("planShutdown", () => {
	test("all uploads fit within deadline → all complete, then persist+exit", () => {
		const plan = planShutdown({
			pendingUploads: [
				{ uploadId: "u1", estimatedRemainingMs: 100 },
				{ uploadId: "u2", estimatedRemainingMs: 200 },
				{ uploadId: "u3", estimatedRemainingMs: 300 },
			],
			deadlineMs: 1000,
		});
		expect(plan.steps).toEqual([
			{ kind: "complete", uploadId: "u1" },
			{ kind: "complete", uploadId: "u2" },
			{ kind: "complete", uploadId: "u3" },
			{ kind: "persist-state" },
			{ kind: "exit" },
		]);
		expect(plan.completedCount).toBe(3);
		expect(plan.abandonedCount).toBe(0);
	});

	test("one upload exceeds budget → it + rest abandoned", () => {
		const plan = planShutdown({
			pendingUploads: [
				{ uploadId: "u1", estimatedRemainingMs: 400 },
				{ uploadId: "u2", estimatedRemainingMs: 700 }, // doesn't fit (only 600 left)
				{ uploadId: "u3", estimatedRemainingMs: 100 }, // would fit but we abandon-tail
			],
			deadlineMs: 1000,
		});
		expect(plan.steps).toEqual([
			{ kind: "complete", uploadId: "u1" },
			{ kind: "abandon", uploadId: "u2" },
			{ kind: "abandon", uploadId: "u3" },
			{ kind: "persist-state" },
			{ kind: "exit" },
		]);
		expect(plan.completedCount).toBe(1);
		expect(plan.abandonedCount).toBe(2);
	});

	test("empty pending uploads → just persist+exit", () => {
		const plan = planShutdown({
			pendingUploads: [],
			deadlineMs: 1000,
		});
		expect(plan.steps).toEqual([{ kind: "persist-state" }, { kind: "exit" }]);
		expect(plan.completedCount).toBe(0);
		expect(plan.abandonedCount).toBe(0);
	});

	test("zero deadline → all abandoned", () => {
		const plan = planShutdown({
			pendingUploads: [
				{ uploadId: "u1", estimatedRemainingMs: 50 },
				{ uploadId: "u2", estimatedRemainingMs: 50 },
			],
			deadlineMs: 0,
		});
		expect(plan.steps).toEqual([
			{ kind: "abandon", uploadId: "u1" },
			{ kind: "abandon", uploadId: "u2" },
			{ kind: "persist-state" },
			{ kind: "exit" },
		]);
		expect(plan.abandonedCount).toBe(2);
		expect(plan.completedCount).toBe(0);
	});

	test("AC 21 invariant: persist-state always present, even on abandon-all", () => {
		const planAbandon = planShutdown({
			pendingUploads: [{ uploadId: "u1", estimatedRemainingMs: 5000 }],
			deadlineMs: 100,
		});
		expect(planAbandon.steps.some((s) => s.kind === "persist-state")).toBe(
			true,
		);

		const planEmpty = planShutdown({
			pendingUploads: [],
			deadlineMs: 1000,
		});
		expect(planEmpty.steps.some((s) => s.kind === "persist-state")).toBe(true);

		const planMixed = planShutdown({
			pendingUploads: [
				{ uploadId: "u1", estimatedRemainingMs: 100 },
				{ uploadId: "u2", estimatedRemainingMs: 5000 },
			],
			deadlineMs: 500,
		});
		expect(planMixed.steps.some((s) => s.kind === "persist-state")).toBe(true);
	});

	test("AC 21 invariant: exit is always last step", () => {
		const plans = [
			planShutdown({ pendingUploads: [], deadlineMs: 1000 }),
			planShutdown({
				pendingUploads: [{ uploadId: "u1", estimatedRemainingMs: 50 }],
				deadlineMs: 1000,
			}),
			planShutdown({
				pendingUploads: [{ uploadId: "u1", estimatedRemainingMs: 5000 }],
				deadlineMs: 100,
			}),
		];
		for (const p of plans) {
			expect(p.steps[p.steps.length - 1]?.kind).toBe("exit");
		}
	});

	test("running budget: each complete subtracts time", () => {
		// Budget is 500. u1 = 200 leaves 300. u2 = 250 leaves 50. u3 = 100 doesn't fit.
		const plan = planShutdown({
			pendingUploads: [
				{ uploadId: "u1", estimatedRemainingMs: 200 },
				{ uploadId: "u2", estimatedRemainingMs: 250 },
				{ uploadId: "u3", estimatedRemainingMs: 100 },
			],
			deadlineMs: 500,
		});
		expect(plan.steps[0]).toEqual({ kind: "complete", uploadId: "u1" });
		expect(plan.steps[1]).toEqual({ kind: "complete", uploadId: "u2" });
		expect(plan.steps[2]).toEqual({ kind: "abandon", uploadId: "u3" });
		expect(plan.completedCount).toBe(2);
		expect(plan.abandonedCount).toBe(1);
	});

	test("upload exactly fits remaining budget → complete (closed boundary)", () => {
		const plan = planShutdown({
			pendingUploads: [{ uploadId: "u1", estimatedRemainingMs: 1000 }],
			deadlineMs: 1000,
		});
		expect(plan.steps[0]).toEqual({ kind: "complete", uploadId: "u1" });
	});
});
