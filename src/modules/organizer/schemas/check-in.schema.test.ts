import { describe, expect, it } from "vitest";

import { checkInSchema } from "./check-in.schema";

const eventId = "6f1c1a52-8f5e-4a3b-9d27-3b1e6c0a9f10";

describe("checkInSchema", () => {
  it.each(["tk-1a2b3c4d-01", " TK-1A2B3C4D-01 "])("normaliza %j", (code) => {
    const parsed = checkInSchema.safeParse({ eventId, code });
    expect(parsed.success && parsed.data.code).toBe("TK-1A2B3C4D-01");
  });

  it.each(["", "   ", "TK-1234", "TK-1A2B3C4D", "TK-1A2B3C4G-01", "XX-1A2B3C4D-01", "TK-1A2B3C4D-1"])(
    "rechaza codigo %j",
    (code) => {
      expect(checkInSchema.safeParse({ eventId, code }).success).toBe(false);
    },
  );

  it("rechaza eventId no uuid y campos ausentes", () => {
    expect(checkInSchema.safeParse({ eventId: "abc", code: "TK-1A2B3C4D-01" }).success).toBe(false);
    expect(checkInSchema.safeParse({ eventId }).success).toBe(false);
  });
});
