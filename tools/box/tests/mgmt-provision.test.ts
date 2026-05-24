import { describe, it, expect } from "bun:test";
import {
  mgmtCloudInitPath,
  setupMgmtScriptPath,
  MGMT_DEFAULT_SIZE,
  MGMT_HCLOUD_CONFIG_PATH,
  localHcloudConfigPath,
  buildTailscaleUpCommand,
  buildRunSetupCommand,
  buildTokenScpArgs,
  buildTokenInstallCommand,
  buildCloudInitDoneCheck,
} from "../src/lib/mgmt-provision";
import { DEFAULTS } from "../src/lib/config";

describe("mgmtCloudInitPath / setupMgmtScriptPath", () => {
  it("resolve to the lean mgmt artifacts under scripts/hetzner (cwd-independent)", () => {
    expect(mgmtCloudInitPath()).toEndWith("/scripts/hetzner/cloud-init-mgmt.yaml");
    expect(setupMgmtScriptPath()).toEndWith("/scripts/hetzner/setup-mgmt.sh");
    // Absolute (resolved from import.meta.url) so the box CLI works from any cwd.
    expect(mgmtCloudInitPath().startsWith("/")).toBe(true);
    expect(setupMgmtScriptPath().startsWith("/")).toBe(true);
  });

  it("points at the LEAN cloud-init, not the heavy work-box one", () => {
    // The mgmt box is a distinct lean image — must not reuse the work-box
    // cloud-init.yaml (which installs docker + node + the devcontainer CLI).
    expect(mgmtCloudInitPath()).not.toEndWith("/cloud-init.yaml");
    expect(mgmtCloudInitPath()).toContain("cloud-init-mgmt.yaml");
  });
});

describe("MGMT_DEFAULT_SIZE", () => {
  it("is a lean type, NOT the heavy work-box BOX_TYPE default (cpx42)", () => {
    // The always-on mgmt box must not silently inherit the work-box default
    // (cpx42, locked to >=320GB-disk snapshots) — that would make it ~6x dearer.
    expect(MGMT_DEFAULT_SIZE).toBe("cx22");
    expect(MGMT_DEFAULT_SIZE).not.toBe(DEFAULTS.type);
  });
});

describe("localHcloudConfigPath", () => {
  it("reads hcloud's default config location under the given HOME", () => {
    expect(localHcloudConfigPath("/home/op")).toBe("/home/op/.config/hcloud/cli.toml");
  });

  it("falls back to cwd-relative when HOME is undefined", () => {
    expect(localHcloudConfigPath(undefined)).toBe("./.config/hcloud/cli.toml");
  });
});

describe("buildTailscaleUpCommand", () => {
  it("joins the tailnet under the box name, with the key passed inline (over ssh)", () => {
    const cmd = buildTailscaleUpCommand({ name: "effi-mgmt", authkey: "tskey-abc123" });
    expect(cmd).toBe('sudo tailscale up --authkey="tskey-abc123" --hostname=effi-mgmt');
  });

  it("sets --hostname to the box name so MagicDNS resolves it for box mgmt ssh / renew", () => {
    expect(buildTailscaleUpCommand({ name: "my-mgmt", authkey: "tskey-x" })).toContain("--hostname=my-mgmt");
  });

  it("throws on an invalid name rather than emitting an injectable command", () => {
    expect(() => buildTailscaleUpCommand({ name: "Bad Name", authkey: "tskey-x" })).toThrow(/invalid mgmt box name/);
    expect(() => buildTailscaleUpCommand({ name: "x;reboot", authkey: "tskey-x" })).toThrow(/invalid mgmt box name/);
    expect(() => buildTailscaleUpCommand({ name: "", authkey: "tskey-x" })).toThrow(/invalid mgmt box name/);
  });
});

describe("buildRunSetupCommand", () => {
  it("streams the script via `bash -s` and passes the repo URL as a positional arg", () => {
    // `-s` reads the script from stdin (so a fresh box needn't have it yet);
    // everything after `--` becomes the script's $1 (the repo URL).
    expect(buildRunSetupCommand({ repoUrl: "https://github.com/AskEffi/test-mvp.git" })).toBe(
      "bash -s -- https://github.com/AskEffi/test-mvp.git",
    );
  });
});

describe("buildTokenScpArgs", () => {
  it("scp's the local token file to a temp path on the box by tailnet name", () => {
    const args = buildTokenScpArgs({ name: "effi-mgmt", localPath: "/home/op/.config/hcloud/cli.toml" });
    expect(args).toEqual([
      "-o", "StrictHostKeyChecking=accept-new",
      "/home/op/.config/hcloud/cli.toml",
      "dev@effi-mgmt:/home/dev/.hcloud-cli.toml.tmp",
    ]);
  });

  it("honours a custom user and remote temp path", () => {
    const args = buildTokenScpArgs({
      name: "m", localPath: "/x/cli.toml", user: "ops", remoteTmp: "/tmp/t.toml",
    });
    expect(args.at(-1)).toBe("ops@m:/tmp/t.toml");
  });

  it("never embeds token material — copies the FILE, only paths are in argv", () => {
    const args = buildTokenScpArgs({ name: "m", localPath: "/x/cli.toml" });
    expect(args.join(" ")).not.toMatch(/[a-f0-9]{32,}/); // no token-looking blob
  });
});

describe("buildTokenInstallCommand", () => {
  it("creates the config dir, moves the temp file in, and locks it to 0600", () => {
    expect(buildTokenInstallCommand()).toBe(
      "mkdir -p /home/dev/.config/hcloud && " +
        "mv /home/dev/.hcloud-cli.toml.tmp /home/dev/.config/hcloud/cli.toml && " +
        "chmod 600 /home/dev/.config/hcloud/cli.toml",
    );
  });

  it("lands the token at the path MGMT.md / box-watch.service expect", () => {
    expect(buildTokenInstallCommand()).toContain(MGMT_HCLOUD_CONFIG_PATH);
    expect(MGMT_HCLOUD_CONFIG_PATH).toBe("/home/dev/.config/hcloud/cli.toml");
  });

  it("honours a custom remote temp path", () => {
    expect(buildTokenInstallCommand({ remoteTmp: "/tmp/t.toml" })).toContain("mv /tmp/t.toml ");
  });
});

describe("buildCloudInitDoneCheck", () => {
  it("tests for the marker cloud-init-mgmt.yaml touches at the end of first-boot", () => {
    expect(buildCloudInitDoneCheck()).toBe("test -f /home/dev/.cloud-init-done");
  });
});
