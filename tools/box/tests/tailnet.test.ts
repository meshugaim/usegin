import { describe, it, expect } from "bun:test";
import { buildBreakGlassArgs, buildTailnetSshArgs } from "../src/lib/hcloud";
import {
  parseTailnetNodes, classifyDevboxNodes, formatTailnetHygiene, type TailnetNode,
} from "../src/lib/tailnet";

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

describe("buildBreakGlassArgs — hcloud server ssh by public IP", () => {
  it("puts -u BEFORE the server and the command after `--` (hcloud usage order)", () => {
    // hcloud server ssh [options] <server> [--] [command]: -u after the server
    // gets forwarded to ssh → "illegal option -- u" and the command never runs.
    expect(buildBreakGlassArgs({ name: "v2debug", command: ["echo", "hi"] })).toEqual([
      "server", "ssh", "-u", "dev", "v2debug", "--", "echo", "hi",
    ]);
  });

  it("defaults to the dev user and an interactive shell (no command) when none given", () => {
    expect(buildBreakGlassArgs({ name: "box1" })).toEqual([
      "server", "ssh", "-u", "dev", "box1", "--",
    ]);
  });

  it("`--` precedes the command so a leading-dash command isn't parsed as a flag", () => {
    const args = buildBreakGlassArgs({ name: "b", command: ["-x"] });
    expect(args.indexOf("--")).toBeLessThan(args.indexOf("-x"));
    expect(args.indexOf("-u")).toBeLessThan(args.indexOf("b")); // user flag before server
  });

  it("honours a custom user", () => {
    expect(buildBreakGlassArgs({ name: "b", user: "root", command: ["id"] })).toEqual([
      "server", "ssh", "-u", "root", "b", "--", "id",
    ]);
  });
});

const node = (name: string, tagged = true): TailnetNode => ({ name, ip: "100.0.0.1", online: false, tagged });

describe("parseTailnetNodes", () => {
  it("extracts short name, ip, online, and the devbox tag", () => {
    const json = JSON.stringify({
      Self: { DNSName: "my-mac.tail123.ts.net.", TailscaleIPs: ["100.1.1.1"], Online: true, Tags: [] },
      Peer: {
        a: { DNSName: "agent-a.tail123.ts.net.", TailscaleIPs: ["100.2.2.2"], Online: true, Tags: ["tag:devbox"] },
      },
    });
    const nodes = parseTailnetNodes(json);
    expect(nodes).toContainEqual({ name: "my-mac", ip: "100.1.1.1", online: true, tagged: false });
    expect(nodes).toContainEqual({ name: "agent-a", ip: "100.2.2.2", online: true, tagged: true });
  });

  it("returns [] on non-JSON rather than throwing", () => {
    expect(parseTailnetNodes("not json")).toEqual([]);
  });
});

describe("classifyDevboxNodes", () => {
  it("splits into live / at-rest / orphan, ignoring untagged personal nodes", () => {
    const nodes = [node("running-box"), node("downed-box"), node("dead-box"), node("my-laptop", false)];
    const c = classifyDevboxNodes(nodes, new Set(["running-box"]), new Set(["running-box", "downed-box"]));
    expect(c.live.map((n) => n.name)).toEqual(["running-box"]);
    expect(c.atRest.map((n) => n.name)).toEqual(["downed-box"]);
    expect(c.orphans.map((n) => n.name)).toEqual(["dead-box"]);
  });

  it("never flags an untagged node (a laptop) as an orphan", () => {
    expect(classifyDevboxNodes([node("laptop", false)], new Set(), new Set()).orphans).toEqual([]);
  });
});

describe("formatTailnetHygiene", () => {
  it("says nothing when no devbox nodes are tracked", () => {
    expect(formatTailnetHygiene({ live: [], atRest: [], orphans: [] })).toBe("");
  });

  it("reports clean when there are no orphans", () => {
    expect(formatTailnetHygiene({ live: [node("a")], atRest: [], orphans: [] })).toContain("no orphans");
  });

  it("lists orphans as prune candidates", () => {
    const out = formatTailnetHygiene({ live: [], atRest: [], orphans: [node("dead-box")] });
    expect(out).toContain("dead-box");
    expect(out).toContain("prune");
  });
});
