import { describe, expect, it } from "bun:test";
import {
  calculateBefore,
  calculateAfter,
  calculateTop,
  calculateBottom,
  calculatePull,
  calculatePush,
  type OrderedItem,
} from "../src/lib/ordering";

const mockItems: OrderedItem[] = [
  { id: "1", identifier: "ENG-10", sortOrder: 1.0 },
  { id: "2", identifier: "ENG-20", sortOrder: 2.0 },
  { id: "3", identifier: "ENG-30", sortOrder: 3.0 },
  { id: "4", identifier: "ENG-40", sortOrder: 4.0 },
];

describe("calculateBefore", () => {
  it("calculates midpoint when target has a predecessor", () => {
    const result = calculateBefore(mockItems, "ENG-30");
    expect(result).toBe(2.5); // Between 2.0 and 3.0
  });

  it("places before first item", () => {
    const result = calculateBefore(mockItems, "ENG-10");
    expect(result).toBe(0); // 1.0 - 1
  });

  it("returns null for unknown identifier", () => {
    const result = calculateBefore(mockItems, "UNKNOWN");
    expect(result).toBeNull();
  });
});

describe("calculateAfter", () => {
  it("calculates midpoint when target has a successor", () => {
    const result = calculateAfter(mockItems, "ENG-20");
    expect(result).toBe(2.5); // Between 2.0 and 3.0
  });

  it("places after last item", () => {
    const result = calculateAfter(mockItems, "ENG-40");
    expect(result).toBe(5); // 4.0 + 1
  });

  it("returns null for unknown identifier", () => {
    const result = calculateAfter(mockItems, "UNKNOWN");
    expect(result).toBeNull();
  });
});

describe("calculateTop", () => {
  it("returns value less than minimum", () => {
    const result = calculateTop(mockItems);
    expect(result).toBe(0); // 1.0 - 1
  });

  it("returns 0 for empty list", () => {
    const result = calculateTop([]);
    expect(result).toBe(0);
  });
});

describe("calculateBottom", () => {
  it("returns value greater than maximum", () => {
    const result = calculateBottom(mockItems);
    expect(result).toBe(5); // 4.0 + 1
  });

  it("returns 0 for empty list", () => {
    const result = calculateBottom([]);
    expect(result).toBe(0);
  });
});

describe("calculatePull", () => {
  it("moves item up one position", () => {
    const result = calculatePull(mockItems, "ENG-30", 1);
    expect(result).toBe(1.5); // Between ENG-10 (1.0) and ENG-20 (2.0)
  });

  it("moves item up multiple positions", () => {
    const result = calculatePull(mockItems, "ENG-40", 2);
    expect(result).toBe(1.5); // Between ENG-10 (1.0) and ENG-20 (2.0)
  });

  it("moves to top when pulling beyond first", () => {
    const result = calculatePull(mockItems, "ENG-30", 10);
    expect(result).toBe(0); // Before ENG-10
  });

  it("returns null when already at top", () => {
    const result = calculatePull(mockItems, "ENG-10", 1);
    expect(result).toBeNull();
  });

  it("returns null for unknown identifier", () => {
    const result = calculatePull(mockItems, "UNKNOWN", 1);
    expect(result).toBeNull();
  });
});

describe("calculatePush", () => {
  it("moves item down one position", () => {
    const result = calculatePush(mockItems, "ENG-20", 1);
    expect(result).toBe(3.5); // Between ENG-30 (3.0) and ENG-40 (4.0)
  });

  it("moves item down multiple positions", () => {
    const result = calculatePush(mockItems, "ENG-10", 2);
    expect(result).toBe(3.5); // Between ENG-30 (3.0) and ENG-40 (4.0)
  });

  it("moves to bottom when pushing beyond last", () => {
    const result = calculatePush(mockItems, "ENG-20", 10);
    expect(result).toBe(5); // After ENG-40
  });

  it("returns null when already at bottom", () => {
    const result = calculatePush(mockItems, "ENG-40", 1);
    expect(result).toBeNull();
  });

  it("returns null for unknown identifier", () => {
    const result = calculatePush(mockItems, "UNKNOWN", 1);
    expect(result).toBeNull();
  });
});
