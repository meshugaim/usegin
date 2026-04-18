/**
 * `Turn[]` fixture helpers for `session code-history` extractor tests.
 *
 * These helpers build valid `Turn` objects per `../../../types.ts`
 * WITHOUT going through `parse-turns.ts` — they are independent of the
 * entry→turn parser so extractor tests can craft the exact `Turn[]`
 * shapes they need (command caveats, bash+result pairs, tool-result-only
 * user turns, etc.) without wiring fake JSONL entries.
 *
 * Scope boundary:
 *   - This file produces `Turn[]` only. It does NOT touch commit-fixture
 *     machinery (see `./helpers.ts` for `FixtureCommitSpec` / git repos).
 *     Slice 4 (ENG-5043) wires the two together at a higher layer.
 *   - The current helpers (`makeUserTurn` / `makeAssistantTurn` /
 *     `makeBashTurn`) stay stable: future extractor slices extend this
 *     module rather than modifying these three, so existing tests keep
 *     reading the same shape.
 *
 * Why not reuse `src/testing/turns.ts`?
 *   The top-level `userTurn`/`assistantTurn` factories require a UUID as
 *   the first positional arg — a natural fit for parser/formatter tests
 *   that need to assert on specific UUIDs. Extractor tests care about
 *   `text` / `toolCalls` / `toolResults` and rarely about UUID values,
 *   so these helpers default the UUID to an auto-incrementing string
 *   and accept the caller's text as the first arg. Colocated here to
 *   signal that the defaults are tuned for code-history extractors.
 */

import type { Turn, ToolCall, ToolResult, EntryUuid, ToolUseId } from "../../../types";
import { asEntryUuid, asToolUseId } from "../../../types";

// ============================================================================
// UUID GENERATION
// ============================================================================

// Module-local counter so callers can omit `uuid` and still get unique ids
// across a single test. Reset on module load (fresh per `bun test` process).
let uuidCounter = 0;

function nextUuid(prefix: string): string {
  uuidCounter += 1;
  return `${prefix}-${String(uuidCounter).padStart(3, "0")}`;
}

// ============================================================================
// USER / ASSISTANT TURN HELPERS
// ============================================================================

export interface MakeUserTurnOptions {
  uuid?: string | EntryUuid;
  timestamp?: string;
}

/**
 * Build a plain user turn carrying `text` (no tool results).
 *
 * Defaults: fresh auto-generated UUID, `isOnCurrentBranch: true`.
 *
 * Does NOT trim text — tests construct literal strings; callers needing
 * production-equivalent (trim + whitespace-collapse as applied by
 * `parse-turn.ts` / `truncate` in `context.ts`) must pre-trim.
 */
export function makeUserTurn(text: string, opts: MakeUserTurnOptions = {}): Turn {
  const uuid = opts.uuid ?? nextUuid("u");
  return {
    role: "user",
    uuid: typeof uuid === "string" ? asEntryUuid(uuid) : uuid,
    text,
    toolCalls: [],
    toolResults: [],
    isOnCurrentBranch: true,
    ...(opts.timestamp !== undefined ? { timestamp: opts.timestamp } : {}),
  };
}

export interface MakeAssistantTurnOptions {
  /** Assistant-visible text (defaults to empty string). */
  text?: string;
  /**
   * Convenience for "assistant ran a single Bash command". Equivalent to
   * passing `toolCalls: [{ id, name: "Bash", input: { command: bash } }]`.
   * Mutually compatible with `toolResults` — useful when a caller wants to
   * craft the tool_use side only and omit the matching result turn.
   */
  bash?: string;
  /** Tool calls made by the assistant (e.g. from `toolCall()` in testing/). */
  toolCalls?: ToolCall[];
  /**
   * Tool results. Normally these appear on the *next* user turn; including
   * them here is allowed so callers can express "assistant turn carrying
   * its own results" without forcing a 2-turn fixture when the extractor
   * doesn't care about the split.
   */
  toolResults?: ToolResult[];
  uuid?: string | EntryUuid;
  timestamp?: string;
}

/**
 * Build an assistant turn. See `MakeAssistantTurnOptions` for the shape;
 * all fields are optional, so `makeAssistantTurn({})` produces an empty
 * assistant turn (no text, no tools) useful as a bare parent.
 */
export function makeAssistantTurn(opts: MakeAssistantTurnOptions = {}): Turn {
  const uuid = opts.uuid ?? nextUuid("a");
  const toolCalls: ToolCall[] = [...(opts.toolCalls ?? [])];
  if (opts.bash !== undefined) {
    toolCalls.push({
      id: asToolUseId(nextUuid("tool")),
      name: "Bash",
      input: { command: opts.bash },
    });
  }
  return {
    role: "assistant",
    uuid: typeof uuid === "string" ? asEntryUuid(uuid) : uuid,
    text: opts.text ?? "",
    toolCalls,
    toolResults: opts.toolResults ?? [],
    isOnCurrentBranch: true,
    ...(opts.timestamp !== undefined ? { timestamp: opts.timestamp } : {}),
  };
}

export interface MakeBashTurnOptions {
  /** Timestamp on the assistant (Bash call) turn. */
  assistantTimestamp?: string;
  /** Timestamp on the user (tool result) turn. */
  userTimestamp?: string;
}

/**
 * Composite helper for the common "assistant ran Bash, user turn carries
 * the matching tool_result" shape. Returns a 2-element `Turn[]` in
 * conversational order: `[assistant-with-bash, user-with-result]`.
 *
 * The returned tuple shares the same `ToolUseId` between the call and
 * result so extractors that pair calls↔results by `toolUseId` see a
 * consistent graph. `opts.assistantTimestamp` / `opts.userTimestamp`
 * attach realistic timestamps — real Claude Code JSONL always carries
 * them, so slices 4+ that tighten on timestamp presence don't trip on
 * test fixtures.
 */
export function makeBashTurn(
  command: string,
  resultText: string,
  opts: MakeBashTurnOptions = {},
): [Turn, Turn] {
  const toolUseId: ToolUseId = asToolUseId(nextUuid("tool"));
  const assistantUuid = nextUuid("a");
  const userUuid = nextUuid("u");
  const assistant: Turn = {
    role: "assistant",
    uuid: asEntryUuid(assistantUuid),
    text: "",
    toolCalls: [
      {
        id: toolUseId,
        name: "Bash",
        input: { command },
      },
    ],
    toolResults: [],
    isOnCurrentBranch: true,
    ...(opts.assistantTimestamp !== undefined
      ? { timestamp: opts.assistantTimestamp }
      : {}),
  };
  const user: Turn = {
    role: "user",
    uuid: asEntryUuid(userUuid),
    parentUuid: asEntryUuid(assistantUuid),
    text: "",
    toolCalls: [],
    toolResults: [
      {
        toolUseId,
        content: resultText,
        isError: false,
      },
    ],
    isOnCurrentBranch: true,
    ...(opts.userTimestamp !== undefined
      ? { timestamp: opts.userTimestamp }
      : {}),
  };
  return [assistant, user];
}
