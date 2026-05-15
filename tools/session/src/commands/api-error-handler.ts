/**
 * Translate `ApiClientError` (from `finder/api-client.ts`) into a clean
 * user-facing message on stderr.
 *
 * Without this, an unhandled `ApiClientError` propagates out of `runList` /
 * `runSearch` and Bun prints a stack trace — which trains users to ignore
 * "the CLI crashed" instead of "you need to run `effi auth login`."
 *
 * Returns `true` when the error was an `ApiClientError` (caller should
 * `process.exit(1)`), `false` otherwise (caller should re-throw — it's
 * not ours to translate).
 */

interface ApiClientErrorShape {
  name: string;
  kind: string;
  status?: number;
  message: string;
}

function isApiClientError(err: unknown): err is ApiClientErrorShape {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { name?: unknown }).name === "ApiClientError" &&
    typeof (err as { kind?: unknown }).kind === "string" &&
    typeof (err as { message?: unknown }).message === "string"
  );
}

export function handleApiClientError(
  err: unknown,
  errorLog: (line: string) => void,
): boolean {
  if (!isApiClientError(err)) return false;

  switch (err.kind) {
    case "auth_failed":
      errorLog(
        "Authentication required. Run `effi auth login` to set up credentials, then retry.",
      );
      return true;
    case "kill_switch":
      errorLog(
        "Sync is disabled by the server kill switch — remote session APIs are currently unavailable.",
      );
      return true;
    case "transient":
      errorLog(
        `Transient server error (HTTP ${err.status ?? "5xx"}). Retry in a moment.`,
      );
      return true;
    case "not_found":
      // 404 isn't currently surfaced through list/search at the time of this
      // writing (see finder/api-client.ts:classifyError) — they return empty
      // results. Future code paths that DO get a 404 land here with a plain
      // render.
      errorLog("Not found.");
      return true;
    case "other":
      errorLog(`Request failed: ${err.message}`);
      return true;
    default:
      // Unknown kind — a future contributor extended ApiErrorKind without
      // teaching this translator about it. Don't leak a Bun stack trace:
      // render the underlying message verbatim and consume the error.
      // The caller still exits 1 via the same handled-true path.
      errorLog(`Request failed (${err.kind}): ${err.message}`);
      return true;
  }
}
