import { describe, it, expect } from "bun:test";
import {
  mgmtCloudInitPath,
  setupMgmtScriptPath,
  repoRootPath,
  MGMT_DEFAULT_SIZE,
  MGMT_HCLOUD_CONFIG_PATH,
  MGMT_REPO_DEST,
  MGMT_REPO_RSYNC_PATHS,
  localHcloudConfigPath,
  buildTailscaleUpCommand,
  buildRepoRsyncArgs,
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
  it("streams the script via `bash -s` with no args (the tree is rsync'd in first)", () => {
    // `-s` reads the script from stdin (so the box needn't have it on PATH). No
    // repo-URL arg: setup-mgmt.sh no longer clones — `box mgmt provision` rsyncs
    // the working tree to the box before this runs.
    expect(buildRunSetupCommand()).toBe("bash -s");
  });
});

describe("buildRepoRsyncArgs", () => {
  it("rsyncs the working tree to the box over ssh, auth-free (accept-new host key)", () => {
    const args = buildRepoRsyncArgs({ host: "203.0.113.5", repoRoot: "/local/repo" });
    expect(args).toEqual([
      "-az",
      "--delete",
      "-e", "ssh -o StrictHostKeyChecking=accept-new",
      "--exclude", "node_modules",
      "--exclude", ".git",
      "/local/repo/tools",
      "/local/repo/scripts",
      "/local/repo/package.json",
      "/local/repo/bun.lock",
      "/local/repo/tsconfig.json",
      "dev@203.0.113.5:/home/dev/test-mvp/",
    ]);
  });

  it("excludes node_modules and .git (reinstalled on the box; .git not needed)", () => {
    const args = buildRepoRsyncArgs({ host: "1.2.3.4" });
    expect(args).toContain("node_modules");
    expect(args).toContain(".git");
    // each exclude is preceded by an --exclude flag
    expect(args[args.indexOf("node_modules") - 1]).toBe("--exclude");
    expect(args[args.indexOf(".git") - 1]).toBe("--exclude");
  });

  it("uses the SAME accept-new host-key opt as the break-glass ssh (fresh-box host key)", () => {
    const args = buildRepoRsyncArgs({ host: "1.2.3.4" });
    expect(args).toContain("-e");
    expect(args[args.indexOf("-e") + 1]).toBe("ssh -o StrictHostKeyChecking=accept-new");
  });

  it("targets the repo-root dest and honours a custom user", () => {
    const args = buildRepoRsyncArgs({ host: "box", user: "ops", repoRoot: "/r" });
    expect(args.at(-1)).toBe(`ops@box:${MGMT_REPO_DEST}`);
    expect(MGMT_REPO_DEST).toBe("/home/dev/test-mvp/");
  });

  it("syncs exactly the lean source paths the box needs (not the whole repo)", () => {
    const args = buildRepoRsyncArgs({ host: "h", repoRoot: "/r" });
    for (const rel of MGMT_REPO_RSYNC_PATHS) {
      expect(args).toContain(`/r/${rel}`);
    }
    // no nextjs-app / python-services — the mgmt box never builds or runs them
    expect(args.join(" ")).not.toContain("nextjs-app");
    expect(args.join(" ")).not.toContain("python-services");
  });

  it("trims a trailing slash on repoRoot so joins don't double up", () => {
    const args = buildRepoRsyncArgs({ host: "h", repoRoot: "/r/" });
    expect(args).toContain("/r/tools");
    expect(args).not.toContain("/r//tools");
  });
});

describe("repoRootPath", () => {
  it("resolves to an absolute local repo root that contains the synced artifacts", () => {
    const root = repoRootPath();
    expect(root.startsWith("/")).toBe(true);
    expect(root.endsWith("/")).toBe(false); // trailing slash trimmed for clean joins
    // the artifact paths live under this root (cwd-independent, import.meta-relative)
    expect(setupMgmtScriptPath()).toBe(`${root}/scripts/hetzner/setup-mgmt.sh`);
    expect(mgmtCloudInitPath()).toBe(`${root}/scripts/hetzner/cloud-init-mgmt.yaml`);
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
