import { describe, expect, it } from "bun:test";
import { parseRatingArgs } from "./parse";

describe("parseRatingArgs", () => {
  it("parses comma-separated key=val pairs", () => {
    const r = parseRatingArgs(["v=80,a=92,co=70"]);
    expect(r.scores).toHaveLength(3);
    expect(r.scores.find((s) => s.aspect === "vibe")?.score).toBe(80);
    expect(r.scores.find((s) => s.aspect === "accuracy")?.score).toBe(92);
    expect(r.scores.find((s) => s.aspect === "conciseness")?.score).toBe(70);
    expect(r.note).toBe("");
    expect(r.warnings).toEqual([]);
  });

  it("parses space-separated pairs and joins trailing words as note", () => {
    const r = parseRatingArgs(["accuracy=88", "vibe=70", "stayed", "on", "track"]);
    expect(r.scores.map((s) => `${s.aspect}=${s.score}`).sort()).toEqual([
      "accuracy=88",
      "vibe=70",
    ]);
    expect(r.note).toBe("stayed on track");
  });

  it("resolves shorthand aliases to canonical aspect keys", () => {
    const r = parseRatingArgs(["f_hc=72,ttm=40,und_h=85"]);
    const keys = new Set(r.scores.map((s) => s.aspect));
    expect(keys).toEqual(new Set(["friction_human_claude", "talked_too_much", "understood_human"]));
  });

  it("passes unknown aspect keys through unchanged (lean — no rejection)", () => {
    const r = parseRatingArgs(["vibe_with_dog=99"]);
    expect(r.scores).toEqual([
      { aspect: "vibe_with_dog", score: 99, original_key: "vibe_with_dog" },
    ]);
    expect(r.warnings).toEqual([]);
  });

  it("warns on out-of-range scores but stores them", () => {
    const r = parseRatingArgs(["vibe=150,general=0"]);
    expect(r.scores).toHaveLength(2);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toContain("vibe=150");
    expect(r.warnings[1]).toContain("general=0");
  });

  it("skips non-numeric values with a warning", () => {
    const r = parseRatingArgs(["anger=hi,accuracy=88"]);
    expect(r.scores).toHaveLength(1);
    expect(r.scores[0].aspect).toBe("accuracy");
    expect(r.warnings[0]).toContain("non-numeric");
  });

  it("handles empty input", () => {
    const r = parseRatingArgs([]);
    expect(r.scores).toEqual([]);
    expect(r.note).toBe("");
    expect(r.warnings).toEqual([]);
  });
});
