import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import {
  buildBreakGlassArgs, buildTailnetSshArgs, checkPrereqs, cleanHostkey, getServer, listServers,
  resolveTargetName, runHcloud, runSsh, serverIp, tailnetReachable,
} from "../lib/hcloud";

export function sshCommand(): Command {
  return new Command("ssh")
    .description("Shell into a box as the dev user — tailnet by name, hcloud break-glass (pass a command after `--`)")
    .argument("[box]", "box name or id (default: the configured box)")
    .argument("[command...]", "optional command to run instead of an interactive shell")
    .action((boxArg: string | undefined, command: string[]) => {
      const cfg = resolveConfig();
      const name = boxArg?.trim() || cfg.name;

      // Tailnet first: `ssh dev@<name>` over the tailnet. No hcloud call, so this
      // works from token-free work boxes (slice 6) and is the no-IP/no-churn path.
      if (tailnetReachable(name)) {
        cleanHostkey(name); // host key churns across `up` — see cleanHostkey
        const res = runSsh(buildTailnetSshArgs({ name, command }));
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
      const res = runHcloud(buildBreakGlassArgs({ name: bgName, command }), { inherit: true });
      process.exit(res.code);
    });
}
