import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  validateUuid,
  sqlLiteral,
  parseEntityType,
  ENTITY_TYPES,
  resetStuckSyncItem,
  listStuckForProject,
  getSyncItem,
} from "../src/lib/api";

describe("validateUuid", () => {
  it("accepts canonical UUIDs", () => {
    expect(
      validateUuid("f52c2f20-5748-4493-98c3-e3747f586d6f")
    ).toBe("f52c2f20-5748-4493-98c3-e3747f586d6f");
  });

  it("accepts uppercase UUIDs", () => {
    expect(
      validateUuid("F52C2F20-5748-4493-98C3-E3747F586D6F")
    ).toBe("F52C2F20-5748-4493-98C3-E3747F586D6F");
  });

  it("rejects non-UUIDs", () => {
    expect(() => validateUuid("not-a-uuid")).toThrow(/Invalid UUID/);
    expect(() => validateUuid("f52c2f20")).toThrow(/Invalid UUID/);
    expect(() => validateUuid("")).toThrow(/Invalid UUID/);
  });

  it("includes the label in the error", () => {
    expect(() => validateUuid("nope", "project_id")).toThrow(/project_id/);
  });

  it("shows the expected format in the error", () => {
    // The hint helps users who don't know UUIDs are 8-4-4-4-12 hex.
    expect(() => validateUuid("short")).toThrow(/8-4-4-4-12 hex/);
    expect(() => validateUuid("short")).toThrow(
      /f52c2f20-5748-4493-98c3-e3747f586d6f/
    );
  });
});

describe("sqlLiteral", () => {
  it("wraps in single quotes", () => {
    expect(sqlLiteral("hello")).toBe("'hello'");
  });

  it("escapes single quotes by doubling", () => {
    expect(sqlLiteral("it's")).toBe("'it''s'");
  });

  it("handles SQL injection attempts safely", () => {
    expect(sqlLiteral("'; DROP TABLE users; --")).toBe(
      "'''; DROP TABLE users; --'"
    );
  });
});

describe("parseEntityType", () => {
  it("accepts every canonical entity type", () => {
    for (const t of ENTITY_TYPES) {
      expect(parseEntityType(t)).toBe(t);
    }
  });

  it("rejects unknown types", () => {
    expect(() => parseEntityType("unknown")).toThrow(/Invalid entity type/);
    expect(() => parseEntityType("Drive")).toThrow(/Invalid entity type/);
  });
});

// ─── Management API HTTP layer (fetch mocked) ────────────────────────────────

describe("resetStuckSyncItem (HTTP)", () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.SUPABASE_ACCESS_TOKEN;

  beforeEach(() => {
    process.env.SUPABASE_ACCESS_TOKEN = "fake-token";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) {
      delete process.env.SUPABASE_ACCESS_TOKEN;
    } else {
      process.env.SUPABASE_ACCESS_TOKEN = originalToken;
    }
  });

  it("POSTs to /v1/projects/{ref}/database/query with auth + SQL body", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = mock(async (url: unknown, init: unknown) => {
      calls.push({ url: String(url), init: init as RequestInit });
      return new Response(
        JSON.stringify([
          {
            entity_type: "drive",
            entity_id: "f52c2f20-5748-4493-98c3-e3747f586d6f",
            old_status: "deleted",
            new_status: "pending",
            old_is_excluded: true,
            new_is_excluded: false,
            old_failure_count: 5,
            new_failure_count: 0,
            action: "reset",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as unknown as typeof globalThis.fetch;

    const result = await resetStuckSyncItem(
      "test-ref",
      "drive",
      "f52c2f20-5748-4493-98c3-e3747f586d6f",
      "test_actor"
    );

    expect(result.action).toBe("reset");
    expect(result.new_status).toBe("pending");
    expect(calls.length).toBe(1);

    const { url, init } = calls[0]!;
    expect(url).toBe("https://api.supabase.com/v1/projects/test-ref/database/query");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer fake-token");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string) as { query: string; read_only: boolean };
    // Writes are never read_only.
    expect(body.read_only).toBe(false);
    // SQL must call the RPC with both casts and our actor value.
    expect(body.query).toContain("reset_stuck_sync_item");
    expect(body.query).toContain("'drive'::gfs_entity_type");
    expect(body.query).toContain("'f52c2f20-5748-4493-98c3-e3747f586d6f'::uuid");
    expect(body.query).toContain("'test_actor'");
  });

  it("refuses to call a non-UUID entity_id", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("fetch should not be called");
    }) as unknown as typeof globalThis.fetch;

    expect(
      resetStuckSyncItem("test-ref", "drive", "not-a-uuid", "actor")
    ).rejects.toThrow(/Invalid UUID/);
  });

  it("throws if SUPABASE_ACCESS_TOKEN is unset", async () => {
    delete process.env.SUPABASE_ACCESS_TOKEN;
    globalThis.fetch = mock(async () => {
      throw new Error("fetch should not be called");
    }) as unknown as typeof globalThis.fetch;

    expect(
      resetStuckSyncItem(
        "test-ref",
        "drive",
        "f52c2f20-5748-4493-98c3-e3747f586d6f",
        "actor"
      )
    ).rejects.toThrow(/SUPABASE_ACCESS_TOKEN/);
  });

  it("surfaces Management API errors with status code", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("permission denied", { status: 403 });
    }) as unknown as typeof globalThis.fetch;

    expect(
      resetStuckSyncItem(
        "test-ref",
        "drive",
        "f52c2f20-5748-4493-98c3-e3747f586d6f",
        "actor"
      )
    ).rejects.toThrow(/403.*permission denied/);
  });

  it("translates 'function does not exist' into a migration-promotion hint", async () => {
    // Postgres undefined_function error code is 42883. The Management API
    // passes these through as a 400 with a JSON body. This test exercises
    // the common "tried to run recover against an env that hasn't received
    // the migration yet" case.
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          code: "42883",
          message:
            "function public.reset_stuck_sync_item(gfs_entity_type, uuid, text) does not exist",
        }),
        { status: 400 }
      );
    }) as unknown as typeof globalThis.fetch;

    const promise = resetStuckSyncItem(
      "test-ref",
      "drive",
      "f52c2f20-5748-4493-98c3-e3747f586d6f",
      "actor"
    );

    await expect(promise).rejects.toThrow(/reset_stuck_sync_item RPC is not present/);
    await expect(promise).rejects.toThrow(/migration 20260406083041/);
    await expect(promise).rejects.toThrow(/main → staging → production/);
  });
});

describe("listStuckForProject (HTTP)", () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.SUPABASE_ACCESS_TOKEN;

  beforeEach(() => {
    process.env.SUPABASE_ACCESS_TOKEN = "fake-token";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) {
      delete process.env.SUPABASE_ACCESS_TOKEN;
    } else {
      process.env.SUPABASE_ACCESS_TOKEN = originalToken;
    }
  });

  it("sends a read-only SELECT scoped by project_id", async () => {
    const captured: { query?: string; readOnly?: boolean } = {};
    globalThis.fetch = mock(async (_url: unknown, init: unknown) => {
      const body = JSON.parse((init as RequestInit).body as string) as {
        query: string;
        read_only: boolean;
      };
      captured.query = body.query;
      captured.readOnly = body.read_only;
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    await listStuckForProject(
      "test-ref",
      "f0c450db-c147-4986-a737-b3d9787c9ef7"
    );

    expect(captured.readOnly).toBe(true);
    expect(captured.query).toContain("FROM public.gfs_sync_items");
    expect(captured.query).toContain("'f0c450db-c147-4986-a737-b3d9787c9ef7'");
    // All four stuck statuses must appear in the filter.
    expect(captured.query).toContain("'deleted'");
    expect(captured.query).toContain("'retry_exhausted'");
    expect(captured.query).toContain("'upload_failed'");
    expect(captured.query).toContain("'excluded'");
  });

  it("applies the --entity filter when provided", async () => {
    const captured: { query?: string } = {};
    globalThis.fetch = mock(async (_url: unknown, init: unknown) => {
      captured.query = (JSON.parse((init as RequestInit).body as string) as { query: string }).query;
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    await listStuckForProject(
      "test-ref",
      "f0c450db-c147-4986-a737-b3d9787c9ef7",
      "drive"
    );

    expect(captured.query).toContain("entity_type = 'drive'");
  });

  it("refuses a non-UUID project_id", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("fetch should not be called");
    }) as unknown as typeof globalThis.fetch;

    expect(listStuckForProject("test-ref", "not-a-uuid")).rejects.toThrow(
      /Invalid UUID/
    );
  });
});

describe("getSyncItem (HTTP)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.SUPABASE_ACCESS_TOKEN = "fake-token";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns null on empty result", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    const result = await getSyncItem(
      "test-ref",
      "drive",
      "f52c2f20-5748-4493-98c3-e3747f586d6f"
    );
    expect(result).toBeNull();
  });

  it("returns the first row on non-empty result", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify([
          {
            entity_type: "drive",
            entity_id: "f52c2f20-5748-4493-98c3-e3747f586d6f",
            project_id: "f0c450db-c147-4986-a737-b3d9787c9ef7",
            gfs_sync_status: "deleted",
            is_excluded: true,
            failure_count: 5,
            error_message: "Max retries (5) exhausted",
          },
        ]),
        { status: 200 }
      );
    }) as unknown as typeof globalThis.fetch;

    const result = await getSyncItem(
      "test-ref",
      "drive",
      "f52c2f20-5748-4493-98c3-e3747f586d6f"
    );
    expect(result).not.toBeNull();
    expect(result?.gfs_sync_status).toBe("deleted");
    expect(result?.is_excluded).toBe(true);
  });
});
