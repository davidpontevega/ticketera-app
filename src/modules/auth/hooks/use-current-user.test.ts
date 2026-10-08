import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useClerk, useUser } from "@clerk/nextjs";

import { toAuthUser, useCurrentUser } from "./use-current-user";

vi.mock("@clerk/nextjs", () => ({
  useUser: vi.fn(),
  useClerk: vi.fn(),
}));

const mockedUseUser = vi.mocked(useUser);
const mockedUseClerk = vi.mocked(useClerk);

function clerkUser(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Maria Perez",
    primaryEmailAddress: { emailAddress: "Maria@Example.com" },
    emailAddresses: [{ emailAddress: "Maria@Example.com" }],
    ...overrides,
  } as never;
}

describe("toAuthUser", () => {
  it("returns null for null/undefined", () => {
    expect(toAuthUser(null)).toBeNull();
    expect(toAuthUser(undefined)).toBeNull();
  });

  it("uses primaryEmailAddress even when it is not the first of emailAddresses", () => {
    const user = clerkUser({
      primaryEmailAddress: { emailAddress: "primary@example.com" },
      emailAddresses: [{ emailAddress: "first@example.com" }, { emailAddress: "primary@example.com" }],
    });
    expect(toAuthUser(user)?.email).toBe("primary@example.com");
  });

  it("falls back to the first emailAddresses entry without a primary", () => {
    const user = clerkUser({
      primaryEmailAddress: null,
      emailAddresses: [{ emailAddress: "first@example.com" }],
    });
    expect(toAuthUser(user)?.email).toBe("first@example.com");
  });

  it("normalizes the email to lowercase", () => {
    const user = clerkUser({ primaryEmailAddress: { emailAddress: "Maria@Example.COM" } });
    expect(toAuthUser(user)?.email).toBe("maria@example.com");
  });

  it("falls back to getNameFromEmail when fullName is empty or only spaces", () => {
    const user = clerkUser({
      fullName: "   ",
      primaryEmailAddress: { emailAddress: "maria.perez@example.com" },
    });
    expect(toAuthUser(user)?.fullName).toBe("Maria Perez");
  });

  it("returns null when there is no email at all", () => {
    const user = clerkUser({ primaryEmailAddress: null, emailAddresses: [] });
    expect(toAuthUser(user)).toBeNull();
  });
});

describe("useCurrentUser", () => {
  it("returns { user: null, isLoaded: false } while loading", () => {
    mockedUseUser.mockReturnValue({ user: undefined, isLoaded: false } as never);
    mockedUseClerk.mockReturnValue({ signOut: vi.fn() } as never);

    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toMatchObject({ user: null, isLoaded: false });
  });

  it("maps the Clerk user to AuthUser once loaded", () => {
    mockedUseUser.mockReturnValue({ user: clerkUser(), isLoaded: true } as never);
    mockedUseClerk.mockReturnValue({ signOut: vi.fn() } as never);

    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.user).toEqual({ fullName: "Maria Perez", email: "maria@example.com" });
  });

  it("signOut() calls useClerk().signOut", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    mockedUseUser.mockReturnValue({ user: undefined, isLoaded: true } as never);
    mockedUseClerk.mockReturnValue({ signOut } as never);

    const { result } = renderHook(() => useCurrentUser());
    await result.current.signOut();
    expect(signOut).toHaveBeenCalled();
  });
});
