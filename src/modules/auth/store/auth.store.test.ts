import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "./auth.store";

const { getState, setState } = useAuthStore;

describe("useAuthStore", () => {
  beforeEach(() => {
    setState({ user: null, knownUsers: [] });
    localStorage.clear();
  });

  it("register signs in and remembers the user", () => {
    getState().register({ fullName: " Maria Perez ", email: "Maria@Example.com" });
    expect(getState().user).toEqual({ fullName: "Maria Perez", email: "maria@example.com" });
    expect(getState().knownUsers).toHaveLength(1);
  });

  it("login uses the registered name for a known email", () => {
    getState().register({ fullName: "Maria Perez", email: "maria@example.com" });
    getState().logout();
    expect(getState().user).toBeNull();
    expect(getState().login("MARIA@example.com").fullName).toBe("Maria Perez");
  });

  it("login derives the name from an unknown email", () => {
    expect(getState().login("juan.torres@example.com")).toEqual({
      fullName: "Juan Torres",
      email: "juan.torres@example.com",
    });
  });

  it("persists the session in localStorage without passwords", () => {
    getState().register({ fullName: "Maria Perez", email: "maria@example.com" });
    const stored = localStorage.getItem("ticketera-auth") ?? "";
    expect(stored).toContain("maria@example.com");
    expect(stored.toLowerCase()).not.toContain("password");
  });
});
