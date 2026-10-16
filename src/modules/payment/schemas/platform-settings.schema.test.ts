import { describe, expect, it } from "vitest";

import { feePercentSchema } from "./platform-settings.schema";

const parse = (feePercent: unknown) => feePercentSchema.safeParse({ feePercent });

describe("feePercentSchema", () => {
  it.each([["0", 0], ["10", 10], ["12.5", 12.5], ["50", 50], [7.25, 7.25]])("acepta %s", (input, expected) => {
    expect(parse(input)).toMatchObject({ success: true, data: { feePercent: expected } });
  });

  it.each(["-1", "51", "abc", "", "1.234", null, undefined])("rechaza %s", (input) => {
    expect(parse(input).success).toBe(false);
  });
});
