/**
 * Simple file-based cache for Linear API responses
 */

import { homedir } from "os";
import { mkdir } from "fs/promises";

const CACHE_DIR = `${homedir()}/.cache/plan-cli`;
const CACHE_FILE = `${CACHE_DIR}/cache.json`;
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface CacheData {
  teams: Record<string, CacheEntry<{ id: string; key: string; name: string }>>;
  states: Record<string, CacheEntry<Array<{ id: string; name: string; type: string }>>>;
  labels: Record<string, CacheEntry<Array<{ id: string; name: string }>>>;
  projects: Record<string, CacheEntry<{ id: string; name: string }>>;
  viewer: CacheEntry<{ id: string; name: string; displayName: string }> | null;
}

const emptyCache: CacheData = {
  teams: {},
  states: {},
  labels: {},
  projects: {},
  viewer: null,
};

let memoryCache: CacheData | null = null;

async function ensureCacheDir(): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
  } catch {
    // Ignore if already exists
  }
}

async function loadCache(): Promise<CacheData> {
  if (memoryCache) return memoryCache;

  try {
    const file = Bun.file(CACHE_FILE);
    if (await file.exists()) {
      const content = await file.text();
      memoryCache = JSON.parse(content);
      return memoryCache!;
    }
  } catch {
    // Corrupted cache, start fresh
  }

  memoryCache = { ...emptyCache };
  return memoryCache;
}

async function saveCache(): Promise<void> {
  if (!memoryCache) return;

  await ensureCacheDir();
  await Bun.write(CACHE_FILE, JSON.stringify(memoryCache, null, 2));
}

function isExpired<T>(entry: CacheEntry<T> | null | undefined): boolean {
  if (!entry) return true;
  return Date.now() > entry.expiresAt;
}

// Team cache
export async function getCachedTeam(
  key: string
): Promise<{ id: string; key: string; name: string } | null> {
  const cache = await loadCache();
  const entry = cache.teams[key];
  if (isExpired(entry)) return null;
  return entry.data;
}

export async function setCachedTeam(
  key: string,
  team: { id: string; key: string; name: string }
): Promise<void> {
  const cache = await loadCache();
  cache.teams[key] = {
    data: team,
    expiresAt: Date.now() + DEFAULT_TTL_MS,
  };
  await saveCache();
}

// States cache (by team ID)
export async function getCachedStates(
  teamId: string
): Promise<Array<{ id: string; name: string; type: string }> | null> {
  const cache = await loadCache();
  const entry = cache.states[teamId];
  if (isExpired(entry)) return null;
  return entry.data;
}

export async function setCachedStates(
  teamId: string,
  states: Array<{ id: string; name: string; type: string }>
): Promise<void> {
  const cache = await loadCache();
  cache.states[teamId] = {
    data: states,
    expiresAt: Date.now() + DEFAULT_TTL_MS,
  };
  await saveCache();
}

// Labels cache (by team ID)
export async function getCachedLabels(
  teamId: string
): Promise<Array<{ id: string; name: string }> | null> {
  const cache = await loadCache();
  const entry = cache.labels[teamId];
  if (isExpired(entry)) return null;
  return entry.data;
}

export async function setCachedLabels(
  teamId: string,
  labels: Array<{ id: string; name: string }>
): Promise<void> {
  const cache = await loadCache();
  cache.labels[teamId] = {
    data: labels,
    expiresAt: Date.now() + DEFAULT_TTL_MS,
  };
  await saveCache();
}

// Projects cache (by name, lowercase)
export async function getCachedProject(
  name: string
): Promise<{ id: string; name: string } | null> {
  const cache = await loadCache();
  const entry = cache.projects[name.toLowerCase()];
  if (isExpired(entry)) return null;
  return entry.data;
}

export async function setCachedProject(
  name: string,
  project: { id: string; name: string }
): Promise<void> {
  const cache = await loadCache();
  cache.projects[name.toLowerCase()] = {
    data: project,
    expiresAt: Date.now() + DEFAULT_TTL_MS,
  };
  await saveCache();
}

// Viewer cache
export async function getCachedViewer(): Promise<{
  id: string;
  name: string;
  displayName: string;
} | null> {
  const cache = await loadCache();
  if (isExpired(cache.viewer)) return null;
  return cache.viewer?.data ?? null;
}

export async function setCachedViewer(viewer: {
  id: string;
  name: string;
  displayName: string;
}): Promise<void> {
  const cache = await loadCache();
  cache.viewer = {
    data: viewer,
    expiresAt: Date.now() + DEFAULT_TTL_MS,
  };
  await saveCache();
}

// Clear cache
export async function clearCache(): Promise<void> {
  memoryCache = { ...emptyCache };
  try {
    const file = Bun.file(CACHE_FILE);
    if (await file.exists()) {
      const fs = await import("fs/promises");
      await fs.unlink(CACHE_FILE);
    }
  } catch {
    // Ignore
  }
}

// Get cache stats
export async function getCacheStats(): Promise<{
  teams: number;
  states: number;
  labels: number;
  projects: number;
  hasViewer: boolean;
}> {
  const cache = await loadCache();
  return {
    teams: Object.keys(cache.teams).filter((k) => !isExpired(cache.teams[k])).length,
    states: Object.keys(cache.states).filter((k) => !isExpired(cache.states[k])).length,
    labels: Object.keys(cache.labels).filter((k) => !isExpired(cache.labels[k])).length,
    projects: Object.keys(cache.projects).filter((k) => !isExpired(cache.projects[k])).length,
    hasViewer: !isExpired(cache.viewer),
  };
}
