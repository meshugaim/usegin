import { describe, it, expect } from "bun:test";
import {
  parseEnv,
  projectRefFor,
  requireProdConfirmation,
  PROD_REF,
  STAGING_REF,
} from "../src/lib/envs";

describe("parseEnv", () => {
  it("accepts production and staging", () => {
    expect(parseEnv("production")).toBe("production");
    expect(parseEnv("staging")).toBe("staging");
  });

  it("rejects unknown envs", () => {
    expect(() => parseEnv("prod")).toThrow(/Invalid --env/);
    expect(() => parseEnv("dev")).toThrow(/Invalid --env/);
    expect(() => parseEnv("")).toThrow(/--env is required/);
    expect(() => parseEnv(undefined)).toThrow(/--env is required/);
  });
});

describe("projectRefFor", () => {
  it("maps production → PROD_REF", () => {
    expect(projectRefFor("production")).toBe(PROD_REF);
  });

  it("maps staging → STAGING_REF", () => {
    expect(projectRefFor("staging")).toBe(STAGING_REF);
  });
});

describe("requireProdConfirmation", () => {
  it("allows staging + execute without --yes-i-am-sure", () => {
    expect(() =>
      requireProdConfirmation("staging", true, false)
    ).not.toThrow();
  });

  it("allows production dry-run without --yes-i-am-sure", () => {
    expect(() =>
      requireProdConfirmation("production", false, false)
    ).not.toThrow();
  });

  it("blocks production + execute without --yes-i-am-sure", () => {
    expect(() =>
      requireProdConfirmation("production", true, false)
    ).toThrow(/--yes-i-am-sure/);
  });

  it("allows production + execute + --yes-i-am-sure", () => {
    expect(() =>
      requireProdConfirmation("production", true, true)
    ).not.toThrow();
  });
});
