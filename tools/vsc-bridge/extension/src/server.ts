import * as vscode from "vscode";
import * as http from "http";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { VERSION } from "../../shared/version";

const PORT_MIN = 7890;
const PORT_MAX = 7899;
const INSTANCES_DIR = path.join(os.homedir(), ".vsc-bridge");
const INSTANCES_FILE = path.join(INSTANCES_DIR, "instances.json");
const MAX_LOG_LINES = 100;

let server: http.Server | null = null;
let currentPort: number | null = null;
let logBuffer: string[] = [];
let statusCallback: ((status: "running" | "error" | "stopped", port?: number) => void) | null = null;
let logger: ((message: string) => void) | null = null;

interface Instance {
  port: number;
  workspace: string;
  version: string;
  startedAt: string;
}

interface InstancesFile {
  instances: Instance[];
}

export function setLogger(fn: (message: string) => void) {
  logger = fn;
}

function log(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  logBuffer.push(line);
  if (logBuffer.length > MAX_LOG_LINES) {
    logBuffer.shift();
  }
  if (logger) {
    logger(message);
  } else {
    console.log(`[vsc-bridge] ${line}`);
  }
}

function logError(message: string, error?: unknown) {
  const errorDetails = error instanceof Error ? `: ${error.message}` : "";
  log(`ERROR: ${message}${errorDetails}`);
}

export function setStatusCallback(
  callback: (status: "running" | "error" | "stopped", port?: number) => void
) {
  statusCallback = callback;
}

function ensureInstancesDir() {
  if (!fs.existsSync(INSTANCES_DIR)) {
    fs.mkdirSync(INSTANCES_DIR, { recursive: true });
  }
}

function readInstances(): InstancesFile {
  try {
    if (fs.existsSync(INSTANCES_FILE)) {
      const data = fs.readFileSync(INSTANCES_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch {
    // Ignore parse errors
  }
  return { instances: [] };
}

function writeInstances(data: InstancesFile) {
  ensureInstancesDir();
  fs.writeFileSync(INSTANCES_FILE, JSON.stringify(data, null, 2));
}

async function isPortAlive(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path: "/status", method: "GET", timeout: 500 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const status = JSON.parse(data);
            resolve(status.running === true);
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function pruneDeadInstances(): Promise<void> {
  const data = readInstances();
  const aliveInstances: Instance[] = [];

  for (const instance of data.instances) {
    const alive = await isPortAlive(instance.port);
    if (alive) {
      aliveInstances.push(instance);
    } else {
      log(`Pruned dead instance on port ${instance.port}`);
    }
  }

  if (aliveInstances.length !== data.instances.length) {
    writeInstances({ instances: aliveInstances });
  }
}

async function findAvailablePort(): Promise<number | null> {
  const data = readInstances();
  const usedPorts = new Set(data.instances.map((i) => i.port));

  for (let port = PORT_MIN; port <= PORT_MAX; port++) {
    if (!usedPorts.has(port)) {
      // Double-check port is actually free
      const alive = await isPortAlive(port);
      if (!alive) {
        return port;
      }
    }
  }
  return null;
}

function registerInstance(port: number) {
  const data = readInstances();
  const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "unknown";

  // Remove any existing entry for this port
  data.instances = data.instances.filter((i) => i.port !== port);

  data.instances.push({
    port,
    workspace,
    version: VERSION,
    startedAt: new Date().toISOString(),
  });

  writeInstances(data);
  log(`Registered instance on port ${port}`);
}

function unregisterInstance(port: number) {
  try {
    const data = readInstances();
    data.instances = data.instances.filter((i) => i.port !== port);
    writeInstances(data);
    log(`Unregistered instance on port ${port}`);
  } catch {
    // Ignore errors during shutdown
  }
}

export async function startServer() {
  log("Starting HTTP server...");

  // Prune dead instances first
  await pruneDeadInstances();

  // Find available port
  const port = await findAvailablePort();
  if (!port) {
    logError("No available ports in range 7890-7899");
    statusCallback?.("error");
    return;
  }

  currentPort = port;
  log(`Using port ${port}`);

  server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.method === "GET" && req.url === "/version") {
      res.writeHead(200);
      res.end(JSON.stringify({ version: VERSION }));
      return;
    }

    if (req.method === "POST" && req.url === "/reload") {
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      // Execute reload after response is sent
      setTimeout(() => {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }, 100);
      return;
    }

    if (req.method === "GET" && req.url === "/status") {
      res.writeHead(200);
      res.end(JSON.stringify({ running: true, port: currentPort, version: VERSION }));
      return;
    }

    if (req.method === "GET" && req.url === "/logs") {
      res.writeHead(200);
      res.end(JSON.stringify({ logs: logBuffer }));
      return;
    }

    if (req.method === "POST" && req.url === "/notify") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const data = JSON.parse(body) as {
            message: string;
            type?: "info" | "warning" | "error";
            modal?: boolean;
            detail?: string;
            buttons?: string[];
            wait?: boolean;
          };

          const options: vscode.MessageOptions = {};
          if (data.modal) {
            options.modal = true;
            if (data.detail) {
              options.detail = data.detail;
            }
          }

          const buttons = data.buttons || [];

          const showNotification = async () => {
            switch (data.type) {
              case "warning":
                return vscode.window.showWarningMessage(data.message, options, ...buttons);
              case "error":
                return vscode.window.showErrorMessage(data.message, options, ...buttons);
              default:
                return vscode.window.showInformationMessage(data.message, options, ...buttons);
            }
          };

          if (data.wait) {
            const clicked = await showNotification();
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, clicked: clicked || null }));
          } else {
            // Fire and forget
            showNotification();
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, clicked: null }));
          }
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Invalid request body" }));
        }
      });
      return;
    }

    if (req.method === "GET" && req.url === "/terminals") {
      const terminals = vscode.window.terminals.map((t, i) => ({
        id: i + 1,
        name: t.name,
        active: t === vscode.window.activeTerminal,
      }));
      res.writeHead(200);
      res.end(JSON.stringify({ terminals }));
      return;
    }

    if (req.method === "POST" && req.url === "/terminals") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const data = JSON.parse(body) as {
            command: string;
            name?: string;
            cwd?: string;
            shellCmd?: boolean;
          };

          let terminal: vscode.Terminal;

          if (data.shellCmd) {
            // Run via bash -c so command string works, terminal closes on exit
            terminal = vscode.window.createTerminal({
              name: data.name || data.command,
              cwd: data.cwd,
              shellPath: "/bin/bash",
              shellArgs: ["-c", data.command],
            });
          } else {
            // Normal mode - send command to default shell
            terminal = vscode.window.createTerminal({
              name: data.name,
              cwd: data.cwd,
            });
            if (data.command) {
              terminal.sendText(data.command);
            }
          }

          terminal.show();
          const id = vscode.window.terminals.indexOf(terminal) + 1;
          res.writeHead(200);
          res.end(JSON.stringify({ id, name: terminal.name }));
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Invalid request body" }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(port, "127.0.0.1", () => {
    log(`Server listening on port ${port}`);
    registerInstance(port);
    statusCallback?.("running", port);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      logError(`Port ${port} is already in use`, err);
    } else {
      logError("Server error", err);
    }
    statusCallback?.("error");
  });

  server.on("close", () => {
    log("Server closed");
    statusCallback?.("stopped");
  });
}

export function stopServer() {
  log("Stopping server...");

  if (server) {
    server.close();
    server = null;
    log("Server instance closed");
  }

  if (currentPort) {
    unregisterInstance(currentPort);
    currentPort = null;
  }

  statusCallback?.("stopped");
}

export function getCurrentPort(): number | null {
  return currentPort;
}
