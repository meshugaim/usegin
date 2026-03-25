#!/usr/bin/env bun
/**
 * Background watcher process — spawned by `plan watch`.
 *
 * Watches `description.md` for changes, debounces writes, and pushes
 * the description to Linear. Exits after an idle timeout.
 *
 * Invocation:  bun watcher.ts <issueDir> <identifier> <timeoutMs> <apiKey>
 *   - timeoutMs: "0" means no idle timeout
 */

import { readFileSync, writeFileSync, appendFileSync, watch as fsWatch } from "fs";
import { join } from "path";
import { readCheckoutMeta, writeCheckoutMeta, hashDescription } from "./checkout-meta";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const [issueDir, identifier, timeoutMsStr, apiKey] = process.argv.slice(2);

if (!issueDir || !identifier || !timeoutMsStr || !apiKey) {
  console.error("watcher: missing required arguments");
  process.exit(1);
}

const timeoutMs = parseInt(timeoutMsStr, 10);
const descPath = join(issueDir, "description.md");
const logPath = join(issueDir, ".watch.log");

function log(msg: string): void {
  const ts = new Date().toISOString();
  appendFileSync(logPath, `[${ts}] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Push logic (inlined to avoid complex imports in a detached process)
// ---------------------------------------------------------------------------
async function pushDescription(): Promise<void> {
  try {
    const description = readFileSync(descPath, "utf-8");
    const meta = readCheckoutMeta(issueDir);
    if (!meta) {
      log("No meta found — skipping push");
      return;
    }

    const currentHash = hashDescription(description);
    if (currentHash === meta.descriptionHash) {
      log("No changes to push");
      return;
    }

    // Use the Linear SDK to push
    const { LinearClient } = await import("./linear-client");
    const client = new LinearClient({ apiKey });
    await client.updateIssue(identifier, { description });

    // Update meta
    const pushedAt = new Date().toISOString();
    writeCheckoutMeta(issueDir, {
      ...meta,
      descriptionHash: currentHash,
      fetchedAt: pushedAt,
      pushedAt,
    });

    log(`Pushed description (${Buffer.byteLength(description, "utf-8")} bytes)`);
  } catch (err) {
    log(`Push failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Debounce + idle timeout
// ---------------------------------------------------------------------------
const DEBOUNCE_MS = 2_000;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  if (timeoutMs > 0) {
    idleTimer = setTimeout(async () => {
      log("Idle timeout reached — pushing pending changes and exiting");
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      await pushDescription();
      log("Watcher exiting (idle timeout)");
      process.exit(0);
    }, timeoutMs);
  }
}

function onFileChange(): void {
  resetIdleTimer();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    await pushDescription();
  }, DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Start watching
// ---------------------------------------------------------------------------
log(`Watcher started for ${identifier} (timeout: ${timeoutMs}ms)`);
resetIdleTimer();

try {
  const watcher = fsWatch(descPath, (_event) => {
    onFileChange();
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    log("Received SIGTERM — pushing pending changes and exiting");
    if (idleTimer) clearTimeout(idleTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
    watcher.close();
    await pushDescription();
    log("Watcher exiting (SIGTERM)");
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    log("Received SIGINT — exiting");
    watcher.close();
    process.exit(0);
  });
} catch (err) {
  log(`Failed to start watcher: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
