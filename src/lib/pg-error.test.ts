import { describe, expect, it } from "vitest";

import { pgErrorCode } from "./pg-error";

describe("pgErrorCode", () => {
  it("reads the code from the error itself", () => {
    expect(pgErrorCode({ code: "23505" })).toBe("23505");
  });

  it("reads the code from cause when Drizzle wraps the error", () => {
    expect(pgErrorCode({ cause: { code: "23503" } })).toBe("23503");
  });

  it("returns undefined for null or errors without code", () => {
    expect(pgErrorCode(null)).toBeUndefined();
    expect(pgErrorCode(new Error("boom"))).toBeUndefined();
  });
});
