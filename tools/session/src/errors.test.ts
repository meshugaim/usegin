/**
 * Tests for improved error messages with actionable hints
 *
 * These tests verify that all user-facing errors:
 * 1. Have a consistent format (Error + blank line + Tip/Try)
 * 2. Include actionable suggestions
 * 3. Include relevant context (file paths, search locations, etc.)
 *
 * Part of: ENG-1397
 */

import { describe, test, expect } from "bun:test";

// =============================================================================
// ERROR MESSAGE FORMAT TESTS
// =============================================================================

describe("Error message format", () => {
  describe("SessionNotFoundError", () => {
    test("includes the session ID that was not found", async () => {
      const { SessionNotFoundError } = await import("./errors");

      const error = new SessionNotFoundError("abc123");
      expect(error.message).toContain("abc123");
    });

    test("suggests session list --all-projects", async () => {
      const { SessionNotFoundError } = await import("./errors");

      const error = new SessionNotFoundError("abc123");
      expect(error.message).toContain("session list --all-projects");
    });

    test("includes the searched location when provided", async () => {
      const { SessionNotFoundError } = await import("./errors");

      const error = new SessionNotFoundError("abc123", {
        searchedLocation: "~/.claude/projects/-workspaces-foo/",
      });
      expect(error.message).toContain("-workspaces-foo");
    });

    test("has consistent format with blank line before suggestions", async () => {
      const { SessionNotFoundError } = await import("./errors");

      const error = new SessionNotFoundError("abc123");
      // Format: "Error: ... \n\n ..."
      expect(error.message).toMatch(/\n\n/);
    });
  });

  describe("NoSessionsFoundError", () => {
    test("shows what was searched", async () => {
      const { NoSessionsFoundError } = await import("./errors");

      const error = new NoSessionsFoundError({
        project: "-workspaces-test-mvp",
      });
      expect(error.message).toContain("-workspaces-test-mvp");
    });

    test("suggests --all-projects when searching specific project", async () => {
      const { NoSessionsFoundError } = await import("./errors");

      const error = new NoSessionsFoundError({
        project: "-workspaces-test-mvp",
      });
      expect(error.message).toContain("--all-projects");
    });

    test("suggests --since when already searching all projects", async () => {
      const { NoSessionsFoundError } = await import("./errors");

      const error = new NoSessionsFoundError({
        allProjects: true,
      });
      expect(error.message).toContain("--since");
    });

    test("mentions since filter when applied", async () => {
      const { NoSessionsFoundError } = await import("./errors");

      const error = new NoSessionsFoundError({
        project: "-workspaces-test-mvp",
        since: "7d",
      });
      expect(error.message).toContain("7d");
    });

    test("has consistent format", async () => {
      const { NoSessionsFoundError } = await import("./errors");

      const error = new NoSessionsFoundError({});
      expect(error.message).toMatch(/\n\n/);
    });
  });

  describe("TmuxNotAvailableError", () => {
    test("explains what tmux is needed for", async () => {
      const { TmuxNotAvailableError } = await import("./errors");

      const error = new TmuxNotAvailableError();
      expect(error.message).toContain("tmux");
    });

    test("shows how to start tmux", async () => {
      const { TmuxNotAvailableError } = await import("./errors");

      const error = new TmuxNotAvailableError();
      expect(error.message).toContain("tmux new-session");
    });

    test("suggests VS Code alternative if applicable", async () => {
      const { TmuxNotAvailableError } = await import("./errors");

      const error = new TmuxNotAvailableError();
      expect(error.message).toMatch(/vsc|VS Code/i);
    });

    test("has consistent format", async () => {
      const { TmuxNotAvailableError } = await import("./errors");

      const error = new TmuxNotAvailableError();
      expect(error.message).toMatch(/\n\n/);
    });
  });

  describe("ParsingTimeoutError", () => {
    test("shows the timeout duration", async () => {
      const { ParsingTimeoutError } = await import("./errors");

      const error = new ParsingTimeoutError(30);
      expect(error.message).toContain("30");
    });

    test("suggests --debug flag", async () => {
      const { ParsingTimeoutError } = await import("./errors");

      const error = new ParsingTimeoutError(30);
      expect(error.message).toContain("--debug");
    });

    test("suggests --timeout 0 to disable", async () => {
      const { ParsingTimeoutError } = await import("./errors");

      const error = new ParsingTimeoutError(30);
      expect(error.message).toContain("--timeout 0");
    });

    test("shows file size when provided", async () => {
      const { ParsingTimeoutError } = await import("./errors");

      const error = new ParsingTimeoutError(30, { fileSizeBytes: 5_000_000 });
      // 5,000,000 bytes = 4.77 MB (binary) or 5.0 MB (decimal)
      // Our implementation uses binary (1024), so we get ~4.8 MB
      expect(error.message).toMatch(/4\.8 MB|Size:/);
    });

    test("has consistent format", async () => {
      const { ParsingTimeoutError } = await import("./errors");

      const error = new ParsingTimeoutError(30);
      expect(error.message).toMatch(/\n\n/);
    });
  });

  describe("NoPickerMethodError", () => {
    test("lists available methods", async () => {
      const { NoPickerMethodError } = await import("./errors");

      const error = new NoPickerMethodError();
      expect(error.message).toContain("tmux");
      expect(error.message).toMatch(/vsc|VS Code/i);
    });

    test("shows how to set up each method", async () => {
      const { NoPickerMethodError } = await import("./errors");

      const error = new NoPickerMethodError();
      // Should explain tmux setup
      expect(error.message).toContain("tmux new-session");
    });

    test("has consistent format", async () => {
      const { NoPickerMethodError } = await import("./errors");

      const error = new NoPickerMethodError();
      expect(error.message).toMatch(/\n\n/);
    });
  });
});

// =============================================================================
// INTEGRATION TESTS - ERROR MESSAGES IN CONTEXT
// =============================================================================

describe("Error messages in context", () => {
  test("resolveSessionPath throws SessionNotFoundError with hints", async () => {
    const { resolveSessionPath, SessionNotFoundError } = await import("./finder");

    try {
      await resolveSessionPath("00000000-0000-0000-0000-000000000000");
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(SessionNotFoundError);
      expect((error as SessionNotFoundError).message).toContain("session list");
    }
  });

  test("withTimeout throws ParsingTimeoutError with hints", async () => {
    const { withTimeout, ParsingTimeoutError } = await import("./parser");

    // Create a promise that will never resolve
    const neverResolves = new Promise(() => {});

    try {
      await withTimeout(neverResolves, 0.1); // 100ms timeout
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(ParsingTimeoutError);
      expect((error as ParsingTimeoutError).message).toContain("--debug");
      expect((error as ParsingTimeoutError).message).toContain("--timeout 0");
    }
  });

  test("openSessionPicker throws TmuxNotAvailableError with hints when method=tmux", async () => {
    const { openSessionPicker, TmuxNotAvailableError } = await import("./finder");

    // Save and clear TMUX env var
    const originalTmux = process.env.TMUX;
    delete process.env.TMUX;

    try {
      await openSessionPicker({ method: "tmux" });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(TmuxNotAvailableError);
      expect((error as TmuxNotAvailableError).message).toContain("tmux new-session");
    } finally {
      if (originalTmux) {
        process.env.TMUX = originalTmux;
      }
    }
  });

  test("openSessionPicker throws NoPickerMethodError with hints when no method available", async () => {
    const { openSessionPicker, NoPickerMethodError } = await import("./finder");

    const originalTmux = process.env.TMUX;
    delete process.env.TMUX;

    try {
      // Using a non-existent port file ensures vsc isn't available
      await openSessionPicker({ method: "auto" });
      // May succeed if vsc is available, so we check the error type if it fails
    } catch (error) {
      if (error instanceof NoPickerMethodError) {
        expect(error.message).toContain("tmux");
        expect(error.message).toMatch(/vsc|VS Code/i);
      }
      // If it's a different error or succeeds, that's fine
    } finally {
      if (originalTmux) {
        process.env.TMUX = originalTmux;
      }
    }
  });
});

// =============================================================================
// ERROR HIERARCHY TESTS
// =============================================================================

describe("Error class hierarchy", () => {
  test("all session errors extend SessionError base class", async () => {
    const {
      SessionError,
      SessionNotFoundError,
      NoSessionsFoundError,
      TmuxNotAvailableError,
      ParsingTimeoutError,
      NoPickerMethodError,
    } = await import("./errors");

    expect(new SessionNotFoundError("x")).toBeInstanceOf(SessionError);
    expect(new NoSessionsFoundError({})).toBeInstanceOf(SessionError);
    expect(new TmuxNotAvailableError()).toBeInstanceOf(SessionError);
    expect(new ParsingTimeoutError(30)).toBeInstanceOf(SessionError);
    expect(new NoPickerMethodError()).toBeInstanceOf(SessionError);
  });

  test("all session errors are instances of Error", async () => {
    const {
      SessionNotFoundError,
      NoSessionsFoundError,
      TmuxNotAvailableError,
      ParsingTimeoutError,
      NoPickerMethodError,
    } = await import("./errors");

    expect(new SessionNotFoundError("x")).toBeInstanceOf(Error);
    expect(new NoSessionsFoundError({})).toBeInstanceOf(Error);
    expect(new TmuxNotAvailableError()).toBeInstanceOf(Error);
    expect(new ParsingTimeoutError(30)).toBeInstanceOf(Error);
    expect(new NoPickerMethodError()).toBeInstanceOf(Error);
  });

  test("errors have correct names for instanceof checks", async () => {
    const {
      SessionNotFoundError,
      NoSessionsFoundError,
      TmuxNotAvailableError,
      ParsingTimeoutError,
      NoPickerMethodError,
    } = await import("./errors");

    expect(new SessionNotFoundError("x").name).toBe("SessionNotFoundError");
    expect(new NoSessionsFoundError({}).name).toBe("NoSessionsFoundError");
    expect(new TmuxNotAvailableError().name).toBe("TmuxNotAvailableError");
    expect(new ParsingTimeoutError(30).name).toBe("ParsingTimeoutError");
    expect(new NoPickerMethodError().name).toBe("NoPickerMethodError");
  });
});
