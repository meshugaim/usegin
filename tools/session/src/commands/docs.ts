import { loadAllDocs, findDoc } from "../../../docs-registry/src/shared";
import { join, dirname } from "path";

function getSessionDocsDir(internal = false): string {
  // Resolve from src/commands/ to root/docs
  const base = join(dirname(dirname(import.meta.dir)), "docs");
  return internal ? join(base, "internal") : base;
}

export function runDocs(args: string[]): void {
  const { user, internal } = loadAllDocs(getSessionDocsDir);
  const allDocs = [...user, ...internal];

  const sub = args[0];

  // "session docs show <ref>"
  if (sub === "show" || sub === "get") {
    const ref = args[1];
    if (!ref) {
      console.error("Usage: session docs show <handle|number>");
      process.exit(1);
    }
    const doc = findDoc(ref, allDocs);
    if (!doc) {
      console.error(`Doc not found: ${ref}\n`);
      if (allDocs.length > 0) {
        console.error("Available docs:");
        for (let i = 0; i < allDocs.length; i++) {
          console.error(`  ${i + 1}  ${allDocs[i].meta.handle}`);
        }
      }
      process.exit(1);
    }
    console.log(doc.content);
    return;
  }

  // Default / "session docs list" / "session docs ls"
  if (allDocs.length === 0) {
    console.log("No docs found.");
    return;
  }

  let num = 1;
  if (user.length > 0) {
    for (const doc of user) {
      const n = (num++).toString().padStart(2);
      console.log(`${n}  ${doc.meta.name.padEnd(50)} [${doc.meta.type}]`);
      console.log(`    ${doc.meta.context}`);
    }
  }
  if (internal.length > 0) {
    if (user.length > 0) console.log();
    console.log("─── internal ───");
    console.log();
    for (const doc of internal) {
      const n = (num++).toString().padStart(2);
      console.log(`${n}  ${doc.meta.name.padEnd(50)} [${doc.meta.type}]`);
      console.log(`    ${doc.meta.context}`);
    }
  }
  console.log();
  console.log("Use: session docs show <handle|number>");
}
