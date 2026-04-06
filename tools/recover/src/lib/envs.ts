/**
 * Environment → Supabase project-ref mapping and safety guards.
 *
 * Both refs are hardcoded and match tools/project-clone/src/api.ts. Recovery
 * is an engineer-gated mutation path, so an explicit `--env` is *required*
 * (no default). This is stricter than railway-dev, which defaults reads to
 * production, because writes have a much higher blast radius than reads.
 */

export const PROD_REF = "becbrfnfxrgezhtkrsrm";
export const STAGING_REF = "jmmnzhmbkqfuogrervmn";

export const ENVIRONMENTS = ["production", "staging"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export function projectRefFor(env: Environment): string {
  switch (env) {
    case "production":
      return PROD_REF;
    case "staging":
      return STAGING_REF;
  }
}

/**
 * Validate that an --env value is recognized. Returns the narrowed type or
 * throws an error with the list of accepted values. Called at the top of
 * each command.
 */
export function parseEnv(value: string | undefined): Environment {
  if (!value) {
    throw new Error(
      `--env is required (one of: ${ENVIRONMENTS.join(", ")}). ` +
        "Recovery mutates state; we require an explicit env for safety."
    );
  }
  if ((ENVIRONMENTS as readonly string[]).includes(value)) {
    return value as Environment;
  }
  throw new Error(
    `Invalid --env '${value}'. Accepted: ${ENVIRONMENTS.join(", ")}.`
  );
}

/**
 * For production + --execute we require an additional `--yes-i-am-sure` flag.
 * The reason is that `recover project <uuid> --execute` in production can
 * touch many rows, and a typo in the project UUID could affect the wrong
 * project. The extra flag forces a second pause.
 */
export function requireProdConfirmation(
  env: Environment,
  execute: boolean,
  yesIAmSure: boolean
): void {
  if (env === "production" && execute && !yesIAmSure) {
    throw new Error(
      "production + --execute requires --yes-i-am-sure. " +
        "Try your command against --env staging first, or add --dry-run to preview."
    );
  }
}
