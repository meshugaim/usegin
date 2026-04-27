import aspectsJson from "./aspects.json" with { type: "json" };

export type Bucket = "human" | "claude" | "shared";

export type AspectDef = {
  key: string;
  bucket: Bucket;
  aliases: string[];
  hint?: string;
};

type RawAspect = { aliases?: string[]; hint?: string };

const BUCKETS: Bucket[] = ["human", "claude", "shared"];
const KNOWN_ASPECT_FIELDS = new Set(["aliases", "hint"]);
const KNOWN_TOP_FIELDS = new Set<string>([...BUCKETS, "_doc", "_scale"]);

/**
 * Validate the aspect registry on load. We don't throw on findings — telemetry
 * must never block normal flow — but we emit warnings to stderr so typos like
 * `alaises` get surfaced instead of silently dropped. Suppress with
 * `DX_HIS_QUIET=1` (used in tests).
 */
function validateRegistry(raw: Record<string, unknown>, warn: (msg: string) => void) {
  for (const key of Object.keys(raw)) {
    if (!KNOWN_TOP_FIELDS.has(key)) {
      warn(`unknown top-level key in aspects.json: "${key}" — expected one of ${[...KNOWN_TOP_FIELDS].join(", ")}`);
    }
  }
  const seenKeys = new Map<string, Bucket>();
  const seenAliases = new Map<string, string>();
  for (const bucket of BUCKETS) {
    const entries = raw[bucket];
    if (entries === undefined) continue;
    if (typeof entries !== "object" || entries === null || Array.isArray(entries)) {
      warn(`bucket "${bucket}" must be an object — got ${Array.isArray(entries) ? "array" : typeof entries}`);
      continue;
    }
    for (const [aspectKey, def] of Object.entries(entries as Record<string, unknown>)) {
      const prevBucket = seenKeys.get(aspectKey);
      if (prevBucket && prevBucket !== bucket) {
        warn(`aspect "${aspectKey}" appears in both "${prevBucket}" and "${bucket}" — last wins`);
      }
      seenKeys.set(aspectKey, bucket);
      if (typeof def !== "object" || def === null || Array.isArray(def)) {
        warn(`aspect "${aspectKey}" must be an object — got ${typeof def}`);
        continue;
      }
      for (const field of Object.keys(def)) {
        if (!KNOWN_ASPECT_FIELDS.has(field)) {
          warn(`aspect "${aspectKey}" has unknown field "${field}" — expected one of ${[...KNOWN_ASPECT_FIELDS].join(", ")} (typo for "aliases"?)`);
        }
      }
      const aliases = (def as RawAspect).aliases;
      if (aliases !== undefined) {
        if (!Array.isArray(aliases)) {
          warn(`aspect "${aspectKey}".aliases must be an array of strings`);
        } else {
          for (const alias of aliases) {
            if (typeof alias !== "string" || alias.length === 0) {
              warn(`aspect "${aspectKey}" has invalid alias: ${JSON.stringify(alias)}`);
              continue;
            }
            const lower = alias.toLowerCase();
            const collision = seenAliases.get(lower);
            if (collision && collision !== aspectKey) {
              warn(`alias "${alias}" claimed by both "${collision}" and "${aspectKey}" — first wins`);
            } else {
              seenAliases.set(lower, aspectKey);
            }
            if (seenKeys.has(lower) && seenKeys.get(lower) !== undefined && lower !== aspectKey.toLowerCase()) {
              warn(`alias "${alias}" collides with aspect key "${lower}"`);
            }
          }
        }
      }
    }
  }
}

function loadRegistry(): Map<string, AspectDef> {
  const out = new Map<string, AspectDef>();
  const raw = aspectsJson as Record<string, unknown>;
  const quiet = process.env.DX_HIS_QUIET === "1";
  validateRegistry(raw, (msg) => {
    if (!quiet) process.stderr.write(`[dx his] aspects.json: ${msg}\n`);
  });
  for (const bucket of BUCKETS) {
    const entries = raw[bucket];
    if (!entries || typeof entries !== "object") continue;
    for (const [key, def] of Object.entries(entries as Record<string, RawAspect>)) {
      out.set(key, {
        key,
        bucket,
        aliases: def?.aliases ?? [],
        hint: def?.hint,
      });
    }
  }
  return out;
}

/** Test-only: validate any registry shape without touching the on-disk one. */
export function validateRegistryForTest(raw: Record<string, unknown>): string[] {
  const warnings: string[] = [];
  validateRegistry(raw, (m) => warnings.push(m));
  return warnings;
}

const REGISTRY = loadRegistry();

const ALIAS_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const def of REGISTRY.values()) {
    m.set(def.key.toLowerCase(), def.key);
    for (const alias of def.aliases) m.set(alias.toLowerCase(), def.key);
  }
  return m;
})();

export function resolveAspect(input: string): string {
  const lower = input.toLowerCase().trim();
  return ALIAS_INDEX.get(lower) ?? input;
}

export function knownAspect(key: string): AspectDef | undefined {
  return REGISTRY.get(key);
}

export function listAspects(bucket?: Bucket): AspectDef[] {
  const all = [...REGISTRY.values()];
  return bucket ? all.filter((a) => a.bucket === bucket) : all;
}

export function aspectKeysByBucket(bucket: Bucket): string[] {
  return listAspects(bucket).map((a) => a.key);
}
