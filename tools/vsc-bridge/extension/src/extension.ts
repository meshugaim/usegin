import * as vscode from "vscode";
import { startServer, stopServer, setStatusCallback, setLogger } from "./server";
import { VERSION } from "../../shared/version";

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

function log(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(`[vsc-bridge] ${line}`);
  outputChannel?.appendLine(line);
}

function updateStatusBar(status: "running" | "error" | "stopped", port?: number) {
  if (!statusBarItem) return;

  switch (status) {
    case "running":
      statusBarItem.text = `$(plug) VSC :${port}`;
      statusBarItem.tooltip = `VSC Bridge ${VERSION} running on port ${port}`;
      statusBarItem.backgroundColor = undefined;
      break;
    case "error":
      statusBarItem.text = `$(warning) VSC Bridge`;
      statusBarItem.tooltip = "VSC Bridge encountered an error";
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground"
      );
      break;
    case "stopped":
      statusBarItem.text = `$(circle-slash) VSC Bridge`;
      statusBarItem.tooltip = "VSC Bridge is stopped";
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
      break;
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Create output channel first so we can log
  outputChannel = vscode.window.createOutputChannel("VSC Bridge");
  context.subscriptions.push(outputChannel);

  log("Extension activating...");

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = `$(sync~spin) VSC Bridge ${VERSION}`;
  statusBarItem.tooltip = "VSC Bridge is starting...";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Set up status callback and logger before starting server
  setStatusCallback((status, port) => {
    log(`Status changed to: ${status}${port ? ` (port ${port})` : ""}`);
    updateStatusBar(status, port);
  });
  setLogger(log);

  startServer();
  log("Extension activated");
}

export function deactivate() {
  log("Extension deactivating...");
  stopServer();
  if (statusBarItem) {
    statusBarItem.dispose();
  }
  log("Extension deactivated");
}
