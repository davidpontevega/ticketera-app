import { describe, expect, it } from "vitest";

import { calculatePlatformFee, mapAccountToOnboardingStatus } from "./payment.utils";

describe("calculatePlatformFee", () => {
  it("calcula el 10% en centavos", () => {
    expect(calculatePlatformFee(100, 10)).toEqual({ feeCents: 1000, netCents: 9000 });
  });
  it("redondea a centavos enteros", () => {
    expect(calculatePlatformFee(33.33, 10)).toEqual({ feeCents: 333, netCents: 3000 });
  });
  it("0% no cobra fee", () => {
    expect(calculatePlatformFee(50, 0)).toEqual({ feeCents: 0, netCents: 5000 });
  });
  it("el fee nunca alcanza el total", () => {
    expect(calculatePlatformFee(0.01, 50).feeCents).toBeLessThan(1);
    expect(calculatePlatformFee(10, 100)).toEqual({ feeCents: 999, netCents: 1 });
  });
});

describe("mapAccountToOnboardingStatus", () => {
  it.each([
    [{ details_submitted: true, capabilities: { transfers: "active" } }, "complete"],
    [{ details_submitted: false, capabilities: { transfers: "active" } }, "pending"],
    [{ details_submitted: true, capabilities: { transfers: "inactive" } }, "pending"],
    [{ details_submitted: true, capabilities: null }, "pending"],
    [{}, "pending"],
  ])("%j => %s", (account, expected) => {
    expect(mapAccountToOnboardingStatus(account)).toBe(expected);
  });
});
