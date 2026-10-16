import { describe, expect, it } from "vitest";

import { refundOrderSchema, retryEventRefundsSchema } from "./refund.schema";

const UUID_A = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
const UUID_B = "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

describe("refundOrderSchema", () => {
  it("acepta eventId y orderId uuid", () => {
    expect(refundOrderSchema.safeParse({ eventId: UUID_A, orderId: UUID_B }).success).toBe(true);
  });

  it.each([
    [{ eventId: "", orderId: UUID_B }],
    [{ eventId: UUID_A, orderId: "" }],
    [{ eventId: "nope", orderId: UUID_B }],
    [{ eventId: UUID_A, orderId: "123" }],
    [{ eventId: UUID_A }],
    [{}],
  ])("rechaza %j", (input) => {
    expect(refundOrderSchema.safeParse(input).success).toBe(false);
  });
});

describe("retryEventRefundsSchema", () => {
  it("acepta eventId uuid y rechaza lo demas", () => {
    expect(retryEventRefundsSchema.safeParse({ eventId: UUID_A }).success).toBe(true);
    expect(retryEventRefundsSchema.safeParse({ eventId: "nope" }).success).toBe(false);
    expect(retryEventRefundsSchema.safeParse({}).success).toBe(false);
  });
});
