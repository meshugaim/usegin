import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";

export const CLONES_DIR = ".clones";

export function buildClonePath(name: string, clonesDir = CLONES_DIR): string {
  return `${clonesDir}/${name}`;
}

export async function listCloneDirectories(): Promise<string[]> {
  if (!existsSync(CLONES_DIR)) {
    return [];
  }
  const entries = await readdir(CLONES_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}
