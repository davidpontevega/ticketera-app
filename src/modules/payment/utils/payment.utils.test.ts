import { describe, expect, it } from "vitest";

import { parsePayoutHoldDays } from "../constants/payment.constants";
import { calculatePlatformFee, getPayoutReleaseDate, isPayoutReleasable, mapAccountToOnboardingStatus } from "./payment.utils";

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

describe("payout hold", () => {
  const startsAt = new Date("2026-10-01T20:00:00Z");

  it("la fecha de liberacion es starts_at + dias", () => {
    expect(getPayoutReleaseDate(startsAt, 7).toISOString()).toBe("2026-10-08T20:00:00.000Z");
    expect(getPayoutReleaseDate(startsAt, 0)).toEqual(startsAt);
  });

  it("es liberable solo en o despues de la fecha limite", () => {
    expect(isPayoutReleasable(startsAt, new Date("2026-10-08T19:59:59.999Z"), 7)).toBe(false);
    expect(isPayoutReleasable(startsAt, new Date("2026-10-08T20:00:00Z"), 7)).toBe(true);
    expect(isPayoutReleasable(startsAt, startsAt, 0)).toBe(true);
  });

  it("parsePayoutHoldDays usa 7 si falta o es invalida", () => {
    expect(parsePayoutHoldDays(undefined)).toBe(7);
    expect(parsePayoutHoldDays("")).toBe(7);
    expect(parsePayoutHoldDays("abc")).toBe(7);
    expect(parsePayoutHoldDays("-1")).toBe(7);
    expect(parsePayoutHoldDays("0")).toBe(0);
    expect(parsePayoutHoldDays("3")).toBe(3);
  });
});
