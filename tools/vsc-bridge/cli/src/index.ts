import { defineCommand, runMain } from "citty";
import { VERSION } from "../../shared/version";
import { readFileSync, existsSync } from "fs";
import { stat } from "fs/promises";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Glob } from "bun";

const INSTANCES_FILE = join(homedir(), ".vsc-bridge", "instances.json");
const PORT_MIN = 7890;
const PORT_MAX = 7899;

interface Instance {
  port: number;
  workspace: string;
  version: string;
  startedAt: string;
}

interface InstancesFile {
  instances: Instance[];
}

function readInstances(): Instance[] {
  try {
    if (existsSync(INSTANCES_FILE)) {
      const data = readFileSync(INSTANCES_FILE, "utf-8");
      const parsed = JSON.parse(data) as InstancesFile;
      return parsed.instances || [];
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

async function isPortAlive(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/status`, {
      signal: AbortSignal.timeout(500),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { running?: boolean };
    return data.running === true;
  } catch {
    return false;
  }
}

async function findAlivePorts(): Promise<number[]> {
  const instances = readInstances();
  const alive: number[] = [];

  // Check registered instances first
  for (const instance of instances) {
    if (await isPortAlive(instance.port)) {
      alive.push(instance.port);
    }
  }

  // Also scan for unregistered instances
  for (let port = PORT_MIN; port <= PORT_MAX; port++) {
    if (!alive.includes(port) && (await isPortAlive(port))) {
      alive.push(port);
    }
  }

  return alive.sort((a, b) => a - b);
}

async function getPort(explicitPort?: number): Promise<number> {
  if (explicitPort) {
    if (await isPortAlive(explicitPort)) {
      return explicitPort;
    }
    console.error(`Extension not running on port ${explicitPort}`);
    process.exit(2);
  }

  const alive = await findAlivePorts();
  if (alive.length === 0) {
    console.error("No VSC Bridge instances running");
    process.exit(2);
  }
  if (alive.length === 1) {
    return alive[0];
  }

  // Multiple instances - use first but warn
  console.error(`Multiple instances found: ${alive.join(", ")}. Using :${alive[0]}`);
  console.error(`Use --port to specify a different instance`);
  return alive[0];
}

async function getExtensionVersion(port: number): Promise<string | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/version`, {
      signal: AbortSignal.timeout(500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version: string };
    return data.version;
  } catch {
    return null;
  }
}

const versionCommand = defineCommand({
  meta: {
    name: "version",
    description: "Check CLI and extension versions match",
  },
  args: {
    port: {
      type: "string",
      alias: "p",
      description: "Port to connect to",
    },
  },
  async run({ args }) {
    const port = await getPort(args.port ? parseInt(args.port, 10) : undefined);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/version`);
      if (!res.ok) {
        console.error("Extension not running (HTTP error)");
        process.exit(2);
      }

      const data = (await res.json()) as { version: string };
      const extensionVersion = data.version;

      if (VERSION === extensionVersion) {
        console.log(`vsc ${VERSION} (extension ${extensionVersion} on :${port}) ✓`);
        process.exit(0);
      } else {
        console.log(
          `vsc ${VERSION} (extension ${extensionVersion} on :${port}) ✗ version mismatch`
        );
        process.exit(1);
      }
    } catch {
      console.error("Extension not running (HTTP server not reachable)");
      process.exit(2);
    }
  },
});

const statusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Show extension status",
  },
  args: {
    port: {
      type: "string",
      alias: "p",
      description: "Port to connect to",
    },
    all: {
      type: "boolean",
      alias: "a",
      description: "Show all running instances",
      default: false,
    },
  },
  async run({ args }) {
    if (args.all) {
      const alive = await findAlivePorts();
      if (alive.length === 0) {
        console.log("No VSC Bridge instances running");
        process.exit(0);
      }
      const instances = readInstances();
      for (const port of alive) {
        const instance = instances.find((i) => i.port === port);
        const workspace = instance?.workspace || "unknown";
        const version = await getExtensionVersion(port);
        console.log(`:${port}  ${version || "?"}  ${workspace}`);
      }
      process.exit(0);
    }

    const port = await getPort(args.port ? parseInt(args.port, 10) : undefined);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/status`);
      if (!res.ok) {
        console.error("Extension not responding");
        process.exit(2);
      }
      const data = (await res.json()) as {
        running: boolean;
        port: number;
        version: string;
      };
      console.log(`VSC Bridge ${data.version} running on port ${data.port}`);
      process.exit(0);
    } catch {
      console.error("Extension not running");
      process.exit(2);
    }
  },
});

const logsCommand = defineCommand({
  meta: {
    name: "logs",
    description: "Show extension logs",
  },
  args: {
    port: {
      type: "string",
      alias: "p",
      description: "Port to connect to",
    },
  },
  async run({ args }) {
    const port = await getPort(args.port ? parseInt(args.port, 10) : undefined);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/logs`);
      if (!res.ok) {
        console.error("Failed to fetch logs");
        process.exit(1);
      }
      const data = (await res.json()) as { logs: string[] };
      for (const line of data.logs) {
        console.log(line);
      }
      process.exit(0);
    } catch {
      console.error("Extension not running");
      process.exit(2);
    }
  },
});

const notifyCommand = defineCommand({
  meta: {
    name: "notify",
    description: "Show a notification in VSCode",
  },
  args: {
    message: {
      type: "positional",
      description: "Message to display",
      required: true,
    },
    port: {
      type: "string",
      alias: "p",
      description: "Port to connect to",
    },
    type: {
      type: "string",
      alias: "t",
      description: "Notification type: info, warning, error",
      default: "info",
    },
    modal: {
      type: "boolean",
      alias: "m",
      description: "Show as modal dialog",
      default: false,
    },
    detail: {
      type: "string",
      alias: "d",
      description: "Detail text (only shown for modal)",
    },
    buttons: {
      type: "string",
      alias: "b",
      description: "Comma-separated button labels",
    },
    wait: {
      type: "boolean",
      alias: "w",
      description: "Wait for user to dismiss/select",
      default: false,
    },
    all: {
      type: "boolean",
      alias: "a",
      description: "Broadcast to all instances",
      default: false,
    },
  },
  async run({ args }) {
    const ports = args.all
      ? await findAlivePorts()
      : [await getPort(args.port ? parseInt(args.port, 10) : undefined)];
    try {
      const body: {
        message: string;
        type?: string;
        modal?: boolean;
        detail?: string;
        buttons?: string[];
        wait?: boolean;
      } = {
        message: args.message,
        type: args.type,
      };
      if (args.modal) {
        body.modal = true;
      }
      if (args.detail) {
        body.detail = args.detail;
      }
      if (args.buttons) {
        body.buttons = args.buttons.split(",").map((b) => b.trim());
      }
      if (args.wait) {
        body.wait = true;
      }

      const results = await Promise.all(
        ports.map(async (port) => {
          const res = await fetch(`http://127.0.0.1:${port}/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            return { port, success: false, clicked: null };
          }
          const data = (await res.json()) as { success: boolean; clicked: string | null };
          return { port, success: true, clicked: data.clicked };
        })
      );

      const failures = results.filter((r) => !r.success);
      if (failures.length === results.length) {
        console.error("Failed to send notification to any instance");
        process.exit(1);
      }

      // Output clicked buttons (for --wait mode)
      for (const r of results) {
        if (r.clicked) {
          if (args.all) {
            console.log(`:${r.port} ${r.clicked}`);
          } else {
            console.log(r.clicked);
          }
        }
      }
      process.exit(0);
    } catch {
      console.error("Extension not running");
      process.exit(2);
    }
  },
});

const reloadCommand = defineCommand({
  meta: {
    name: "reload",
    description: "Reload VSCode window",
  },
  args: {
    port: {
      type: "string",
      alias: "p",
      description: "Port to connect to",
    },
  },
  async run({ args }) {
    const port = await getPort(args.port ? parseInt(args.port, 10) : undefined);
    try {
      console.log(`Reloading VSCode on :${port}...`);
      const res = await fetch(`http://127.0.0.1:${port}/reload`, {
        method: "POST",
      });
      if (!res.ok) {
        console.error("Failed to reload");
        process.exit(1);
      }
      process.exit(0);
    } catch {
      console.error("Extension not running");
      process.exit(2);
    }
  },
});

const terminalListCommand = defineCommand({
  meta: {
    name: "list",
    description: "List all terminals",
  },
  args: {
    port: {
      type: "string",
      alias: "p",
      description: "Port to connect to",
    },
  },
  async run({ args }) {
    const port = await getPort(args.port ? parseInt(args.port, 10) : undefined);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/terminals`);
      if (!res.ok) {
        console.error("Failed to list terminals");
        process.exit(1);
      }
      const data = (await res.json()) as {
        terminals: { id: number; name: string; active: boolean }[];
      };
      for (const t of data.terminals) {
        console.log(`${t.id}: ${t.name}${t.active ? " (active)" : ""}`);
      }
      process.exit(0);
    } catch {
      console.error("Extension not running");
      process.exit(2);
    }
  },
});

const terminalCreateCommand = defineCommand({
  meta: {
    name: "create",
    description: "Create terminal and run command",
  },
  args: {
    command: {
      type: "positional",
      description: "Command to run in the terminal",
      required: true,
    },
    port: {
      type: "string",
      alias: "p",
      description: "Port to connect to",
    },
    shellCmd: {
      type: "boolean",
      alias: "s",
      description: "Run as shell command (for interactive programs)",
      default: false,
    },
  },
  async run({ args }) {
    const port = await getPort(args.port ? parseInt(args.port, 10) : undefined);
    try {
      const body: { command: string; shellCmd?: boolean } = {
        command: args.command,
      };
      if (args.shellCmd) {
        body.shellCmd = true;
      }
      const res = await fetch(`http://127.0.0.1:${port}/terminals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error("Failed to create terminal");
        process.exit(1);
      }
      const data = (await res.json()) as { id: number; name: string };
      console.error(`Created terminal ${data.id}: ${data.name}`);
      process.exit(0);
    } catch {
      console.error("Extension not running");
      process.exit(2);
    }
  },
});

const terminalCommand = defineCommand({
  meta: {
    name: "terminal",
    description: "Manage VSCode terminals",
  },
  subCommands: {
    list: terminalListCommand,
    create: terminalCreateCommand,
  },
});

// Extension directory relative to CLI source
const __dirname = import.meta.dir || dirname(fileURLToPath(import.meta.url));
const EXTENSION_DIR = join(__dirname, "../../extension");

async function findLatestVsix(): Promise<string | null> {
  const glob = new Glob("*.vsix");
  let latest: { path: string; mtime: number } | null = null;

  for await (const file of glob.scan(EXTENSION_DIR)) {
    const fullPath = join(EXTENSION_DIR, file);
    const stats = await stat(fullPath);
    if (!latest || stats.mtimeMs > latest.mtime) {
      latest = { path: fullPath, mtime: stats.mtimeMs };
    }
  }

  return latest?.path ?? null;
}

const extensionReinstallCommand = defineCommand({
  meta: {
    name: "reinstall",
    description: "Reinstall VSCode extension from latest .vsix",
  },
  async run() {
    const vsixPath = await findLatestVsix();

    if (!vsixPath) {
      console.error("No .vsix file found in extension/");
      process.exit(1);
    }

    console.log(`Found: ${vsixPath}`);

    // Uninstall existing extension
    console.log("Uninstalling existing extension...");
    Bun.spawnSync(["code", "--uninstall-extension", "askeffi.vsc-bridge"]);

    // Install new extension
    console.log(`Installing ${vsixPath}...`);
    const install = Bun.spawnSync(["code", "--install-extension", vsixPath, "--force"]);

    if (install.success) {
      console.log("Extension installed successfully!");
      console.log("Reload VS Code to activate (Ctrl+Shift+P → Developer: Reload Window)");
      process.exit(0);
    } else {
      console.error("Installation failed:");
      console.error(install.stderr.toString());
      process.exit(1);
    }
  },
});

const extensionCommand = defineCommand({
  meta: {
    name: "extension",
    description: "Manage VSCode extension",
  },
  subCommands: {
    reinstall: extensionReinstallCommand,
  },
});

const main = defineCommand({
  meta: {
    name: "vsc",
    version: VERSION,
    description: "VSCode Bridge CLI",
  },
  subCommands: {
    version: versionCommand,
    status: statusCommand,
    logs: logsCommand,
    reload: reloadCommand,
    notify: notifyCommand,
    terminal: terminalCommand,
    extension: extensionCommand,
  },
  async run() {
    const alive = await findAlivePorts();
    let status: string;
    if (alive.length === 0) {
      status = "(no instances running)";
    } else if (alive.length === 1) {
      const version = await getExtensionVersion(alive[0]);
      status = version
        ? version === VERSION
          ? `(extension ${version} on :${alive[0]}) ✓`
          : `(extension ${version} on :${alive[0]}) ✗ mismatch`
        : `(running on :${alive[0]})`;
    } else {
      status = `(${alive.length} instances: ${alive.map((p) => `:${p}`).join(", ")})`;
    }

    console.log(`VSCode Bridge CLI (vsc v${VERSION})

USAGE vsc version|status|logs|reload|notify|terminal|extension

COMMANDS

    version    Check CLI and extension versions match
     status    Show extension status (use -a for all)
       logs    Show extension logs
     reload    Reload VSCode window
     notify    Show a notification in VSCode
   terminal    Manage VSCode terminals
  extension    Manage VSCode extension

Use vsc <command> --help for more information about a command.
Use --port/-p to target a specific instance.

${status}`);
  },
});

runMain(main);
