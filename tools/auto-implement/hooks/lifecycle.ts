#!/usr/bin/env bun
/**
 * Auto-implement hook lifecycle manager
 *
 * Installs and removes the hook guards for auto-implement sessions.
 * Called by auto-implement at session start/end.
 *
 * Usage (CLI):
 *   bun lifecycle.ts install --session-id <id> --spec-id <id> --claude-pid <pid>
 *   bun lifecycle.ts remove
 *   bun lifecycle.ts status
 *
 * Usage (programmatic):
 *   import { installHooks, removeHooks, updatePid, readRotationSignal } from "./lifecycle";
 */

import { existsSync, unlinkSync, writeFileSync, readFileSync, chmodSync } from "fs";
import { resolve } from "path";
import { Command } from "commander";

const ROOT = resolve(import.meta.dirname, "../../..");
const GIT_HOOKS_DIR = resolve(ROOT, ".git/hooks");
const CLAUDE_SETTINGS_LOCAL = resolve(ROOT, ".claude/settings.local.json");
const HOOKS_DIR = resolve(import.meta.dirname);
const CONTEXT_FILE = "/tmp/auto-impl-context.json";
const ROTATION_FILE = "/tmp/auto-impl-rotation.json";

// Paths of hooks we manage
const MANAGED_HOOKS = {
  preCommit: resolve(GIT_HOOKS_DIR, "pre-commit"),
  postCommit: resolve(GIT_HOOKS_DIR, "post-commit"),
};

export interface InstallOptions {
  sessionId: string;
  specId: string;
  claudePid: string;
}

export interface RotationSignal {
  reason: string;
  killed_session_id: string;
  spec_id: string;
  context_percent: number;
  timestamp: string;
}

/**
 * Read the rotation signal file if present.
 * Returns null if no signal exists or it can't be parsed.
 */
export function readRotationSignal(): RotationSignal | null {
  try {
    if (!existsSync(ROTATION_FILE)) return null;
    return JSON.parse(readFileSync(ROTATION_FILE, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Update the claude_pid in the context file.
 * Called after spawning the Claude process to set the real PID.
 */
export function updatePid(pid: number): void {
  try {
    if (!existsSync(CONTEXT_FILE)) return;
    const ctx = JSON.parse(readFileSync(CONTEXT_FILE, "utf-8"));
    ctx.claude_pid = pid;
    writeFileSync(CONTEXT_FILE, JSON.stringify(ctx, null, 2));
  } catch {
    // Best-effort — don't break the session over this
  }
}

export function installHooks(options: InstallOptions) {
  const { sessionId, specId, claudePid } = options;

  console.log("Installing auto-implement hook guards...");

  // 1. Write context file (used by hooks at runtime)
  const context = {
    session_id: sessionId,
    spec_id: specId,
    claude_pid: parseInt(claudePid, 10),
    installed_at: new Date().toISOString(),
  };
  writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2));
  console.log(`  ✓ Context file: ${CONTEXT_FILE}`);

  // 2. Install pre-commit hook (TDD + commit size gates)
  const preCommitContent = [
    "#!/usr/bin/env bash",
    "# Auto-implement pre-commit guard (installed by lifecycle.ts)",
    `exec bash "${resolve(HOOKS_DIR, "pre-commit-guard.sh")}"`,
  ].join("\n");
  writeFileSync(MANAGED_HOOKS.preCommit, preCommitContent);
  chmodSync(MANAGED_HOOKS.preCommit, 0o755);
  console.log(`  ✓ pre-commit hook: ${MANAGED_HOOKS.preCommit}`);

  // 3. Install post-commit hook (context rotation)
  const postCommitContent = [
    "#!/usr/bin/env bash",
    "# Auto-implement post-commit guard (installed by lifecycle.ts)",
    `exec bash "${resolve(HOOKS_DIR, "post-commit-context-rotation.sh")}"`,
  ].join("\n");
  writeFileSync(MANAGED_HOOKS.postCommit, postCommitContent);
  chmodSync(MANAGED_HOOKS.postCommit, 0o755);
  console.log(`  ✓ post-commit hook: ${MANAGED_HOOKS.postCommit}`);

  // 4. Update .claude/settings.local.json with PreToolUse hook for commit frequency gate
  let localSettings: Record<string, unknown> = {};
  if (existsSync(CLAUDE_SETTINGS_LOCAL)) {
    try {
      localSettings = JSON.parse(readFileSync(CLAUDE_SETTINGS_LOCAL, "utf-8"));
    } catch {
      // Start fresh if parse fails
    }
  }

  // Merge our hook into existing hooks (preserve any existing hooks)
  const existingHooks = (localSettings.hooks as Record<string, unknown[]>) || {};
  const existingPreToolUse = (existingHooks.PreToolUse as unknown[]) || [];

  // Add our guard (tagged so we can find it for removal)
  const guardHook = {
    matcher: "Write|Edit",
    hooks: [
      {
        type: "command",
        command: `bun "${resolve(HOOKS_DIR, "commit-frequency-guard.ts")}"`,
      },
    ],
    _autoImplement: true, // marker for removal
  };

  localSettings.hooks = {
    ...existingHooks,
    PreToolUse: [...existingPreToolUse, guardHook],
  };

  writeFileSync(CLAUDE_SETTINGS_LOCAL, JSON.stringify(localSettings, null, 2));
  console.log(`  ✓ PreToolUse hook: ${CLAUDE_SETTINGS_LOCAL}`);

  console.log("\nAll hooks installed. Auto-implement guards are active.");
}

export function removeHooks() {
  console.log("Removing auto-implement hook guards...");

  // 1. Remove git hooks
  for (const [name, path] of Object.entries(MANAGED_HOOKS)) {
    if (existsSync(path)) {
      // Only remove if it's one we installed (check for our marker)
      const content = readFileSync(path, "utf-8");
      if (content.includes("Auto-implement")) {
        unlinkSync(path);
        console.log(`  ✓ Removed ${name}: ${path}`);
      } else {
        console.log(`  ⚠ Skipped ${name}: not ours (${path})`);
      }
    } else {
      console.log(`  - ${name} not present`);
    }
  }

  // 2. Remove our PreToolUse hook from settings.local.json
  if (existsSync(CLAUDE_SETTINGS_LOCAL)) {
    try {
      const localSettings = JSON.parse(readFileSync(CLAUDE_SETTINGS_LOCAL, "utf-8"));
      const hooks = localSettings.hooks as Record<string, unknown[]> | undefined;
      if (hooks?.PreToolUse) {
        hooks.PreToolUse = (hooks.PreToolUse as Array<{ _autoImplement?: boolean }>).filter(
          (h) => !h._autoImplement,
        );
        if (hooks.PreToolUse.length === 0) {
          delete hooks.PreToolUse;
        }
        if (Object.keys(hooks).length === 0) {
          delete localSettings.hooks;
        }
        writeFileSync(CLAUDE_SETTINGS_LOCAL, JSON.stringify(localSettings, null, 2));
        console.log(`  ✓ Removed PreToolUse guard from ${CLAUDE_SETTINGS_LOCAL}`);
      }
    } catch {
      console.log(`  ⚠ Could not parse ${CLAUDE_SETTINGS_LOCAL}`);
    }
  }

  // 3. Remove context file
  if (existsSync(CONTEXT_FILE)) {
    unlinkSync(CONTEXT_FILE);
    console.log(`  ✓ Removed context file: ${CONTEXT_FILE}`);
  }

  // 4. Remove rotation signal if present
  if (existsSync(ROTATION_FILE)) {
    unlinkSync(ROTATION_FILE);
    console.log(`  ✓ Removed rotation signal: ${ROTATION_FILE}`);
  }

  console.log("\nAll hooks removed. Auto-implement guards are inactive.");
}

function status() {
  console.log("Auto-implement hook guard status:\n");

  // Check context file
  if (existsSync(CONTEXT_FILE)) {
    const ctx = JSON.parse(readFileSync(CONTEXT_FILE, "utf-8"));
    console.log(`  Context file: ✓ (session: ${ctx.session_id}, spec: ${ctx.spec_id})`);
  } else {
    console.log("  Context file: ✗ (not installed)");
  }

  // Check git hooks
  for (const [name, path] of Object.entries(MANAGED_HOOKS)) {
    if (existsSync(path)) {
      const content = readFileSync(path, "utf-8");
      const ours = content.includes("Auto-implement");
      console.log(`  ${name}: ${ours ? "✓ (ours)" : "⚠ (exists, not ours)"}`);
    } else {
      console.log(`  ${name}: ✗ (not installed)`);
    }
  }

  // Check PreToolUse hook
  if (existsSync(CLAUDE_SETTINGS_LOCAL)) {
    try {
      const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_LOCAL, "utf-8"));
      const preToolUse = (settings.hooks?.PreToolUse as Array<{ _autoImplement?: boolean }>) || [];
      const hasGuard = preToolUse.some((h) => h._autoImplement);
      console.log(`  PreToolUse guard: ${hasGuard ? "✓" : "✗ (not in settings)"}`);
    } catch {
      console.log("  PreToolUse guard: ⚠ (settings parse error)");
    }
  } else {
    console.log("  PreToolUse guard: ✗ (no local settings)");
  }

  // Check rotation signal
  if (existsSync(ROTATION_FILE)) {
    const rot = JSON.parse(readFileSync(ROTATION_FILE, "utf-8"));
    console.log(`\n  ⚠ Rotation signal present: killed session ${rot.killed_session_id} at ${rot.context_percent}%`);
  }
}

const program = new Command()
  .name("lifecycle")
  .description("Auto-implement hook lifecycle manager");

program
  .command("install")
  .description("Install all hook guards")
  .requiredOption("--session-id <id>", "Claude session ID")
  .requiredOption("--spec-id <id>", "Linear spec/issue ID")
  .requiredOption("--claude-pid <pid>", "Claude process PID")
  .action(installHooks);

program
  .command("remove")
  .description("Remove all hook guards")
  .action(removeHooks);

program
  .command("status")
  .description("Show hook guard status")
  .action(status);

program.parse();
