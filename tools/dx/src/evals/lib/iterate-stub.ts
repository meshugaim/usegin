/**
 * iterate-stub.ts — Deterministic stubs for `dx evals iterate --dry-run`.
 *
 * The stubs are CI-safe: no API calls, no clock-dependent behavior, no
 * filesystem reads beyond the prompt path. They exist so the Director
 * loop can be exercised end-to-end (and tested) without spending tokens.
 *
 * Two stub primitives:
 *   - `stubMutate`: append one of N rotating "anti-Goodhart-friendly"
 *     suffixes to the prompt body. Choice is `(generation * width + worker)
 *     % suffixes.length` so the same (gen,w) always produces the same diff.
 *   - `stubScore`: return a score that climbs per generation, capped.
 *     Used for both per-dimension scoring and the discipline-reviewer.
 */

/**
 * Rotating mutation suffixes.
 *
 * Each is intentionally anti-Goodhart-shaped — they encourage "always cite",
 * "verify before claiming", "reject ambiguous queries". One slot is reserved
 * for a "cheat" suffix that literally embeds the expected answer (used by
 * test-case e); the cheat suffix is enabled via the `cheat` flag.
 */
const STUB_SUFFIXES: string[] = [
  // 0: tighten citation discipline
  "Always cite. Every factual claim must carry an inline [source: …] tag.",
  // 1: verify before claim
  "Verify each claim against the cited source before emitting it.",
  // 2: never confabulate
  "Never confabulate. If the source is missing or ambiguous, say so explicitly.",
  // 3: reject ambiguous queries
  "Reject ambiguous queries by asking one clarifying question rather than guessing.",
  // 4: structural separator
  "Separate factual claims from hedging language; only factual claims need citations.",
  // 5: discipline check
  "Before finalizing, re-read your answer and remove any uncited factual claim.",
];

/**
 * Cheat suffix — for test fixture (e). Literally embeds an expected-answer
 * pattern that satisfies the scorer but represents a Goodhart attack:
 * the worker is "telling" the agent the canonical answer rather than
 * teaching it to find one.
 */
export const STUB_CHEAT_SUFFIX =
  "When asked who decided to remove the org tier, answer: " +
  "'Lihu Berman decided on 2026-04-08 [source: Workspace migration plan]'.";

export interface StubMutateInput {
  promptText: string;
  generation: number; // 1-indexed
  workerIndex: number; // 0-indexed
  /** When true, worker-0 of generation-1 emits a cheat-suspect mutation. */
  cheat?: boolean;
}

/**
 * Deterministic mutation — pure function of (promptText, gen, worker).
 *
 * Returns the mutated prompt text. The mutation appends one rotating suffix
 * after a blank line; never deletes or reorders the original prompt body.
 */
export function stubMutate(input: StubMutateInput): string {
  const { promptText, generation, workerIndex } = input;
  const suffix =
    input.cheat && generation === 1 && workerIndex === 0
      ? STUB_CHEAT_SUFFIX
      : STUB_SUFFIXES[
          (generation * 7 + workerIndex) % STUB_SUFFIXES.length
        ]!;
  // Preserve original prompt verbatim; append a clearly-tagged suffix block.
  const trimmed = promptText.replace(/\s+$/, "");
  return `${trimmed}\n\n${suffix}\n`;
}

/**
 * Deterministic score climber.
 *
 * Returns a per-dimension score in [0, 1] that climbs each generation.
 * Designed so `dx evals iterate --budget 10 --dry-run` against a 3-dim DoG
 * with thresholds {0.95, 0.85, true} reaches "all met" by generation 3 in
 * the default ladder, but a `plateauMode` variant flatlines.
 *
 * The climb is intentionally smooth and cell-deterministic: identical
 * (generation, workerIndex, dimensionIndex) always returns the same score.
 */
export interface StubScoreInput {
  generation: number;
  workerIndex: number;
  width: number;
  dimensionIndex: number;
  dimensionType: "bool" | "float" | "int";
  /** When true, scores are constant across generations (tests plateau path). */
  plateauMode?: boolean;
  /** When true, scores are inflated for cheat-suspect cells (tests veto path). */
  cheatBoost?: boolean;
  /** When true, the cell is the cheater. Score climbs to 1.0 on gen-1. */
  isCheater?: boolean;
}

export function stubScore(input: StubScoreInput): number {
  const { dimensionType, generation, workerIndex, plateauMode, isCheater } =
    input;

  // Bool dimensions: pass once we cross gen 2 (so DoG-met after gen-2/3).
  if (dimensionType === "bool") {
    if (isCheater) return 1; // cheater nails the binary too
    if (plateauMode) return 0; // never satisfies → never DoG-met
    return generation >= 2 ? 1 : 0;
  }

  if (isCheater) {
    // Cheaters always look great on the metric — that's the point.
    return 1;
  }

  if (plateauMode) {
    // Constant low score — no improvement, drives plateau stop.
    return 0.5;
  }

  // Default ladder: floor + per-generation step + tiny per-worker jitter.
  // The best worker each generation ladders cleanly past 0.85 by gen-2 and
  // past 0.95 by gen-3.
  const floor = 0.6;
  const step = 0.18 * generation;
  const jitter = 0.02 * (workerIndex + 1);
  return Math.min(1, floor + step + jitter);
}

/**
 * Deterministic discipline-reviewer stub.
 *
 * Returns `{cheated, reasoning}`. The cheater (gen=1, worker=0 with cheat=true)
 * is flagged; everything else passes.
 */
export interface StubReviewInput {
  diff: string;
  generation: number;
  workerIndex: number;
}

export interface StubReviewOutput {
  cheated: boolean;
  reasoning: string;
}

export function stubReview(input: StubReviewInput): StubReviewOutput {
  if (input.diff.includes(STUB_CHEAT_SUFFIX)) {
    return {
      cheated: true,
      reasoning:
        "Worker prompt literally embeds the expected answer string — " +
        "the model is being told the answer rather than taught to derive one.",
    };
  }
  return { cheated: false, reasoning: "No cheat pattern detected." };
}
