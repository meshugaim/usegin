import { describe, it, expect } from "bun:test";
import { buildTailnetSshArgs } from "../src/lib/hcloud";

describe("buildTailnetSshArgs — ssh-by-name over the tailnet", () => {
  it("builds an interactive argv (accept-new, dev user, no command)", () => {
    expect(buildTailnetSshArgs({ name: "effi-devbox" })).toEqual([
      "-o", "StrictHostKeyChecking=accept-new", "dev@effi-devbox",
    ]);
  });

  it("appends a remote command after the host", () => {
    expect(buildTailnetSshArgs({ name: "agent-a", command: ["uptime"] })).toEqual([
      "-o", "StrictHostKeyChecking=accept-new", "dev@agent-a", "uptime",
    ]);
  });

  it("inserts -t for a TTY (the `work` path) before the host", () => {
    expect(buildTailnetSshArgs({ name: "box1", tty: true, command: ["X"] })).toEqual([
      "-o", "StrictHostKeyChecking=accept-new", "-t", "dev@box1", "X",
    ]);
  });

  it("honours a custom user (break-glass / root flows)", () => {
    expect(buildTailnetSshArgs({ name: "b", user: "root" })).toEqual([
      "-o", "StrictHostKeyChecking=accept-new", "root@b",
    ]);
  });
});
