/**
 * Tests for CLI argument validation
 *
 * These tests ensure that CLI arguments that take values are properly validated:
 * - Missing values throw clear errors
 * - Invalid values throw clear errors
 * - Valid values work correctly
 */

import { describe, it, expect } from "bun:test";
import { parseFindArgs, parseListArgs, parsePickArgs, parseFetchArgs, parseResumeArgs } from "./cli-args";
import { parseMainArgs } from "./cli-args-main";

describe("parseFindArgs", () => {
  describe("--project validation", () => {
    it("throws when --project is last argument with no value", () => {
      expect(() => parseFindArgs(["--project"])).toThrow("Missing value for --project");
    });

    it("throws when --project is followed by another flag", () => {
      expect(() => parseFindArgs(["--project", "--all-projects"])).toThrow(
        "Missing value for --project"
      );
    });

    it("accepts valid project value", () => {
      const result = parseFindArgs(["--project", "abc123"]);
      expect(result.project).toBe("abc123");
    });
  });

  describe("--output validation", () => {
    it("throws when --output is last argument with no value", () => {
      expect(() => parseFindArgs(["--output"])).toThrow("Missing value for --output");
    });

    it("throws when --output is followed by another flag", () => {
      expect(() => parseFindArgs(["--output", "--no-preview"])).toThrow(
        "Missing value for --output"
      );
    });

    it("throws when --output has invalid value", () => {
      expect(() => parseFindArgs(["--output", "xml"])).toThrow(
        'Invalid --output: expected one of [path, id, json], got "xml"'
      );
    });

    it("accepts valid output values", () => {
      expect(parseFindArgs(["--output", "path"]).output).toBe("path");
      expect(parseFindArgs(["--output", "id"]).output).toBe("id");
      expect(parseFindArgs(["--output", "json"]).output).toBe("json");
    });
  });

  describe("--since validation", () => {
    it("throws when --since is last argument with no value", () => {
      expect(() => parseFindArgs(["--since"])).toThrow("Missing value for --since");
    });

    it("throws when --since is followed by another flag", () => {
      expect(() => parseFindArgs(["--since", "--all-projects"])).toThrow(
        "Missing value for --since"
      );
    });

    it("throws when --since has invalid format", () => {
      expect(() => parseFindArgs(["--since", "yesterday"])).toThrow(
        'Invalid --since: expected format like "1d", "2w", or "YYYY-MM-DD", got "yesterday"'
      );
    });

    it("throws when --since has invalid date format", () => {
      expect(() => parseFindArgs(["--since", "2024-1-1"])).toThrow(
        'Invalid --since: expected format like "1d", "2w", or "YYYY-MM-DD", got "2024-1-1"'
      );
    });

    it("accepts valid since values", () => {
      expect(parseFindArgs(["--since", "1d"]).since).toBe("1d");
      expect(parseFindArgs(["--since", "2w"]).since).toBe("2w");
      expect(parseFindArgs(["--since", "2024-01-15"]).since).toBe("2024-01-15");
    });
  });

  describe("--remote flag", () => {
    it("defaults remote to false", () => {
      const result = parseFindArgs([]);
      expect(result.remote).toBe(false);
    });

    it("sets remote to true when --remote is passed", () => {
      const result = parseFindArgs(["--remote"]);
      expect(result.remote).toBe(true);
    });

    it("works alongside other flags", () => {
      const result = parseFindArgs(["--remote", "--all-projects", "--since", "7d"]);
      expect(result.remote).toBe(true);
      expect(result.allProjects).toBe(true);
      expect(result.since).toBe("7d");
    });
  });

  describe("--output-file validation", () => {
    it("throws when --output-file is last argument with no value", () => {
      expect(() => parseFindArgs(["--output-file"])).toThrow("Missing value for --output-file");
    });

    it("throws when --output-file is followed by another flag", () => {
      expect(() => parseFindArgs(["--output-file", "--no-preview"])).toThrow(
        "Missing value for --output-file"
      );
    });

    it("accepts valid output-file value", () => {
      const result = parseFindArgs(["--output-file", "/tmp/output.json"]);
      expect(result.outputFile).toBe("/tmp/output.json");
    });
  });
});

describe("parseListArgs", () => {
  describe("--project validation", () => {
    it("throws when --project is last argument with no value", () => {
      expect(() => parseListArgs(["--project"])).toThrow("Missing value for --project");
    });

    it("throws when --project is followed by another flag", () => {
      expect(() => parseListArgs(["--project", "--all-projects"])).toThrow(
        "Missing value for --project"
      );
    });

    it("accepts valid project value", () => {
      const result = parseListArgs(["--project", "abc123"]);
      expect(result.project).toBe("abc123");
    });
  });

  describe("--output validation", () => {
    it("throws when --output is last argument with no value", () => {
      expect(() => parseListArgs(["--output"])).toThrow("Missing value for --output");
    });

    it("throws when --output has invalid value", () => {
      expect(() => parseListArgs(["--output", "csv"])).toThrow(
        'Invalid --output: expected one of [path, id, json], got "csv"'
      );
    });

    it("accepts valid output values", () => {
      expect(parseListArgs(["--output", "path"]).output).toBe("path");
      expect(parseListArgs(["--output", "id"]).output).toBe("id");
      expect(parseListArgs(["--output", "json"]).output).toBe("json");
    });
  });

  describe("--since validation", () => {
    it("throws when --since is last argument with no value", () => {
      expect(() => parseListArgs(["--since"])).toThrow("Missing value for --since");
    });

    it("throws when --since has invalid format", () => {
      expect(() => parseListArgs(["--since", "last week"])).toThrow(
        'Invalid --since: expected format like "1d", "2w", or "YYYY-MM-DD", got "last week"'
      );
    });

    it("accepts valid since values", () => {
      expect(parseListArgs(["--since", "7d"]).since).toBe("7d");
      expect(parseListArgs(["--since", "1w"]).since).toBe("1w");
      expect(parseListArgs(["--since", "2025-12-31"]).since).toBe("2025-12-31");
    });
  });

  describe("--remote flag", () => {
    it("defaults remote to false", () => {
      const result = parseListArgs([]);
      expect(result.remote).toBe(false);
    });

    it("sets remote to true when --remote is passed", () => {
      const result = parseListArgs(["--remote"]);
      expect(result.remote).toBe(true);
    });

    it("works alongside --limit and --since", () => {
      const result = parseListArgs(["--remote", "--limit", "20", "--since", "3d"]);
      expect(result.remote).toBe(true);
      expect(result.limit).toBe(20);
      expect(result.since).toBe("3d");
    });
  });

  describe("--limit validation", () => {
    it("throws when --limit is last argument with no value", () => {
      expect(() => parseListArgs(["--limit"])).toThrow("Missing value for --limit");
    });

    it("throws when --limit is followed by another flag", () => {
      expect(() => parseListArgs(["--limit", "--all-projects"])).toThrow(
        "Missing value for --limit"
      );
    });

    it("throws when --limit has non-numeric value", () => {
      expect(() => parseListArgs(["--limit", "abc"])).toThrow(
        'Invalid --limit: expected positive integer, got "abc"'
      );
    });

    it("throws when --limit is zero", () => {
      expect(() => parseListArgs(["--limit", "0"])).toThrow(
        'Invalid --limit: expected positive integer, got "0"'
      );
    });

    it("throws when --limit is negative (looks like a flag)", () => {
      // Negative numbers start with '-' so they're treated as missing value
      expect(() => parseListArgs(["--limit", "-5"])).toThrow(
        "Missing value for --limit"
      );
    });

    it("throws when --limit is a float", () => {
      expect(() => parseListArgs(["--limit", "3.5"])).toThrow(
        'Invalid --limit: expected positive integer, got "3.5"'
      );
    });

    it("accepts valid limit values", () => {
      expect(parseListArgs(["--limit", "5"]).limit).toBe(5);
      expect(parseListArgs(["--limit", "100"]).limit).toBe(100);
    });

    it("accepts -n as alias for --limit", () => {
      expect(parseListArgs(["-n", "20"]).limit).toBe(20);
    });

    it("throws when -n has invalid value", () => {
      expect(() => parseListArgs(["-n", "abc"])).toThrow(
        'Invalid -n: expected positive integer, got "abc"'
      );
    });
  });
});

describe("parsePickArgs", () => {
  describe("--since validation", () => {
    it("throws when --since is last argument with no value", () => {
      expect(() => parsePickArgs(["--since"])).toThrow("Missing value for --since");
    });

    it("throws when --since has invalid format", () => {
      expect(() => parsePickArgs(["--since", "abc"])).toThrow(
        'Invalid --since: expected format like "1d", "2w", or "YYYY-MM-DD", got "abc"'
      );
    });

    it("accepts valid since values", () => {
      expect(parsePickArgs(["--since", "3d"]).since).toBe("3d");
    });
  });

  describe("--method validation", () => {
    it("throws when --method is last argument with no value", () => {
      expect(() => parsePickArgs(["--method"])).toThrow("Missing value for --method");
    });

    it("throws when --method is followed by another flag", () => {
      expect(() => parsePickArgs(["--method", "--all-projects"])).toThrow(
        "Missing value for --method"
      );
    });

    it("throws when --method has invalid value", () => {
      expect(() => parsePickArgs(["--method", "fzf"])).toThrow(
        'Invalid --method: expected one of [auto, tmux, vsc], got "fzf"'
      );
    });

    it("accepts valid method values", () => {
      expect(parsePickArgs(["--method", "auto"]).method).toBe("auto");
      expect(parsePickArgs(["--method", "tmux"]).method).toBe("tmux");
      expect(parsePickArgs(["--method", "vsc"]).method).toBe("vsc");
    });
  });
});

describe("parseMainArgs", () => {
  describe("default format", () => {
    it("defaults to stats format when no flags provided", () => {
      expect(parseMainArgs(["session.jsonl"]).format).toBe("stats");
    });

    it("defaults to stats even with other flags", () => {
      expect(parseMainArgs(["session.jsonl", "--debug"]).format).toBe("stats");
    });
  });

  describe("--full flag", () => {
    it("sets format to narrative when --full is specified", () => {
      const result = parseMainArgs(["session.jsonl", "--full"]);
      expect(result.full).toBe(true);
      expect(result.format).toBe("narrative");
    });

    it("defaults full to false", () => {
      expect(parseMainArgs(["session.jsonl"]).full).toBe(false);
    });

    it("is overridden by explicit --format", () => {
      const result = parseMainArgs(["session.jsonl", "--full", "--format", "terminal"]);
      expect(result.full).toBe(true);
      expect(result.format).toBe("terminal");
    });

    it("is overridden by explicit --format regardless of argument order", () => {
      const result = parseMainArgs(["session.jsonl", "--format", "markdown", "--full"]);
      expect(result.full).toBe(true);
      expect(result.format).toBe("markdown");
    });

    it("--format stats works explicitly", () => {
      expect(parseMainArgs(["--format", "stats"]).format).toBe("stats");
    });
  });

  describe("--timeline flag", () => {
    it("defaults timeline to false", () => {
      expect(parseMainArgs(["session.jsonl"]).timeline).toBe(false);
    });

    it("sets timeline to true when --timeline is specified", () => {
      const result = parseMainArgs(["session.jsonl", "--timeline"]);
      expect(result.timeline).toBe(true);
    });

    it("works alongside --subagents", () => {
      const result = parseMainArgs(["session.jsonl", "--timeline", "--subagents"]);
      expect(result.timeline).toBe(true);
      expect(result.subagents).toBe(true);
    });

    it("works alongside other flags", () => {
      const result = parseMainArgs(["session.jsonl", "--timeline", "--debug"]);
      expect(result.timeline).toBe(true);
      expect(result.debug).toBe(true);
      expect(result.file).toBe("session.jsonl");
    });
  });

  describe("--format validation", () => {
    it("throws when --format is last argument with no value", () => {
      expect(() => parseMainArgs(["--format"])).toThrow("Missing value for --format");
    });

    it("throws when --format is followed by another flag", () => {
      expect(() => parseMainArgs(["--format", "--debug"])).toThrow(
        "Missing value for --format"
      );
    });

    it("throws when --format has invalid value", () => {
      expect(() => parseMainArgs(["--format", "html"])).toThrow(
        'Invalid --format: expected one of [narrative, terminal, markdown, stats, json], got "html"'
      );
    });

    it("accepts valid format values", () => {
      expect(parseMainArgs(["--format", "narrative"]).format).toBe("narrative");
      expect(parseMainArgs(["--format", "terminal"]).format).toBe("terminal");
      expect(parseMainArgs(["--format", "markdown"]).format).toBe("markdown");
      expect(parseMainArgs(["--format", "stats"]).format).toBe("stats");
      expect(parseMainArgs(["--format", "json"]).format).toBe("json");
    });
  });

  describe("--truncate validation", () => {
    it("throws when --truncate is last argument with no value", () => {
      expect(() => parseMainArgs(["--truncate"])).toThrow("Missing value for --truncate");
    });

    it("throws when --truncate is followed by another flag", () => {
      expect(() => parseMainArgs(["--truncate", "--debug"])).toThrow(
        "Missing value for --truncate"
      );
    });

    it("throws when --truncate has non-numeric value", () => {
      expect(() => parseMainArgs(["--truncate", "abc"])).toThrow(
        'Invalid --truncate: expected non-negative integer, got "abc"'
      );
    });

    it("throws when --truncate is negative (looks like a flag)", () => {
      expect(() => parseMainArgs(["--truncate", "-100"])).toThrow(
        "Missing value for --truncate"
      );
    });

    it("throws when --truncate is a float", () => {
      expect(() => parseMainArgs(["--truncate", "50.5"])).toThrow(
        'Invalid --truncate: expected non-negative integer, got "50.5"'
      );
    });

    it("accepts valid truncate values including zero", () => {
      expect(parseMainArgs(["--truncate", "0"]).truncate).toBe(0);
      expect(parseMainArgs(["--truncate", "500"]).truncate).toBe(500);
      expect(parseMainArgs(["--truncate", "1000"]).truncate).toBe(1000);
    });
  });

  describe("--timeout validation", () => {
    it("throws when --timeout is last argument with no value", () => {
      expect(() => parseMainArgs(["--timeout"])).toThrow("Missing value for --timeout");
    });

    it("throws when --timeout is followed by another flag", () => {
      expect(() => parseMainArgs(["--timeout", "--debug"])).toThrow(
        "Missing value for --timeout"
      );
    });

    it("throws when --timeout has non-numeric value", () => {
      expect(() => parseMainArgs(["--timeout", "abc"])).toThrow(
        'Invalid --timeout: expected non-negative integer, got "abc"'
      );
    });

    it("throws when --timeout is a float", () => {
      expect(() => parseMainArgs(["--timeout", "5.5"])).toThrow(
        'Invalid --timeout: expected non-negative integer, got "5.5"'
      );
    });

    it("accepts valid timeout values including zero (disabled)", () => {
      expect(parseMainArgs(["--timeout", "0"]).timeout).toBe(0);
      expect(parseMainArgs(["--timeout", "30"]).timeout).toBe(30);
      expect(parseMainArgs(["--timeout", "60"]).timeout).toBe(60);
    });
  });

  describe("--show-tools flag", () => {
    it("defaults showTools to false", () => {
      expect(parseMainArgs(["session.jsonl"]).showTools).toBe(false);
    });

    it("sets showTools to true when --show-tools is specified", () => {
      const result = parseMainArgs(["session.jsonl", "--show-tools"]);
      expect(result.showTools).toBe(true);
    });

    it("works alongside --timeline", () => {
      const result = parseMainArgs(["session.jsonl", "--timeline", "--show-tools"]);
      expect(result.timeline).toBe(true);
      expect(result.showTools).toBe(true);
    });

    it("works alongside other flags", () => {
      const result = parseMainArgs(["session.jsonl", "--show-tools", "--debug"]);
      expect(result.showTools).toBe(true);
      expect(result.debug).toBe(true);
      expect(result.file).toBe("session.jsonl");
    });
  });

  describe("--report-lines validation", () => {
    it("defaults reportLines to 3", () => {
      expect(parseMainArgs(["session.jsonl"]).reportLines).toBe(3);
    });

    it("sets reportLines when --report-lines is provided", () => {
      expect(parseMainArgs(["session.jsonl", "--report-lines", "5"]).reportLines).toBe(5);
    });

    it("accepts 1 as minimum valid value", () => {
      expect(parseMainArgs(["--report-lines", "1"]).reportLines).toBe(1);
    });

    it("throws when --report-lines is last argument with no value", () => {
      expect(() => parseMainArgs(["--report-lines"])).toThrow("Missing value for --report-lines");
    });

    it("throws when --report-lines is followed by another flag", () => {
      expect(() => parseMainArgs(["--report-lines", "--debug"])).toThrow(
        "Missing value for --report-lines"
      );
    });

    it("throws when --report-lines has non-numeric value", () => {
      expect(() => parseMainArgs(["--report-lines", "abc"])).toThrow(
        'Invalid --report-lines: expected non-negative integer, got "abc"'
      );
    });

    it("throws when --report-lines is zero", () => {
      expect(() => parseMainArgs(["--report-lines", "0"])).toThrow(
        'Invalid --report-lines: expected positive integer, got "0"'
      );
    });

    it("throws when --report-lines is negative (looks like a flag)", () => {
      expect(() => parseMainArgs(["--report-lines", "-1"])).toThrow(
        "Missing value for --report-lines"
      );
    });

    it("throws when --report-lines is a float", () => {
      expect(() => parseMainArgs(["--report-lines", "2.5"])).toThrow(
        'Invalid --report-lines: expected non-negative integer, got "2.5"'
      );
    });

    it("works alongside --timeline", () => {
      const result = parseMainArgs(["session.jsonl", "--timeline", "--report-lines", "10"]);
      expect(result.timeline).toBe(true);
      expect(result.reportLines).toBe(10);
    });
  });

  describe("--tool validation", () => {
    it("defaults tool to undefined", () => {
      expect(parseMainArgs(["session.jsonl"]).tool).toBeUndefined();
    });

    it("sets tool when --tool is provided", () => {
      expect(parseMainArgs(["session.jsonl", "--tool", "Bash"]).tool).toBe("Bash");
    });

    it("preserves case sensitivity", () => {
      expect(parseMainArgs(["--tool", "Read"]).tool).toBe("Read");
      expect(parseMainArgs(["--tool", "Grep"]).tool).toBe("Grep");
    });

    it("throws when --tool is last argument with no value", () => {
      expect(() => parseMainArgs(["--tool"])).toThrow("Missing value for --tool");
    });

    it("throws when --tool is followed by another flag", () => {
      expect(() => parseMainArgs(["--tool", "--debug"])).toThrow(
        "Missing value for --tool"
      );
    });

    it("works alongside other flags", () => {
      const result = parseMainArgs(["session.jsonl", "--tool", "Bash", "--debug"]);
      expect(result.tool).toBe("Bash");
      expect(result.debug).toBe(true);
      expect(result.file).toBe("session.jsonl");
    });
  });

  describe("--since-turn validation", () => {
    it("defaults sinceTurn to undefined", () => {
      expect(parseMainArgs(["session.jsonl"]).sinceTurn).toBeUndefined();
    });

    it("parses --since-turn to a number", () => {
      expect(parseMainArgs(["session.jsonl", "--since-turn", "5"]).sinceTurn).toBe(5);
    });

    it("accepts zero as a valid value", () => {
      expect(parseMainArgs(["session.jsonl", "--since-turn", "0"]).sinceTurn).toBe(0);
    });

    it("throws when --since-turn is last argument with no value", () => {
      expect(() => parseMainArgs(["--since-turn"])).toThrow("Missing value for --since-turn");
    });

    it("throws when --since-turn is followed by another flag", () => {
      expect(() => parseMainArgs(["--since-turn", "--debug"])).toThrow(
        "Missing value for --since-turn"
      );
    });

    it("throws when --since-turn has non-numeric value", () => {
      expect(() => parseMainArgs(["--since-turn", "abc"])).toThrow(
        'Invalid --since-turn: expected non-negative integer, got "abc"'
      );
    });

    it("throws when --since-turn is a float", () => {
      expect(() => parseMainArgs(["--since-turn", "2.5"])).toThrow(
        'Invalid --since-turn: expected non-negative integer, got "2.5"'
      );
    });

    it("throws when --since-turn is negative (looks like a flag)", () => {
      expect(() => parseMainArgs(["--since-turn", "-1"])).toThrow(
        "Missing value for --since-turn"
      );
    });
  });

  describe("--last validation", () => {
    it("defaults last to undefined", () => {
      expect(parseMainArgs(["session.jsonl"]).last).toBeUndefined();
    });

    it("parses --last to a number", () => {
      expect(parseMainArgs(["session.jsonl", "--last", "3"]).last).toBe(3);
    });

    it("throws when --last is last argument with no value", () => {
      expect(() => parseMainArgs(["--last"])).toThrow("Missing value for --last");
    });

    it("throws when --last is followed by another flag", () => {
      expect(() => parseMainArgs(["--last", "--debug"])).toThrow(
        "Missing value for --last"
      );
    });

    it("throws when --last has non-numeric value", () => {
      expect(() => parseMainArgs(["--last", "abc"])).toThrow(
        'Invalid --last: expected non-negative integer, got "abc"'
      );
    });

    it("throws when --last is zero", () => {
      expect(() => parseMainArgs(["--last", "0"])).toThrow(
        'Invalid --last: expected positive integer, got "0"'
      );
    });

    it("throws when --last is a float", () => {
      expect(() => parseMainArgs(["--last", "1.5"])).toThrow(
        'Invalid --last: expected non-negative integer, got "1.5"'
      );
    });

    it("throws when --last is negative (looks like a flag)", () => {
      expect(() => parseMainArgs(["--last", "-3"])).toThrow(
        "Missing value for --last"
      );
    });
  });

  describe("--since-turn and --last combined", () => {
    it("parses both --since-turn and --last when provided together", () => {
      const result = parseMainArgs(["session.jsonl", "--since-turn", "5", "--last", "3"]);
      expect(result.sinceTurn).toBe(5);
      expect(result.last).toBe(3);
    });

    it("preserves both values regardless of argument order", () => {
      const result = parseMainArgs(["session.jsonl", "--last", "10", "--since-turn", "45"]);
      expect(result.sinceTurn).toBe(45);
      expect(result.last).toBe(10);
    });
  });

  describe("--tools validation", () => {
    it("defaults tools to undefined", () => {
      expect(parseMainArgs(["session.jsonl"]).tools).toBeUndefined();
    });

    it("parses --tools flag correctly", () => {
      expect(parseMainArgs(["session.jsonl", "--tools", "Bash,Edit"]).tools).toBe("Bash,Edit");
    });

    it("throws when --tools is last argument with no value", () => {
      expect(() => parseMainArgs(["--tools"])).toThrow("Missing value for --tools");
    });

    it("throws when --tools is followed by another flag", () => {
      expect(() => parseMainArgs(["--tools", "--debug"])).toThrow(
        "Missing value for --tools"
      );
    });

    it("works alongside other flags", () => {
      const result = parseMainArgs(["session.jsonl", "--tools", "Bash,Read", "--debug"]);
      expect(result.tools).toBe("Bash,Read");
      expect(result.debug).toBe(true);
    });
  });

  describe("--tool and --tools mutual exclusion", () => {
    it("throws when both --tool and --tools are provided", () => {
      expect(() =>
        parseMainArgs(["session.jsonl", "--tool", "Bash", "--tools", "Bash,Edit"])
      ).toThrow("Cannot use --tool and --tools together");
    });

    it("throws regardless of argument order", () => {
      expect(() =>
        parseMainArgs(["session.jsonl", "--tools", "Bash,Edit", "--tool", "Bash"])
      ).toThrow("Cannot use --tool and --tools together");
    });
  });

  describe("file argument", () => {
    it("accepts file path as positional argument", () => {
      expect(parseMainArgs(["session.jsonl"]).file).toBe("session.jsonl");
    });

    it("accepts file path with flags", () => {
      const result = parseMainArgs(["session.jsonl", "--debug", "--format", "terminal"]);
      expect(result.file).toBe("session.jsonl");
      expect(result.debug).toBe(true);
      expect(result.format).toBe("terminal");
    });
  });

  describe("--exclude-notifications flag", () => {
    it("defaults excludeNotifications to false", () => {
      expect(parseMainArgs(["session.jsonl"]).excludeNotifications).toBe(false);
    });

    it("sets excludeNotifications to true when --exclude-notifications is specified", () => {
      const result = parseMainArgs(["session.jsonl", "--exclude-notifications"]);
      expect(result.excludeNotifications).toBe(true);
    });

    it("works alongside --last", () => {
      const result = parseMainArgs(["session.jsonl", "--exclude-notifications", "--last", "20"]);
      expect(result.excludeNotifications).toBe(true);
      expect(result.last).toBe(20);
    });

    it("works alongside other flags", () => {
      const result = parseMainArgs(["session.jsonl", "--exclude-notifications", "--debug", "--format", "json"]);
      expect(result.excludeNotifications).toBe(true);
      expect(result.debug).toBe(true);
      expect(result.format).toBe("json");
    });
  });

  describe("--commits flag", () => {
    it("defaults commits to false", () => {
      expect(parseMainArgs(["session.jsonl"]).commits).toBe(false);
    });

    it("sets commits to true when --commits is specified", () => {
      const result = parseMainArgs(["session.jsonl", "--commits"]);
      expect(result.commits).toBe(true);
    });

    it("works alongside --full", () => {
      const result = parseMainArgs(["session.jsonl", "--full", "--commits"]);
      expect(result.full).toBe(true);
      expect(result.commits).toBe(true);
      expect(result.format).toBe("narrative");
    });

    it("works alongside --format narrative", () => {
      const result = parseMainArgs(["session.jsonl", "--format", "narrative", "--commits"]);
      expect(result.commits).toBe(true);
      expect(result.format).toBe("narrative");
    });

    it("works alongside other flags", () => {
      const result = parseMainArgs(["session.jsonl", "--commits", "--debug", "--subagents"]);
      expect(result.commits).toBe(true);
      expect(result.debug).toBe(true);
      expect(result.subagents).toBe(true);
    });
  });
});

describe("parseFetchArgs", () => {
  it("defaults to empty sessionId and help=false", () => {
    const result = parseFetchArgs([]);
    expect(result.sessionId).toBe("");
    expect(result.help).toBe(false);
  });

  it("accepts a session ID as positional argument", () => {
    const result = parseFetchArgs(["159b7095-3f96-4de5-a8a5-7cf445849bd6"]);
    expect(result.sessionId).toBe("159b7095-3f96-4de5-a8a5-7cf445849bd6");
  });

  it("accepts a short prefix as positional argument", () => {
    const result = parseFetchArgs(["159b7095"]);
    expect(result.sessionId).toBe("159b7095");
  });

  it("sets help when --help is passed", () => {
    const result = parseFetchArgs(["--help"]);
    expect(result.help).toBe(true);
  });

  it("sets help when -h is passed", () => {
    const result = parseFetchArgs(["-h"]);
    expect(result.help).toBe(true);
  });

  it("accepts session ID alongside --help", () => {
    const result = parseFetchArgs(["159b7095", "--help"]);
    expect(result.sessionId).toBe("159b7095");
    expect(result.help).toBe(true);
  });

  it("ignores unknown flags gracefully", () => {
    const result = parseFetchArgs(["--unknown", "159b7095"]);
    expect(result.sessionId).toBe("159b7095");
  });
});

describe("parseResumeArgs", () => {
  it("defaults to empty sessionId and help=false", () => {
    const result = parseResumeArgs([]);
    expect(result.sessionId).toBe("");
    expect(result.help).toBe(false);
  });

  it("accepts a session ID as positional argument", () => {
    const result = parseResumeArgs(["159b7095-3f96-4de5-a8a5-7cf445849bd6"]);
    expect(result.sessionId).toBe("159b7095-3f96-4de5-a8a5-7cf445849bd6");
  });

  it("accepts a short prefix as positional argument", () => {
    const result = parseResumeArgs(["159b7095"]);
    expect(result.sessionId).toBe("159b7095");
  });

  it("sets help when --help is passed", () => {
    const result = parseResumeArgs(["--help"]);
    expect(result.help).toBe(true);
  });

  it("sets help when -h is passed", () => {
    const result = parseResumeArgs(["-h"]);
    expect(result.help).toBe(true);
  });

  it("accepts session ID alongside --help", () => {
    const result = parseResumeArgs(["159b7095", "--help"]);
    expect(result.sessionId).toBe("159b7095");
    expect(result.help).toBe(true);
  });

  it("ignores unknown flags gracefully", () => {
    const result = parseResumeArgs(["--unknown", "159b7095"]);
    expect(result.sessionId).toBe("159b7095");
  });
});
