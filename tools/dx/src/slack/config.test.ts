/**
 * Unit tests for `dx slack` config loader + token mask.
 *
 * Part of: ENG-5408
 */

import { describe, expect, it } from "bun:test";
import { loadSlackConfig, maskToken, SlackConfigError } from "./config";

describe("loadSlackConfig", () => {
  it("reads USEGIN_SLACK_BOT_TOKEN from the env", () => {
    const cfg = loadSlackConfig({ USEGIN_SLACK_BOT_TOKEN: "xoxb-aaaa-bbbb" });
    expect(cfg.botToken).toBe("xoxb-aaaa-bbbb");
  });

  it("throws SlackConfigError with a Doppler hint when missing", () => {
    expect(() => loadSlackConfig({})).toThrow(SlackConfigError);
    try {
      loadSlackConfig({});
    } catch (err) {
      if (err instanceof SlackConfigError) {
        expect(err.message).toContain("USEGIN_SLACK_BOT_TOKEN");
        expect(err.message.toLowerCase()).toContain("doppler");
      }
    }
  });

  it("treats empty string as missing", () => {
    expect(() => loadSlackConfig({ USEGIN_SLACK_BOT_TOKEN: "" })).toThrow(
      SlackConfigError,
    );
  });
});

describe("maskToken", () => {
  it("preserves xoxb prefix and last 4 chars", () => {
    expect(maskToken("xoxb-1234-5678-AbCdEf")).toBe("xoxb…CdEf");
  });

  it("never emits the middle of the token", () => {
    const masked = maskToken("xoxb-1234-5678-AbCdEf");
    expect(masked).not.toContain("1234");
    expect(masked).not.toContain("5678");
  });

  it("handles short tokens defensively", () => {
    expect(maskToken("short")).toBe("***");
  });
});
