import { describe, expect, it } from "vitest";

import { subscribeSchema } from "./newsletter.schema";

describe("subscribeSchema", () => {
  it("normaliza el correo (trim + lowercase)", () => {
    const parsed = subscribeSchema.parse({ email: "  Ana@Correo.COM " });
    expect(parsed.email).toBe("ana@correo.com");
  });

  it.each(["", "   ", "no-es-correo", "a@b", `${"a".repeat(250)}@x.com`])("rechaza %j", (email) => {
    expect(subscribeSchema.safeParse({ email }).success).toBe(false);
  });

  it("rechaza email ausente", () => {
    expect(subscribeSchema.safeParse({}).success).toBe(false);
  });
});
