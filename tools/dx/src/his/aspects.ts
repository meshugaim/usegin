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

function loadRegistry(): Map<string, AspectDef> {
  const out = new Map<string, AspectDef>();
  const raw = aspectsJson as Record<string, unknown>;
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
