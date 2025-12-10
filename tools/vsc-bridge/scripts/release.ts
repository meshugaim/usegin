#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { $ } from "bun";

const __dirname = import.meta.dir || dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const VERSION_FILE = join(ROOT, "shared/version.ts");
const EXTENSION_DIR = join(ROOT, "extension");
const CLI = join(ROOT, "bin/vsc");

// Read current version
const versionContent = readFileSync(VERSION_FILE, "utf-8");
const match = versionContent.match(/VERSION = "(\d+)\.(\d+)\.(\d+)"/);
if (!match) {
  console.error("Could not parse version");
  process.exit(1);
}

const [, major, minor, patch] = match;
const newPatch = parseInt(patch) + 1;
const newVersion = `${major}.${minor}.${newPatch}`;

console.log(`Bumping version: ${major}.${minor}.${patch} → ${newVersion}`);

// Write new version to shared
writeFileSync(
  VERSION_FILE,
  `export const VERSION = "${newVersion}";\n`
);

// Update extension package.json version
const pkgPath = join(EXTENSION_DIR, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// Build extension
console.log("Building extension...");
await $`cd ${EXTENSION_DIR} && bun run package`.quiet();

// Install extension
const vsix = join(EXTENSION_DIR, `vsc-bridge-${newVersion}.vsix`);
console.log("Installing extension...");
await $`code --install-extension ${vsix} --force`.quiet();

// Reload VSCode (ignore if extension not running - will activate after install)
console.log("Reloading VSCode...");
const reloadResult = await $`${CLI} reload`.nothrow().quiet();
if (reloadResult.exitCode === 2) {
  console.log("Extension not running, will activate after reload.");
  console.log("Please reload VSCode manually (Cmd/Ctrl+Shift+P → Reload Window)");
}

// Wait for reload and verify version (retry with backoff)
console.log("Waiting for extension to activate...");
let verified = false;
for (let i = 0; i < 10; i++) {
  await Bun.sleep(1000);
  const result = await $`${CLI} version`.nothrow().quiet();
  if (result.exitCode === 0) {
    console.log(result.stdout.toString().trim());
    verified = true;
    break;
  }
  process.stdout.write(".");
}
console.log();

if (!verified) {
  console.error("Version mismatch after release!");
  process.exit(1);
}

console.log(`\nRelease ${newVersion} complete!`);
