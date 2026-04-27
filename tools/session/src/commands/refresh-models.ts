import { LITELLM_URL, refreshCache } from "../model-registry";

function printHelp() {
  console.log(`
session refresh-models - Refresh the model context-window + pricing cache

USAGE:
  session refresh-models

Fetches LiteLLM's model_prices_and_context_window.json and writes it to
~/.cache/session/model_prices.json (override path with the
SESSION_MODEL_CACHE_PATH env var).

Run this when a new Claude model ships or when the displayed context %
or cost looks wrong for a recent model.

Source: ${LITELLM_URL}
`);
}

export async function runRefreshModels(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  try {
    const { path, bytes } = await refreshCache();
    const kb = (bytes / 1024).toFixed(1);
    console.log(`Wrote ${kb} KB to ${path}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Refresh failed: ${msg}`);
    process.exit(1);
  }
}
