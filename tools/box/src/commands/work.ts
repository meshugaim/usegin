import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import {
  checkPrereqs, cleanHostkey, getServer, listServers, resolveTargetName, runHcloud, serverIp,
} from "../lib/hcloud";

// After a snapshot-recreate the devcontainer exists but is stopped — start it,
// then attach the devcontainer tmux. (Avoids `container.sh work`, which re-runs
// `devcontainer up`.) Falls back to a clear message if first-time setup is missing.
const REMOTE_WORK =
  'cd ~/test-mvp 2>/dev/null && { ./scripts/container.sh start >/dev/null 2>&1; ./scripts/container.sh tmux; }' +
  ' || echo "Repo not in ~/test-mvp — run first-time setup (provision)."';

export function workCommand(): Command {
  return new Command("work")
    .description("SSH in and drop straight into the devcontainer tmux session")
    .argument("[box]", "box name or id (default: the configured box)")
    .action((boxArg: string | undefined) => {
      const prereq = checkPrereqs();
      if (!prereq.ok) {
        console.error(`Error: ${prereq.error}`);
        process.exit(1);
      }

      const cfg = resolveConfig();
      const servers = listServers();
      const resolved = resolveTargetName({ selector: boxArg }, cfg.name, servers);
      if (resolved.error) {
        console.error(`Error: ${resolved.error}`);
        process.exit(1);
      }
      const name = resolved.name!;

      const server = getServer(name);
      if (!server) {
        console.error(`Error: '${name}' is down. Run \`box up ${name === cfg.name ? "" : name}\`.`.trimEnd());
        process.exit(1);
      }

      cleanHostkey(serverIp(server));
      const res = runHcloud(["server", "ssh", name, "-u", "dev", "-t", "--", REMOTE_WORK], { inherit: true });
      process.exit(res.code);
    });
}
