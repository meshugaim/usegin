import { test, expect } from "bun:test";
import { toKebabCase } from "./git-sync";

test("toKebabCase converts names correctly", () => {
	expect(toKebabCase("Nitsan Avni")).toBe("nitsan-avni");
	expect(toKebabCase("John Doe")).toBe("john-doe");
	expect(toKebabCase("alice-smith")).toBe("alice-smith");
	expect(toKebabCase("Bob O'Brien")).toBe("bob-o-brien");
	expect(toKebabCase("   Spaces   Everywhere   ")).toBe("spaces-everywhere");
	expect(toKebabCase("UPPERCASE")).toBe("uppercase");
	expect(toKebabCase("Special!@#Characters$%^")).toBe("special-characters");
	expect(toKebabCase("multiple---dashes")).toBe("multiple-dashes");
	expect(toKebabCase("trailing-dash-")).toBe("trailing-dash");
	expect(toKebabCase("-leading-dash")).toBe("leading-dash");
});
