import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import {
  buildTailnetSshArgs, checkPrereqs, cleanHostkey, getServer, listServers,
  resolveTargetName, runHcloud, runSsh, serverIp, tailnetReachable,
} from "../lib/hcloud";

// After a snapshot-recreate the devcontainer exists but is stopped — start it,
// then attach the devcontainer tmux. (Avoids `container.sh work`, which re-runs
// `devcontainer up`.) Falls back to a clear message if first-time setup is missing.
const REMOTE_WORK =
  'cd ~/test-mvp 2>/dev/null && { ./scripts/container.sh start >/dev/null 2>&1; ./scripts/container.sh tmux; }' +
  ' || echo "Repo not in ~/test-mvp — run first-time setup (provision)."';

export function workCommand(): Command {
  return new Command("work")
    .description("SSH in and drop straight into the devcontainer tmux session (tailnet by name, hcloud break-glass)")
    .argument("[box]", "box name or id (default: the configured box)")
    .action((boxArg: string | undefined) => {
      const cfg = resolveConfig();
      const name = boxArg?.trim() || cfg.name;

      // Tailnet first: `ssh -t dev@<name>` over the tailnet (no hcloud call).
      if (tailnetReachable(name)) {
        cleanHostkey(name); // host key churns across `up` — see cleanHostkey
        const res = runSsh(buildTailnetSshArgs({ name, tty: true, command: [REMOTE_WORK] }));
        process.exit(res.code);
      }

      // Break-glass: not on the tailnet (or an id selector) → hcloud server ssh by IP.
      const prereq = checkPrereqs();
      if (!prereq.ok) {
        console.error(`Error: ${prereq.error}`);
        process.exit(1);
      }
      const servers = listServers();
      const resolved = resolveTargetName({ selector: boxArg }, cfg.name, servers);
      if (resolved.error) {
        console.error(`Error: ${resolved.error}`);
        process.exit(1);
      }
      const bgName = resolved.name!;

      const server = getServer(bgName);
      if (!server) {
        console.error(`Error: '${bgName}' is down (and not on the tailnet). Run \`box up ${bgName === cfg.name ? "" : bgName}\`.`.trimEnd());
        process.exit(1);
      }

      cleanHostkey(serverIp(server));
      const res = runHcloud(["server", "ssh", bgName, "-u", "dev", "-t", "--", REMOTE_WORK], { inherit: true });
      process.exit(res.code);
    });
}
