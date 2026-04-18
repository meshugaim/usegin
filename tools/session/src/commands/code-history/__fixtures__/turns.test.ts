/**
 * Shape tests for the extractor `Turn[]` fixture helpers.
 *
 * These are intentionally decoupled from `parse-turns.ts` — the helpers
 * build `Turn` objects directly, so the only thing to check is that the
 * produced shapes match the `Turn` contract from `../../../types.ts`.
 *
 * Any later Turn-schema change surfaces here first.
 */

import { describe, expect, test } from "bun:test";

import { asEntryUuid } from "../../../types";
import { makeAssistantTurn, makeBashTurn, makeUserTurn } from "./turns";

describe("makeUserTurn", () => {
  test("produces a user turn with text and default flags", () => {
    const turn = makeUserTurn("hello");
    expect(turn.role).toBe("user");
    expect(turn.text).toBe("hello");
    expect(turn.toolCalls).toEqual([]);
    expect(turn.toolResults).toEqual([]);
    expect(turn.isOnCurrentBranch).toBe(true);
    expect(typeof turn.uuid).toBe("string");
  });

  test("honors uuid and timestamp overrides", () => {
    const turn = makeUserTurn("hi", { uuid: "u-custom", timestamp: "2026-01-01T00:00:00Z" });
    expect(turn.uuid).toBe(asEntryUuid("u-custom"));
    expect(turn.timestamp).toBe("2026-01-01T00:00:00Z");
  });
});

describe("makeAssistantTurn", () => {
  test("defaults to empty text and no tools", () => {
    const turn = makeAssistantTurn({});
    expect(turn.role).toBe("assistant");
    expect(turn.text).toBe("");
    expect(turn.toolCalls).toEqual([]);
    expect(turn.toolResults).toEqual([]);
  });

  test("bash shortcut produces a Bash toolCall with the command", () => {
    const turn = makeAssistantTurn({ bash: "git status" });
    expect(turn.toolCalls).toHaveLength(1);
    expect(turn.toolCalls[0]!.name).toBe("Bash");
    expect(turn.toolCalls[0]!.input).toEqual({ command: "git status" });
  });
});

describe("makeBashTurn", () => {
  test("returns [assistant, user] pair sharing a toolUseId", () => {
    const [assistant, user] = makeBashTurn("ls", "file.txt");
    expect(assistant.role).toBe("assistant");
    expect(user.role).toBe("user");
    expect(assistant.toolCalls).toHaveLength(1);
    expect(user.toolResults).toHaveLength(1);
    expect(user.toolResults[0]!.toolUseId).toBe(assistant.toolCalls[0]!.id);
    expect(user.toolResults[0]!.content).toBe("file.txt");
    expect(assistant.toolCalls[0]!.input).toEqual({ command: "ls" });
  });

  test("user turn's parentUuid points at the assistant turn", () => {
    const [assistant, user] = makeBashTurn("echo hi", "hi");
    expect(user.parentUuid).toBe(assistant.uuid);
  });
});
