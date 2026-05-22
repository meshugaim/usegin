import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import {
  checkPrereqs, cleanHostkey, getServer, listServers, resolveTargetName, runHcloud, serverIp,
} from "../lib/hcloud";

export function sshCommand(): Command {
  return new Command("ssh")
    .description("Shell into a box as the dev user (pass a command after `--`)")
    .argument("[box]", "box name or id (default: the configured box)")
    .argument("[command...]", "optional command to run instead of an interactive shell")
    .action((boxArg: string | undefined, command: string[]) => {
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
      const res = runHcloud(["server", "ssh", name, "-u", "dev", ...command], { inherit: true });
      process.exit(res.code);
    });
}
